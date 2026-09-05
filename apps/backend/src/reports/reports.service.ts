import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { InstallmentStatus, LoanStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { branchWhereClause } from '../rbac/branch-scope.util';

export interface ReportFilters {
  fromDate?: string;
  toDate?: string;
  staffId?: string;
  method?: PaymentMethod;
  customerId?: string;
  loanId?: string;
  /** Only honored when the requesting user is global (OWNER); otherwise ignored in favor of their own branch. */
  branchId?: string;
}

/**
 * Every report is scoped to the requesting staff member's branch unless
 * they are global (OWNER) - resolveBranchFilter is the single choke point
 * for that, so a manager can never see another branch's numbers by passing
 * a different branchId query param (blueprint #41: "every branch-sensitive
 * query must enforce branch access").
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  private resolveBranchFilter(user: AuthUser, requested?: string): { branchId?: string } {
    if (user.isGlobal) return requested ? { branchId: requested } : {};
    return branchWhereClause(user);
  }

  private dateRange(filters: ReportFilters) {
    const gte = filters.fromDate ? new Date(filters.fromDate) : undefined;
    const lte = filters.toDate ? endOfDay(new Date(filters.toDate)) : undefined;
    return gte || lte ? { gte, lte } : undefined;
  }

  async dailyCollection(user: AuthUser, filters: ReportFilters) {
    const createdAt = this.dateRange(filters) ?? {
      gte: startOfDay(new Date()),
      lte: endOfDay(new Date()),
    };

    const payments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.SUCCESSFUL,
        createdAt,
        method: filters.method,
        collectedByStaffId: filters.staffId,
        ...this.resolveBranchFilter(user, filters.branchId),
      },
      include: { customer: true, loan: true, collectedByStaff: true },
      orderBy: { createdAt: 'desc' },
    });

    const total = payments.reduce((sum, p) => sum.plus(p.amount), new Decimal(0));
    return { total: total.toFixed(2), count: payments.length, payments };
  }

  async outstanding(user: AuthUser, filters: ReportFilters) {
    const loans = await this.prisma.loan.findMany({
      where: {
        status: LoanStatus.ACTIVE,
        customerId: filters.customerId,
        id: filters.loanId,
        ...this.resolveBranchFilter(user, filters.branchId),
      },
      include: { installments: true, customer: true },
    });

    const rows = loans.map((loan) => ({
      loanId: loan.id,
      loanNumber: loan.loanNumber,
      customerName: loan.customer.name,
      outstanding: this.ledger.computeOutstanding(loan, loan.installments).toFixed(2),
    }));

    const total = rows.reduce((sum, r) => sum.plus(r.outstanding), new Decimal(0));
    return { total: total.toFixed(2), count: rows.length, rows };
  }

  async overdueAging(user: AuthUser, filters: ReportFilters) {
    const installments = await this.prisma.installment.findMany({
      where: {
        status: InstallmentStatus.OVERDUE,
        loan: { ...this.resolveBranchFilter(user, filters.branchId), customerId: filters.customerId },
      },
      include: { loan: { include: { customer: true } } },
    });

    const now = new Date();
    const buckets = { '1-7': [] as unknown[], '8-30': [] as unknown[], '31-60': [] as unknown[], '60+': [] as unknown[] };

    for (const installment of installments) {
      const daysOverdue = Math.floor((now.getTime() - installment.dueDate.getTime()) / 86_400_000);
      const row = {
        loanId: installment.loan.id,
        loanNumber: installment.loan.loanNumber,
        customerName: installment.loan.customer.name,
        dueDate: installment.dueDate,
        daysOverdue,
        overdueAmount: new Decimal(installment.totalAmount).minus(installment.paidAmount).toFixed(2),
      };
      if (daysOverdue <= 7) buckets['1-7'].push(row);
      else if (daysOverdue <= 30) buckets['8-30'].push(row);
      else if (daysOverdue <= 60) buckets['31-60'].push(row);
      else buckets['60+'].push(row);
    }

    return buckets;
  }

  async emiDue(user: AuthUser, filters: ReportFilters) {
    const dueDate = this.dateRange(filters) ?? { gte: startOfDay(new Date()), lte: endOfDay(addDays(new Date(), 7)) };
    return this.prisma.installment.findMany({
      where: {
        dueDate,
        status: { in: [InstallmentStatus.UPCOMING, InstallmentStatus.DUE, InstallmentStatus.OVERDUE] },
        loan: { ...this.resolveBranchFilter(user, filters.branchId), customerId: filters.customerId },
      },
      include: { loan: { include: { customer: true } } },
      orderBy: { dueDate: 'asc' },
    });
  }

  async customerLedger(customerId: string) {
    return this.prisma.ledgerEntry.findMany({ where: { customerId }, orderBy: { createdAt: 'asc' } });
  }

  async loanPortfolio(user: AuthUser, filters: ReportFilters) {
    const grouped = await this.prisma.loan.groupBy({
      by: ['status'],
      where: { ...this.resolveBranchFilter(user, filters.branchId) },
      _count: { _all: true },
      _sum: { totalPayable: true },
    });
    return grouped.map((g) => ({
      status: g.status,
      count: g._count._all,
      totalPayable: (g._sum.totalPayable ?? new Decimal(0)).toString(),
    }));
  }

  async productFinance(user: AuthUser, filters: ReportFilters) {
    const loans = await this.prisma.loan.findMany({
      where: { ...this.resolveBranchFilter(user, filters.branchId), productId: { not: null } },
      include: { product: true },
    });

    const byProduct = new Map<string, { brand: string; model: string; loanCount: number; totalFinanced: Decimal }>();
    for (const loan of loans) {
      if (!loan.product) continue;
      const key = loan.product.id;
      const entry = byProduct.get(key) ?? {
        brand: loan.product.brand,
        model: loan.product.model,
        loanCount: 0,
        totalFinanced: new Decimal(0),
      };
      entry.loanCount += 1;
      entry.totalFinanced = entry.totalFinanced.plus(loan.financedPrincipal);
      byProduct.set(key, entry);
    }

    return Array.from(byProduct.values()).map((v) => ({ ...v, totalFinanced: v.totalFinanced.toFixed(2) }));
  }

  async staffPerformance(user: AuthUser, filters: ReportFilters) {
    const grouped = await this.prisma.payment.groupBy({
      by: ['collectedByStaffId'],
      where: {
        status: PaymentStatus.SUCCESSFUL,
        collectedByStaffId: { not: null },
        createdAt: this.dateRange(filters),
        ...this.resolveBranchFilter(user, filters.branchId),
      },
      _count: { _all: true },
      _sum: { amount: true },
    });

    const staffIds = grouped.map((g) => g.collectedByStaffId!).filter(Boolean);
    const staff = await this.prisma.staffUser.findMany({ where: { id: { in: staffIds } } });
    const staffById = new Map(staff.map((s) => [s.id, s]));

    return grouped.map((g) => ({
      staffId: g.collectedByStaffId,
      staffName: staffById.get(g.collectedByStaffId!)?.name ?? 'Unknown',
      paymentsCollected: g._count._all,
      totalCollected: (g._sum.amount ?? new Decimal(0)).toString(),
    }));
  }

  async paymentReconciliation(user: AuthUser, filters: ReportFilters) {
    const grouped = await this.prisma.payment.groupBy({
      by: ['method', 'status'],
      where: {
        createdAt: this.dateRange(filters),
        ...this.resolveBranchFilter(user, filters.branchId),
      },
      _count: { _all: true },
      _sum: { amount: true },
    });

    return grouped.map((g) => ({
      method: g.method,
      status: g.status,
      count: g._count._all,
      total: (g._sum.amount ?? new Decimal(0)).toString(),
    }));
  }

  async auditReport(
    user: AuthUser,
    filters: { entityType?: string; action?: string; fromDate?: string; toDate?: string; actorId?: string },
  ) {
    if (!user.isGlobal) {
      // Non-owner staff never see the raw audit stream - too sensitive for
      // branch-level roles; owner-only per blueprint #9 "Audit log viewer."
      return { restricted: true, events: [] };
    }
    return this.prisma.auditEvent.findMany({
      where: {
        entityType: filters.entityType,
        action: filters.action,
        actorId: filters.actorId,
        createdAt: this.dateRange({ fromDate: filters.fromDate, toDate: filters.toDate }),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
