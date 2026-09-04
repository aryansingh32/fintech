import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { assertBranchAccess, branchWhereClause } from '../rbac/branch-scope.util';
import { generateCustomerCode, retryOnConflict } from '../common/id-generators';
import { CreateCustomerDto } from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateCustomerDto, staff: AuthUser) {
    const branchId = staff.branchId ?? undefined;
    const customer = await retryOnConflict(() =>
      this.prisma.customer.create({
        data: { ...dto, branchId, customerCode: generateCustomerCode() },
      }),
    );

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
    return customers;
  }

  async findById(customerId: string, staff: AuthUser) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found.');
    assertBranchAccess(staff, customer.branchId);
    return customer;
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
