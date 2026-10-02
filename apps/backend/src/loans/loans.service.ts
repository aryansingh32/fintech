import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { AdjustmentType, AllocationComponent, AuditActorType, LedgerEntryType, LoanStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LedgerService, PrismaTx } from '../ledger/ledger.service';
import { CustomersService } from '../customers/customers.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationEvent } from '../notifications/notification-events';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { assertBranchAccess, branchWhereClause } from '../rbac/branch-scope.util';
import { generateLoanNumber, retryOnConflict } from '../common/id-generators';
import { calculateEmiSchedule, FeeRuleInput } from './emi-calculator';
import { computeInstallmentStatus } from './installment-status';
import { CreateLoanDto, ApproveLoanDto, ApplyPenaltyDto, PreviewLoanDto, RescheduleInstallmentDto, RevokePenaltyDto } from './dto/loan.dto';

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
    private readonly customers: CustomersService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Loan creation wizard, steps 1-10 of blueprint #25: everything up to and
   * including the full repayment summary happens here, server-side and
   * deterministically. The loan is created in PENDING_APPROVAL - a human
   * still has to explicitly approve it (see `decide` below) before it
   * becomes active or any product identifier is marked financed.
   */
  /**
   * Same math `create` uses, minus everything that persists or requires a
   * specific customer - lets the Business App show the shopkeeper the real
   * principal/interest/total breakdown and full EMI schedule live, while
   * they're still choosing a plan/amount/tenure, before anything is
   * written. Never a source of truth by itself (the loan row + its
   * installments, computed the same way at `create` time, are), but always
   * computed by the identical `calculateEmiSchedule` function so it can
   * never drift from what `create` will actually produce for the same
   * inputs.
   */
  async previewSchedule(dto: PreviewLoanDto) {
    const version = await this.prisma.loanProductVersion.findUnique({ where: { id: dto.loanProductVersionId } });
    if (!version || !version.isActive) throw new NotFoundException('Loan plan not found or inactive.');
    if (dto.numberOfInstallments < version.minInstallments || dto.numberOfInstallments > version.maxInstallments) {
      throw new BadRequestException(
        `This plan allows between ${version.minInstallments} and ${version.maxInstallments} installments.`,
      );
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    return calculateEmiSchedule({
      cashPrice: dto.cashPrice,
      downPaymentAmount: dto.downPaymentAmount,
      numberOfInstallments: dto.numberOfInstallments,
      installmentFrequency: version.installmentFrequency,
      interestType: version.interestType as 'FLAT' | 'REDUCING' | 'ZERO_COST',
      interestRateAnnual: version.interestRateAnnual ?? undefined,
      interestBasis: version.interestBasis as 'FINANCED_PRINCIPAL' | 'TOTAL_CASH_PRICE',
      manualFinanceCharges: dto.manualInterestAmount,
      feeRules: (version.feeRules as unknown as FeeRuleInput[]) ?? [],
      startDate,
    });
  }

  async create(dto: CreateLoanDto, staff: AuthUser) {
    const version = await this.prisma.loanProductVersion.findUnique({
      where: { id: dto.loanProductVersionId },
      include: { loanProduct: true },
    });
    if (!version || !version.isActive) throw new NotFoundException('Loan plan not found or inactive.');
    if (dto.numberOfInstallments < version.minInstallments || dto.numberOfInstallments > version.maxInstallments) {
      throw new BadRequestException(
        `This plan allows between ${version.minInstallments} and ${version.maxInstallments} installments.`,
      );
    }

    const customer = await this.customers.findById(dto.customerId, staff);
    if (!staff.branchId && !staff.isGlobal) throw new ForbiddenException('Staff must belong to a branch.');
    let branchId = staff.isGlobal ? customer.branchId ?? staff.branchId : staff.branchId;
    if (!branchId) {
      const fallbackBranch = await this.prisma.branch.findFirst();
      if (!fallbackBranch) throw new BadRequestException('No branches found in the system to assign this loan to.');
      branchId = fallbackBranch.id;
    }

    let productIdentifier = null;
    if (dto.productIdentifierId) {
      productIdentifier = await this.prisma.productIdentifier.findUnique({
        where: { id: dto.productIdentifierId },
      });
      if (!productIdentifier) throw new NotFoundException('Product identifier not found.');
      if (productIdentifier.status !== 'INVENTORY') {
        throw new BadRequestException(
          `This unit cannot be financed (current status: ${productIdentifier.status}). Duplicate financing of the same device is not allowed.`,
        );
      }
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const schedule = calculateEmiSchedule({
      cashPrice: dto.cashPrice,
      downPaymentAmount: dto.downPaymentAmount,
      numberOfInstallments: dto.numberOfInstallments,
      installmentFrequency: version.installmentFrequency,
      interestType: version.interestType as 'FLAT' | 'REDUCING' | 'ZERO_COST',
      interestRateAnnual: version.interestRateAnnual ?? undefined,
      interestBasis: version.interestBasis as 'FINANCED_PRINCIPAL' | 'TOTAL_CASH_PRICE',
      manualFinanceCharges: dto.manualInterestAmount,
      feeRules: (version.feeRules as unknown as FeeRuleInput[]) ?? [],
      startDate,
    });

    const riskProfile = await this.customers.getRepaymentProfile(dto.customerId);

    const loan = await this.prisma.$transaction(async (tx) => {
      const created = await retryOnConflict(() =>
        tx.loan.create({
          data: {
            loanNumber: generateLoanNumber(),
            customerId: dto.customerId,
            branchId,
            productId: productIdentifier?.productId,
            loanProductVersionId: version.id,
            cashPrice: dto.cashPrice.toFixed(2),
            downPaymentAmount: dto.downPaymentAmount.toFixed(2),
            pendingUdhaarAmount: (dto.pendingUdhaarAmount ?? 0).toFixed(2),
            financedPrincipal: schedule.financedPrincipal.toFixed(2),
            financeCharges: schedule.financeCharges.toFixed(2),
            feesTotal: schedule.feesTotal.toFixed(2),
            totalPayable: schedule.totalPayable.toFixed(2),
            installmentAmount: schedule.installmentAmount.toFixed(2),
            numberOfInstallments: schedule.numberOfInstallments,
            installmentFrequency: version.installmentFrequency,
            startDate,
            maturityDate: schedule.maturityDate,
            status: 'PENDING_APPROVAL',
            createdByStaffId: staff.id,
            riskScoreSnapshot: riskProfile as never,
          },
        }),
      );

      await Promise.all(
        schedule.installments.map((i) =>
          tx.installment.create({
            data: {
              loanId: created.id,
              sequence: i.sequence,
              dueDate: i.dueDate,
              principalAmount: i.principalAmount.toFixed(2),
              chargesAmount: i.chargesAmount.toFixed(2),
              totalAmount: i.totalAmount.toFixed(2),
              status: 'UPCOMING',
            },
          }),
        ),
      );

      if (productIdentifier) {
        await tx.productIdentifier.update({
          where: { id: productIdentifier.id },
          data: { status: 'RESERVED', loanId: created.id },
        });
      }

      await this.audit.record({
        actorType: AuditActorType.STAFF,
        actorId: staff.id,
        role: staff.role,
        action: 'LOAN_CREATED',
        entityType: 'Loan',
        entityId: created.id,
        afterState: { status: 'PENDING_APPROVAL', totalPayable: schedule.totalPayable.toFixed(2) },
      });

      return created;
    });

    return this.findById(loan.id, staff);
  }

  /** Branch-scoped browse/filter for the Business App (dashboard queues, overdue navigation, search results). */
  async list(
    staff: AuthUser,
    filters: { status?: LoanStatus; customerId?: string },
  ) {
    return this.prisma.loan.findMany({
      where: {
        ...branchWhereClause(staff),
        status: filters.status,
        customerId: filters.customerId,
      },
      include: { customer: true, installments: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findById(loanId: string, staff: AuthUser) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: { installments: { orderBy: { sequence: 'asc' } }, productIdentifier: true, customer: true, agreement: true },
    });
    if (!loan) throw new NotFoundException('Loan not found.');
    assertBranchAccess(staff, loan.branchId);
    return loan;
  }

  async findByIdForCustomer(loanId: string, customerId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: { installments: { orderBy: { sequence: 'asc' } }, product: true, productIdentifier: true, agreement: true },
    });
    if (!loan) throw new NotFoundException('Loan not found.');
    if (loan.customerId !== customerId) throw new ForbiddenException('You do not have access to this loan.');
    return loan;
  }

  async listForCustomer(customerId: string) {
    return this.prisma.loan.findMany({
      where: { customerId },
      include: { installments: { orderBy: { sequence: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Human-controlled approval (blueprint #27). The advisory risk score was
   * already frozen into riskScoreSnapshot at creation time; this endpoint
   * only records the staff member's decision - it can never be skipped or
   * automated, and a decline always requires a reason.
   */
  async decide(loanId: string, dto: ApproveLoanDto, staff: AuthUser) {
    const loan = await this.findById(loanId, staff);
    if (loan.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(`This loan is not pending approval (current status: ${loan.status}).`);
    }
    if (dto.decision === 'DECLINED' && !dto.reason) {
      throw new BadRequestException('A reason is required to decline a loan application.');
    }

    const notificationIds: string[] = [];

    const result = await this.prisma.$transaction(async (tx) => {
      if (dto.decision === 'APPROVED') {
        await tx.loan.update({
          where: { id: loanId },
          data: {
            status: 'ACTIVE',
            approvalDecision: 'APPROVED',
            approvalReason: dto.reason,
            approvedByStaffId: staff.id,
            approvedAt: new Date(),
          },
        });

        if (loan.productIdentifier) {
          await tx.productIdentifier.update({
            where: { id: loan.productIdentifier.id },
            data: { status: 'FINANCED' },
          });
        }

        // Freeze the current default agreement wording alongside this loan's numeric
        // terms, if the business has published one - a later template edit must
        // never alter what this customer already agreed to.
        const defaultTemplate = await tx.agreementTemplate.findFirst({
          where: { key: 'LOAN_AGREEMENT_DEFAULT', isActive: true },
          orderBy: { version: 'desc' },
        });

        const agreement = await tx.agreement.create({
          data: {
            loanId,
            acceptedByCustomerAt: new Date(),
            termsSnapshot: {
              loanNumber: loan.loanNumber,
              cashPrice: loan.cashPrice.toString(),
              downPaymentAmount: loan.downPaymentAmount.toString(),
              financedPrincipal: loan.financedPrincipal.toString(),
              financeCharges: loan.financeCharges.toString(),
              feesTotal: loan.feesTotal.toString(),
              totalPayable: loan.totalPayable.toString(),
              installments: loan.installments.map((i) => ({
                sequence: i.sequence,
                dueDate: i.dueDate,
                totalAmount: i.totalAmount.toString(),
              })),
              agreementTemplateTitle: defaultTemplate?.title ?? null,
              agreementTemplateContent: defaultTemplate?.content ?? null,
              agreementTemplateVersion: defaultTemplate?.version ?? null,
            } as never,
          },
        });

        await this.ledger.appendEntry(tx, {
          customerId: loan.customerId,
          loanId,
          entryType: LedgerEntryType.EMI_DUE,
          debit: loan.totalPayable,
          balanceAfter: this.ledger.computeOutstanding(
            { downPaymentAmount: loan.downPaymentAmount, downPaymentPaid: loan.downPaymentPaid, totalPayable: loan.totalPayable },
            loan.installments,
          ),
          referenceType: 'Loan',
          referenceId: loanId,
          description: `Loan ${loan.loanNumber} activated`,
        });

        await this.audit.record({
          actorType: AuditActorType.STAFF,
          actorId: staff.id,
          role: staff.role,
          action: 'LOAN_APPROVED',
          entityType: 'Loan',
          entityId: loanId,
          beforeState: { riskScoreSnapshot: loan.riskScoreSnapshot },
          afterState: { status: 'ACTIVE', agreementId: agreement.id },
          reason: dto.reason,
        });

        notificationIds.push(
          ...(await this.notifications.enqueue(tx, {
            event: NotificationEvent.LOAN_APPROVED,
            customerId: loan.customerId,
            payload: { loanNumber: loan.loanNumber },
          })),
          ...(await this.notifications.enqueue(tx, {
            event: NotificationEvent.AGREEMENT_AVAILABLE,
            customerId: loan.customerId,
            payload: { loanNumber: loan.loanNumber },
          })),
        );
      } else if (dto.decision === 'DECLINED') {
        await tx.loan.update({
          where: { id: loanId },
          data: {
            status: 'DECLINED',
            approvalDecision: 'DECLINED',
            approvalReason: dto.reason,
            approvedByStaffId: staff.id,
            approvedAt: new Date(),
          },
        });

        if (loan.productIdentifier) {
          await tx.productIdentifier.update({
            where: { id: loan.productIdentifier.id },
            data: { status: 'INVENTORY', loanId: null },
          });
        }

        await this.audit.record({
          actorType: AuditActorType.STAFF,
          actorId: staff.id,
          role: staff.role,
          action: 'LOAN_DECLINED',
          entityType: 'Loan',
          entityId: loanId,
          reason: dto.reason,
        });

        notificationIds.push(
          ...(await this.notifications.enqueue(tx, {
            event: NotificationEvent.LOAN_REJECTED,
            customerId: loan.customerId,
            payload: { loanNumber: loan.loanNumber },
          })),
        );
      } else {
        await tx.loan.update({
          where: { id: loanId },
          data: { approvalDecision: 'MANUAL_REVIEW', approvalReason: dto.reason },
        });

        await this.audit.record({
          actorType: AuditActorType.STAFF,
          actorId: staff.id,
          role: staff.role,
          action: 'LOAN_MANUAL_REVIEW',
          entityType: 'Loan',
          entityId: loanId,
          reason: dto.reason,
        });
      }

      return tx.loan.findUniqueOrThrow({ where: { id: loanId }, include: { installments: true, agreement: true } });
    });

    await this.notifications.dispatchAll(notificationIds);
    return result;
  }

  async rescheduleInstallment(loanId: string, installmentId: string, dto: RescheduleInstallmentDto, staff: AuthUser) {
    const loan = await this.findById(loanId, staff);
    const installment = loan.installments.find((i) => i.id === installmentId);
    if (!installment) throw new NotFoundException('Installment not found on this loan.');
    if (installment.status === 'PAID' || installment.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot reschedule an installment that is already ${installment.status.toLowerCase()}.`);
    }

    const newDueDate = new Date(dto.newDueDate);
    if (Number.isNaN(newDueDate.getTime())) {
      throw new BadRequestException('newDueDate is not a valid date.');
    }
    const previousDueDate = installment.dueDate;
    const newStatus = computeInstallmentStatus(installment.totalAmount, installment.paidAmount, newDueDate);

    const notificationIds: string[] = [];
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.installment.update({
        where: { id: installmentId },
        data: { dueDate: newDueDate, status: newStatus },
      });

      await this.audit.record({
        actorType: AuditActorType.STAFF,
        actorId: staff.id,
        role: staff.role,
        action: 'LOAN_INSTALLMENT_RESCHEDULED',
        entityType: 'Installment',
        entityId: installmentId,
        beforeState: { dueDate: previousDueDate },
        afterState: { dueDate: newDueDate },
        reason: dto.reason,
      });

      notificationIds.push(
        ...(await this.notifications.enqueue(tx, {
          event: NotificationEvent.EMI_RESCHEDULED,
          customerId: loan.customerId,
          payload: { loanNumber: loan.loanNumber, dueDate: newDueDate.toISOString().slice(0, 10) },
        })),
      );

      return result;
    });

    await this.notifications.dispatchAll(notificationIds);
    return updated;
  }

  /**
   * Staff-applied late-payment penalty on one overdue (or already-paid-late)
   * installment. Layers on top of the original schedule - chargesAmount
   * from origination is never touched - so the frozen agreement snapshot
   * stays accurate and this is always visible as its own line item via the
   * Adjustment record and ledger entry.
   */
  async applyPenalty(loanId: string, installmentId: string, dto: ApplyPenaltyDto, staff: AuthUser) {
    const loan = await this.findById(loanId, staff);
    const installment = loan.installments.find((i) => i.id === installmentId);
    if (!installment) throw new NotFoundException('Installment not found on this loan.');
    if (installment.status === 'PAID' || installment.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot add a penalty to an installment that is already ${installment.status.toLowerCase()}.`);
    }

    const penaltyAmount = new Decimal(dto.amount).toDecimalPlaces(2);

    const notificationIds: string[] = [];
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedInstallment = await tx.installment.update({
        where: { id: installmentId },
        data: {
          penaltyAmount: { increment: penaltyAmount.toFixed(2) },
          totalAmount: { increment: penaltyAmount.toFixed(2) },
        },
      });

      const updatedLoan = await tx.loan.update({
        where: { id: loanId },
        data: { totalPayable: { increment: penaltyAmount.toFixed(2) } },
      });

      await tx.adjustment.create({
        data: {
          loanId,
          type: AdjustmentType.PENALTY,
          amount: penaltyAmount.toFixed(2),
          reason: dto.reason,
          staffId: staff.id,
        },
      });

      const freshInstallments = await tx.installment.findMany({ where: { loanId } });
      await this.ledger.appendEntry(tx, {
        customerId: loan.customerId,
        loanId,
        entryType: LedgerEntryType.FEE,
        debit: penaltyAmount,
        balanceAfter: this.ledger.computeOutstanding(updatedLoan, freshInstallments),
        referenceType: 'Installment',
        referenceId: installmentId,
        description: `Late payment penalty on EMI ${installment.sequence}: ${dto.reason}`,
      });

      await this.audit.record({
        actorType: AuditActorType.STAFF,
        actorId: staff.id,
        role: staff.role,
        action: 'INSTALLMENT_PENALTY_APPLIED',
        entityType: 'Installment',
        entityId: installmentId,
        afterState: { penaltyAmount: penaltyAmount.toFixed(2) },
        reason: dto.reason,
      });

      notificationIds.push(
        ...(await this.notifications.enqueue(tx, {
          event: NotificationEvent.PENALTY_APPLIED,
          customerId: loan.customerId,
          payload: {
            amount: penaltyAmount.toFixed(2),
            sequence: String(installment.sequence),
            loanNumber: loan.loanNumber,
          },
        })),
      );

      return updatedInstallment;
    });

    await this.notifications.dispatchAll(notificationIds);
    return updated;
  }

  /**
   * Removes a penalty outright, whether or not any of it has been paid yet.
   * The charge itself always disappears (penaltyAmount -> 0, totalAmount and
   * totalPayable shrink to match). If money was already collected against
   * it, that money isn't refunded or lost - it's credited toward this same
   * EMI's principal first, then cascades forward to the next open EMI(s) in
   * sequence, so the customer keeps credit for what they already paid.
   */
  async revokePenalty(loanId: string, installmentId: string, dto: RevokePenaltyDto, staff: AuthUser) {
    const loan = await this.findById(loanId, staff);
    const installment = loan.installments.find((i) => i.id === installmentId);
    if (!installment) throw new NotFoundException('Installment not found on this loan.');

    const currentPenalty = new Decimal(installment.penaltyAmount);
    if (currentPenalty.lte(0)) {
      throw new BadRequestException('This installment has no penalty to remove.');
    }

    const paidPenaltyAgg = await this.prisma.paymentAllocation.aggregate({
      where: {
        installmentId,
        component: AllocationComponent.OVERDUE_PENALTY,
        payment: { status: PaymentStatus.SUCCESSFUL },
      },
      _sum: { amount: true },
    });
    const paidPenalty = new Decimal(paidPenaltyAgg._sum.amount ?? 0);

    const notificationIds: string[] = [];
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.installment.update({
        where: { id: installmentId },
        data: {
          penaltyAmount: 0,
          totalAmount: { decrement: currentPenalty.toFixed(2) },
        },
      });

      let updatedLoan = await tx.loan.update({
        where: { id: loanId },
        data: { totalPayable: { decrement: currentPenalty.toFixed(2) } },
      });

      const reassignedTo = paidPenalty.gt(0)
        ? await this.reassignPaidPenalty(tx, loanId, installmentId, installment.sequence)
        : [];

      const freshInstallments = await tx.installment.findMany({ where: { loanId } });
      for (const inst of freshInstallments) {
        const recomputedStatus = computeInstallmentStatus(inst.totalAmount, inst.paidAmount, inst.dueDate);
        if (recomputedStatus !== inst.status) {
          await tx.installment.update({ where: { id: inst.id }, data: { status: recomputedStatus } });
        }
      }

      const finalInstallments = await tx.installment.findMany({ where: { loanId } });
      const finalInstallment = finalInstallments.find((i) => i.id === installmentId)!;

      const outstanding = this.ledger.computeOutstanding(updatedLoan, finalInstallments);
      if (
        outstanding.lte(0) &&
        finalInstallments.every((i) => i.status === 'PAID' || i.status === 'CANCELLED') &&
        loan.status === 'ACTIVE'
      ) {
        updatedLoan = await tx.loan.update({ where: { id: loanId }, data: { status: 'COMPLETED' } });
      }

      await tx.adjustment.create({
        data: {
          loanId,
          type: AdjustmentType.WAIVER,
          amount: currentPenalty.toFixed(2),
          reason: dto.reason,
          staffId: staff.id,
        },
      });

      await this.ledger.appendEntry(tx, {
        customerId: loan.customerId,
        loanId,
        entryType: LedgerEntryType.WAIVER,
        credit: currentPenalty,
        balanceAfter: outstanding,
        referenceType: 'Installment',
        referenceId: installmentId,
        description: paidPenalty.gt(0)
          ? `Penalty removed on EMI ${installment.sequence}: ${dto.reason} (₹${paidPenalty.toFixed(2)} already paid was credited to ${reassignedTo.join(', ') || 'this EMI'})`
          : `Penalty removed on EMI ${installment.sequence}: ${dto.reason}`,
      });

      await this.audit.record({
        actorType: AuditActorType.STAFF,
        actorId: staff.id,
        role: staff.role,
        action: 'INSTALLMENT_PENALTY_REVOKED',
        entityType: 'Installment',
        entityId: installmentId,
        beforeState: { penaltyAmount: currentPenalty.toFixed(2), paidPenalty: paidPenalty.toFixed(2) },
        afterState: { penaltyAmount: '0.00', reassignedTo },
        reason: dto.reason,
      });

      notificationIds.push(
        ...(await this.notifications.enqueue(tx, {
          event: NotificationEvent.PENALTY_REVOKED,
          customerId: loan.customerId,
          payload: {
            amount: currentPenalty.toFixed(2),
            sequence: String(installment.sequence),
            loanNumber: loan.loanNumber,
          },
        })),
      );

      return finalInstallment;
    });

    await this.notifications.dispatchAll(notificationIds);
    return updated;
  }

  /**
   * Moves already-collected penalty money onto principal so it isn't lost
   * when the penalty it paid for is removed - this EMI first (if it still
   * has unpaid principal after the penalty is gone), then the next open
   * EMIs in sequence. Rewrites the underlying PaymentAllocation rows (not
   * just the paidAmount totals) so future payments' remaining-balance
   * calculations stay accurate, splitting a row across installments when
   * one EMI's remaining principal isn't enough to absorb it. Returns the
   * EMI sequence numbers the money ended up on, for the audit trail.
   */
  private async reassignPaidPenalty(
    tx: PrismaTx,
    loanId: string,
    fromInstallmentId: string,
    fromSequence: number,
  ): Promise<string[]> {
    const targets = await tx.installment.findMany({
      where: { loanId, sequence: { gte: fromSequence }, status: { not: 'CANCELLED' } },
      orderBy: { sequence: 'asc' },
    });

    const rows = await tx.paymentAllocation.findMany({
      where: {
        installmentId: fromInstallmentId,
        component: AllocationComponent.OVERDUE_PENALTY,
        payment: { status: PaymentStatus.SUCCESSFUL },
      },
      orderBy: { createdAt: 'asc' },
    });

    const consumedByTarget = new Map<string, Decimal>();
    const roomOn = async (targetId: string, principalAmount: Decimal.Value) => {
      const agg = await tx.paymentAllocation.aggregate({
        where: { installmentId: targetId, component: AllocationComponent.EMI_PRINCIPAL, payment: { status: PaymentStatus.SUCCESSFUL } },
        _sum: { amount: true },
      });
      const base = new Decimal(principalAmount).minus(agg._sum.amount ?? 0);
      return base.minus(consumedByTarget.get(targetId) ?? new Decimal(0));
    };

    const paidAmountDelta = new Map<string, Decimal>();
    const bump = (id: string, delta: Decimal) => paidAmountDelta.set(id, (paidAmountDelta.get(id) ?? new Decimal(0)).plus(delta));
    const touchedSequences = new Set<number>();

    for (const row of rows) {
      let rowRemaining = new Decimal(row.amount);
      bump(fromInstallmentId, rowRemaining.neg());
      let firstWrite = true;

      for (const target of targets) {
        if (rowRemaining.lte(0)) break;
        const room = await roomOn(target.id, target.principalAmount);
        if (room.lte(0)) continue;

        const take = Decimal.min(room, rowRemaining);
        if (firstWrite) {
          await tx.paymentAllocation.update({
            where: { id: row.id },
            data: { installmentId: target.id, component: AllocationComponent.EMI_PRINCIPAL, amount: take.toFixed(2) },
          });
          firstWrite = false;
        } else {
          await tx.paymentAllocation.create({
            data: { paymentId: row.paymentId, installmentId: target.id, component: AllocationComponent.EMI_PRINCIPAL, amount: take.toFixed(2) },
          });
        }

        consumedByTarget.set(target.id, (consumedByTarget.get(target.id) ?? new Decimal(0)).plus(take));
        bump(target.id, take);
        touchedSequences.add(target.sequence);
        rowRemaining = rowRemaining.minus(take);
      }

      if (rowRemaining.gt(0)) {
        // Nowhere left to put it (the rest of the loan is already fully
        // paid) - leave it as an unattached credit rather than pretend it
        // paid for something it didn't.
        if (firstWrite) {
          await tx.paymentAllocation.update({
            where: { id: row.id },
            data: { installmentId: null, component: AllocationComponent.OTHER, amount: rowRemaining.toFixed(2) },
          });
        } else {
          await tx.paymentAllocation.create({
            data: { paymentId: row.paymentId, installmentId: null, component: AllocationComponent.OTHER, amount: rowRemaining.toFixed(2) },
          });
        }
      }
    }

    for (const [instId, delta] of paidAmountDelta) {
      if (delta.eq(0)) continue;
      await tx.installment.update({ where: { id: instId }, data: { paidAmount: { increment: delta.toFixed(2) } } });
    }

    return [...touchedSequences].sort((a, b) => a - b).map((s) => `EMI ${s}`);
  }

  /** Staff-initiated push reminder for one overdue installment, on top of the automatic daily sweep (EmiSchedulerService). */
  async notifyOverdueInstallment(loanId: string, installmentId: string, staff: AuthUser) {
    const loan = await this.findById(loanId, staff);
    const installment = loan.installments.find((i) => i.id === installmentId);
    if (!installment) throw new NotFoundException('Installment not found on this loan.');
    // Not just `status === 'OVERDUE'` - status gets stuck on PARTIALLY_PAID
    // once any money lands on an EMI, even if its due date has since passed,
    // so a partially-paid-but-overdue EMI needs its own reminder too.
    if (installment.status === 'PAID' || installment.status === 'CANCELLED' || installment.dueDate >= new Date()) {
      throw new BadRequestException('This installment is not overdue.');
    }

    const outstanding = new Decimal(installment.totalAmount).minus(installment.paidAmount).toDecimalPlaces(2);
    const ids = await this.notifications.enqueue(this.prisma, {
      event: NotificationEvent.EMI_OVERDUE,
      customerId: loan.customerId,
      payload: { amount: outstanding.toFixed(2), loanNumber: loan.loanNumber },
    });
    await this.notifications.dispatchAll(ids);

    await this.audit.record({
      actorType: AuditActorType.STAFF,
      actorId: staff.id,
      role: staff.role,
      action: 'OVERDUE_NOTIFICATION_SENT',
      entityType: 'Installment',
      entityId: installmentId,
    });

    return { success: true };
  }
}
