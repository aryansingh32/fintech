import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuditActorType, Prisma, PaymentStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { assertBranchAccess, branchWhereClause } from '../rbac/branch-scope.util';
import { generateCustomerCode, retryOnConflict } from '../common/id-generators';
import { CreateCustomerDto, DeleteCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

const BLOCKING_LOAN_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'DEFAULTED'];

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateCustomerDto, staff: AuthUser) {
    const branchId = staff.branchId ?? undefined;

    // Fast-path check for the common case (staff re-entering a number that's
    // already a customer) - readable error instead of a raw 500. The
    // catch below is the actual guarantee (handles the race between this
    // check and the insert), since the unique constraint is the source of
    // truth, not this pre-check.
    const existingByMobile = await this.prisma.customer.findUnique({ where: { mobile: dto.mobile } });
    if (existingByMobile) {
      throw new ConflictException('A customer with this mobile number already exists.');
    }

    let customer;
    try {
      // retryOnConflict exists to retry past a collision on the *generated*
      // customerCode (vanishingly rare, always safe to retry). A collision
      // on the caller-supplied `mobile` is a different kind of conflict - a
      // genuine duplicate, not a generation collision - so it must not be
      // retried and must not leak as a raw 500.
      customer = await retryOnConflict(() =>
        this.prisma.customer.create({
          data: { ...dto, branchId, customerCode: generateCustomerCode() },
        }),
      );
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('A customer with this mobile number already exists.');
      }
      throw err;
    }

    await this.audit.record({
      actorType: AuditActorType.STAFF,
      actorId: staff.id,
      role: staff.role,
      action: 'CUSTOMER_CREATED',
      entityType: 'Customer',
      entityId: customer.id,
      afterState: { mobile: this.maskMobile(customer.mobile), name: customer.name },
    });

    return customer;
  }

  /** Search by exact mobile, customerCode, loanNumber, or partial name match. */
  /**
   * List/search results carry a lightweight per-customer loan badge summary
   * (active/overdue/completed/no-loans + outstanding total) so the Business
   * App's customer list can show status indicators without an N+1 query per
   * row - one extra batched query across the page's customer ids covers it.
   */
  async search(query: string, staff: AuthUser) {
    const branchFilter = branchWhereClause(staff);
    const customers = await this.prisma.customer.findMany({
      where: {
        ...branchFilter,
        OR: [
          { mobile: { contains: query } },
          { customerCode: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
          { loans: { some: { loanNumber: { contains: query, mode: 'insensitive' } } } },
        ],
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    const badgesByCustomer = await this.loanBadgesFor(customers.map((c) => c.id));
    return customers.map((c) => ({ ...c, loanSummary: badgesByCustomer.get(c.id)! }));
  }

  private async loanBadgesFor(customerIds: string[]) {
    const badges = new Map<
      string,
      { hasActiveLoan: boolean; hasOverdueLoan: boolean; hasCompletedLoan: boolean; hasNoLoans: boolean; outstanding: string }
    >();
    for (const id of customerIds) {
      badges.set(id, { hasActiveLoan: false, hasOverdueLoan: false, hasCompletedLoan: false, hasNoLoans: true, outstanding: '0.00' });
    }
    if (customerIds.length === 0) return badges;

    const loans = await this.prisma.loan.findMany({
      where: { customerId: { in: customerIds } },
      select: {
        customerId: true,
        status: true,
        installments: { select: { status: true, totalAmount: true, paidAmount: true } },
      },
    });

    for (const loan of loans) {
      const badge = badges.get(loan.customerId);
      if (!badge) continue;
      badge.hasNoLoans = false;
      if (loan.status === 'ACTIVE') badge.hasActiveLoan = true;
      if (loan.status === 'COMPLETED') badge.hasCompletedLoan = true;

      let outstanding = new Decimal(badge.outstanding);
      for (const installment of loan.installments) {
        if (installment.status === 'CANCELLED') continue;
        const remaining = new Decimal(installment.totalAmount).minus(installment.paidAmount);
        if (remaining.gt(0)) outstanding = outstanding.plus(remaining);
        if (installment.status === 'OVERDUE') badge.hasOverdueLoan = true;
      }
      badge.outstanding = outstanding.toFixed(2);
    }

    return badges;
  }

  async findById(customerId: string, staff: AuthUser) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found.');
    assertBranchAccess(staff, customer.branchId);
    return customer;
  }

  async getOwnProfile(customerId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found.');
    return customer;
  }

  async update(customerId: string, dto: UpdateCustomerDto, staff: AuthUser) {
    const existing = await this.findById(customerId, staff);
    const updated = await this.prisma.customer.update({ where: { id: existing.id }, data: dto });

    await this.audit.record({
      actorType: AuditActorType.STAFF,
      actorId: staff.id,
      role: staff.role,
      action: 'CUSTOMER_UPDATED',
      entityType: 'Customer',
      entityId: existing.id,
      beforeState: { name: existing.name, city: existing.city },
      afterState: { name: updated.name, city: updated.city },
    });

    return updated;
  }

  /**
   * Deleting a customer is destructive by nature, so it is gated harder
   * than a normal edit: the acting staff member must re-enter their own
   * password (a step-up confirmation, not just a UI "are you sure"), and a
   * customer with any loan that is still financially open (pending
   * approval through active/defaulted) can never be removed - the flow
   * must fail closed rather than let a debt disappear along with the
   * record of who owes it. A customer with only closed-out loan history
   * (completed/declined/cancelled/settled) is deactivated, never hard
   * deleted, to keep that financial history intact (blueprint: financial
   * rows are append-only where practical). Only a customer with zero loan
   * history ever is actually removed from the table.
   */
  async remove(customerId: string, dto: DeleteCustomerDto, staff: AuthUser): Promise<{ mode: 'deleted' | 'deactivated' }> {
    const customer = await this.findById(customerId, staff);

    const staffUser = await this.prisma.staffUser.findUnique({ where: { id: staff.id } });
    if (!staffUser?.passwordHash || !(await argon2.verify(staffUser.passwordHash, dto.currentPassword))) {
      throw new UnauthorizedException('Incorrect password.');
    }

    const loans = await this.prisma.loan.findMany({
      where: { customerId },
      select: { id: true, status: true, loanNumber: true },
    });

    const blocking = loans.filter((l) => BLOCKING_LOAN_STATUSES.includes(l.status));
    if (blocking.length > 0) {
      throw new ConflictException(
        `Cannot delete this customer: ${blocking.length} loan(s) are still open (${blocking
          .map((l) => `${l.loanNumber} - ${l.status}`)
          .join(', ')}). Close or settle these loans first.`,
      );
    }

    const mode = loans.length > 0 ? 'deactivated' : 'deleted';

    if (mode === 'deactivated') {
      await this.prisma.customer.update({ where: { id: customerId }, data: { isActive: false } });
    } else {
      await this.prisma.customer.delete({ where: { id: customerId } });
    }

    await this.audit.record({
      actorType: AuditActorType.STAFF,
      actorId: staff.id,
      role: staff.role,
      action: mode === 'deactivated' ? 'CUSTOMER_DEACTIVATED' : 'CUSTOMER_DELETED',
      entityType: 'Customer',
      entityId: customerId,
      beforeState: { name: customer.name, mobile: this.maskMobile(customer.mobile) },
      reason: dto.reason,
    });

    return { mode };
  }

  /**
   * Aggregate payment/EMI standing for the customer's full loan book -
   * powers the Business App's per-customer "how much is left / overdue"
   * dashboard. Purely a read-side rollup over Payment/Installment; never a
   * source of truth for any single loan's balance (that's the Loan +
   * Installment rows themselves).
   */
  async getSummary(customerId: string, staff: AuthUser) {
    await this.findById(customerId, staff);

    const [paidAgg, installments] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { customerId, status: PaymentStatus.SUCCESSFUL },
        _sum: { amount: true },
      }),
      this.prisma.installment.findMany({
        where: { loan: { customerId }, status: { notIn: ['CANCELLED'] } },
        select: { id: true, loanId: true, dueDate: true, totalAmount: true, paidAmount: true, status: true },
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    let totalOutstanding = new Decimal(0);
    let totalOverdue = new Decimal(0);
    let nextDue: { loanId: string; installmentId: string; amount: string; dueDate: Date } | null = null;

    for (const installment of installments) {
      const remaining = new Decimal(installment.totalAmount).minus(installment.paidAmount);
      if (remaining.lte(0)) continue;
      totalOutstanding = totalOutstanding.plus(remaining);
      if (installment.status === 'OVERDUE') {
        totalOverdue = totalOverdue.plus(remaining);
      }
      if (!nextDue && installment.status !== 'OVERDUE') {
        nextDue = {
          loanId: installment.loanId,
          installmentId: installment.id,
          amount: remaining.toFixed(2),
          dueDate: installment.dueDate,
        };
      }
    }

    const loanIds = [...new Set(installments.map((i) => i.loanId))];
    const perLoan = loanIds.map((loanId) => {
      const rows = installments.filter((i) => i.loanId === loanId);
      const outstanding = rows.reduce(
        (sum, r) => sum.plus(Decimal.max(0, new Decimal(r.totalAmount).minus(r.paidAmount))),
        new Decimal(0),
      );
      const overdue = rows
        .filter((r) => r.status === 'OVERDUE')
        .reduce((sum, r) => sum.plus(new Decimal(r.totalAmount).minus(r.paidAmount)), new Decimal(0));
      return { loanId, outstanding: outstanding.toFixed(2), overdue: overdue.toFixed(2) };
    });

    return {
      totalPaid: (paidAgg._sum.amount ?? new Decimal(0)).toFixed(2),
      totalOutstanding: totalOutstanding.toFixed(2),
      totalOverdue: totalOverdue.toFixed(2),
      nextDue: nextDue ? { ...nextDue, dueDate: nextDue.dueDate.toISOString() } : null,
      perLoan,
    };
  }

  async addNote(customerId: string, note: string, staff: AuthUser) {
    const customer = await this.findById(customerId, staff);
    const created = await this.prisma.customerNote.create({
      data: { customerId: customer.id, staffId: staff.id, note },
    });
    await this.audit.record({
      actorType: AuditActorType.STAFF,
      actorId: staff.id,
      role: staff.role,
      action: 'CUSTOMER_NOTE_ADDED',
      entityType: 'Customer',
      entityId: customer.id,
    });
    return created;
  }

  async getRepaymentProfile(customerId: string) {
    const [completedLoans, installments, overdueInstallments] = await Promise.all([
      this.prisma.loan.count({ where: { customerId, status: 'COMPLETED' } }),
      this.prisma.installment.findMany({
        where: { loan: { customerId }, status: { in: ['PAID', 'OVERDUE', 'PARTIALLY_PAID'] } },
        select: { status: true, dueDate: true, updatedAt: true },
      }),
      this.prisma.installment.count({ where: { loan: { customerId }, status: 'OVERDUE' } }),
    ]);

    const paidInstallments = installments.filter((i) => i.status === 'PAID');
    const totalConsidered = installments.length;
    const onTimePayments = paidInstallments.filter((i) => i.updatedAt <= i.dueDate).length;
    const onTimeRate = totalConsidered > 0 ? Math.round((onTimePayments / totalConsidered) * 100) : null;

    // Transparent, rule-based, advisory only - never a lending decision by itself.
    let score: number | null = null;
    const reasons: string[] = [];
    if (totalConsidered > 0) {
      score = Math.max(0, Math.min(100, Math.round((onTimeRate ?? 0) * 0.7 + (completedLoans > 0 ? 30 : 0))));
      reasons.push(`${onTimeRate}% of past installments paid on time`);
      reasons.push(`${completedLoans} completed loan(s) with SPTC Finance`);
      if (overdueInstallments > 0) reasons.push(`${overdueInstallments} installment(s) currently overdue`);
    } else {
      reasons.push('No repayment history yet - this would be a first loan.');
    }

    return {
      score,
      onTimePaymentRate: onTimeRate,
      completedLoans,
      currentOverdueInstallments: overdueInstallments,
      reasons,
      isAdvisoryOnly: true,
    };
  }

  private maskMobile(mobile: string): string {
    return mobile.length <= 4 ? '****' : `${'*'.repeat(mobile.length - 4)}${mobile.slice(-4)}`;
  }
}
