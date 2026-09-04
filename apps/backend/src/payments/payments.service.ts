import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import {
  AllocationComponent,
  AuditActorType,
  InstallmentStatus,
  LedgerEntryType,
  PaymentMethod,
  PaymentSource,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LedgerService, PrismaTx } from '../ledger/ledger.service';
import { assertBranchAccess } from '../rbac/branch-scope.util';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  AllocationError,
  AllocationLine,
  computeSuggestedAllocation,
  LoanAllocationState,
  OpenInstallmentState,
  validateAllocation,
} from './allocation-engine';
import { computeInstallmentStatus } from '../loans/installment-status';
import {
  generatePaymentNumber,
  generateReceiptNumber,
  generateVerificationId,
  retryOnConflict,
} from '../common/id-generators';
import { AllocationLineDto } from './dto/collect-payment.dto';

export interface CollectPaymentInput {
  loanId: string;
  amount: number;
  method: PaymentMethod;
  referenceId?: string;
  idempotencyKey: string;
  clientTransactionId?: string;
  allocation?: AllocationLineDto[];
  source: PaymentSource;
  collectedByStaffId?: string;
  branchId?: string;
  customerId?: string; // required when source is CUSTOMER_ONLINE; otherwise derived from loan
  actor: { actorType: AuditActorType; actorId?: string; role?: string; ipAddress?: string; deviceId?: string; sessionId?: string };
  requestingUser: AuthUser;
}

export interface CollectPaymentResult {
  payment: Prisma.PaymentGetPayload<{ include: { allocations: true } }>;
  receipt: Prisma.ReceiptGetPayload<Record<string, never>>;
  idempotentReplay: boolean;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Preview endpoint: returns the system's suggested allocation for an
   * amount without posting anything. This is what the "before posting, show
   * exactly how the payment will be allocated" confirmation screen calls
   * (blueprint #29, #30, #48).
   */
  async previewAllocation(loanId: string, amount: number, requestingUser: AuthUser) {
    const { loan, state } = await this.loadAllocationState(this.prisma, loanId);
    this.assertAccess(loan, requestingUser);
    const lines = computeSuggestedAllocation(amount, state);
    return { lines: lines.map(serializeLine) };
  }

  private assertAccess(loan: Prisma.LoanGetPayload<Record<string, never>>, requestingUser: AuthUser) {
    if (requestingUser.subjectType === 'STAFF') {
      assertBranchAccess(requestingUser, loan.branchId);
    } else if (requestingUser.subjectType === 'CUSTOMER' && loan.customerId !== requestingUser.id) {
      throw new ForbiddenException('You do not have access to this loan.');
    }
  }

  /**
   * Posts a payment. This is the single most safety-critical method in the
   * system (blueprint #32, #52, acceptance TEST 1 / TEST 2):
   *  - idempotencyKey has a DB-level unique constraint, so even a race
   *    between two concurrent identical requests can only ever create one row.
   *  - all balance mutations happen inside one serializable transaction.
   *  - allocation is validated against server-known remaining balances,
   *    never trusted from the client as-is.
   */
  async collectPayment(input: CollectPaymentInput): Promise<CollectPaymentResult> {
    // Retries here are ONLY about surviving a race between two requests that
    // share the same idempotencyKey (e.g. a client double-tap or a retried
    // network call) - not about retrying distinct payments. Each attempt
    // re-checks for an existing row first, so at most one payment is ever
    // created for a given key regardless of how many attempts run.
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const existing = await this.prisma.payment.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { allocations: true, receipt: true },
      });
      if (existing) {
        if (!existing.receipt) {
          throw new ConflictException(
            'A payment with this idempotency key exists but is not yet finalized. Please retry shortly.',
          );
        }
        return { payment: existing, receipt: existing.receipt, idempotentReplay: true };
      }

      try {
        const result = await this.prisma.$transaction(
          async (tx) => this.postPaymentInTransaction(tx, input),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        return { ...result, idempotentReplay: false };
      } catch (err) {
        const code = (err as { code?: string })?.code;
        // P2002: unique-constraint violation (idempotencyKey/paymentNumber).
        // P2034: Postgres serializable-isolation write conflict. Both mean
        // "another concurrent attempt may have won the race" - loop back
        // and re-check for the row rather than surfacing an error.
        const isConcurrencyConflict = code === 'P2002' || code === 'P2034';
        if (!isConcurrencyConflict || attempt === maxAttempts) throw err;
      }
    }
    throw new ConflictException('Could not post payment due to a concurrent request. Please retry.');
  }

  private async postPaymentInTransaction(
    tx: PrismaTx,
    input: CollectPaymentInput,
  ): Promise<{ payment: Prisma.PaymentGetPayload<{ include: { allocations: true } }>; receipt: Prisma.ReceiptGetPayload<Record<string, never>> }> {
    const { loan, state, installments } = await this.loadAllocationState(tx, input.loanId);
    this.assertAccess(loan, input.requestingUser);

    if (loan.status !== 'ACTIVE') {
      throw new BadRequestException(`Cannot collect payment on a loan with status ${loan.status}.`);
    }

    const amount = new Decimal(input.amount);
    let lines: AllocationLine[];
    try {
      if (input.allocation?.length) {
        lines = input.allocation.map((l) => ({
          component: l.component,
          installmentId: l.installmentId,
          amount: new Decimal(l.amount),
        }));
        validateAllocation(amount, lines, state);
      } else {
        lines = computeSuggestedAllocation(amount, state);
      }
    } catch (err) {
      if (err instanceof AllocationError) throw new BadRequestException(err.message);
      throw err;
    }

    const previousBalance = this.ledger.computeOutstanding(loan, installments);

    const payment = await retryOnConflict(() =>
      tx.payment.create({
        data: {
          paymentNumber: generatePaymentNumber(),
          idempotencyKey: input.idempotencyKey,
          clientTransactionId: input.clientTransactionId,
          customerId: loan.customerId,
          loanId: loan.id,
          branchId: input.branchId ?? loan.branchId,
          amount: amount.toFixed(2),
          method: input.method,
          status: PaymentStatus.SUCCESSFUL,
          referenceId: input.referenceId,
          source: input.source,
          collectedByStaffId: input.collectedByStaffId,
          confirmedAt: new Date(),
        },
      }),
    );

    for (const line of lines) {
      await tx.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          component: line.component as AllocationComponent,
          installmentId: line.installmentId,
          amount: line.amount.toFixed(2),
        },
      });
    }

    const downPaymentDelta = sumComponent(lines, 'DOWN_PAYMENT');
    if (downPaymentDelta.gt(0)) {
      await tx.loan.update({
        where: { id: loan.id },
        data: { downPaymentPaid: { increment: downPaymentDelta.toFixed(2) } },
      });
    }

    const perInstallmentDelta = new Map<string, Decimal>();
    for (const line of lines) {
      if (!line.installmentId) continue;
      const prev = perInstallmentDelta.get(line.installmentId) ?? new Decimal(0);
      perInstallmentDelta.set(line.installmentId, prev.plus(line.amount));
    }

    for (const [installmentId, delta] of perInstallmentDelta) {
      const installment = installments.find((i) => i.id === installmentId)!;
      const newPaidAmount = new Decimal(installment.paidAmount).plus(delta);
      const newStatus = computeInstallmentStatus(installment.totalAmount, newPaidAmount, installment.dueDate);
      await tx.installment.update({
        where: { id: installmentId },
        data: { paidAmount: newPaidAmount.toFixed(2), status: newStatus },
      });
    }

    const refreshedLoan = await tx.loan.findUniqueOrThrow({ where: { id: loan.id } });
    const refreshedInstallments = await tx.installment.findMany({ where: { loanId: loan.id } });
    const newBalance = this.ledger.computeOutstanding(refreshedLoan, refreshedInstallments);

    if (newBalance.lte(0)) {
      const allPaid = refreshedInstallments.every(
        (i) => i.status === InstallmentStatus.PAID || i.status === InstallmentStatus.CANCELLED,
      );
      if (allPaid) {
        await tx.loan.update({ where: { id: loan.id }, data: { status: 'COMPLETED' } });
      }
    }

    await this.ledger.appendEntry(tx, {
      customerId: loan.customerId,
      loanId: loan.id,
      entryType: LedgerEntryType.PAYMENT,
      credit: amount,
      balanceAfter: newBalance,
      referenceType: 'Payment',
      referenceId: payment.id,
      description: `Payment ${payment.paymentNumber} via ${input.method}`,
    });

    const receipt = await tx.receipt.create({
      data: {
        receiptNumber: generateReceiptNumber(),
        paymentId: payment.id,
        customerId: loan.customerId,
        loanId: loan.id,
        amount: amount.toFixed(2),
        previousBalance: previousBalance.toFixed(2),
        newBalance: newBalance.toFixed(2),
        collectorLabel: input.collectedByStaffId ? 'Staff Collected' : 'Online Payment',
        verificationId: generateVerificationId(),
      },
    });

    await this.audit.record({
      actorType: input.actor.actorType,
      actorId: input.actor.actorId,
      role: input.actor.role,
      action: 'PAYMENT_CREATED',
      entityType: 'Payment',
      entityId: payment.id,
      afterState: { amount: amount.toFixed(2), allocation: lines.map(serializeLine), previousBalance, newBalance },
      ipAddress: input.actor.ipAddress,
      deviceId: input.actor.deviceId,
      sessionId: input.actor.sessionId,
    });

    const paymentWithAllocations = await tx.payment.findUniqueOrThrow({
      where: { id: payment.id },
      include: { allocations: true },
    });

    return { payment: paymentWithAllocations, receipt };
  }

  private async loadAllocationState(
    tx: PrismaTx | PrismaService,
    loanId: string,
  ): Promise<{ loan: Prisma.LoanGetPayload<Record<string, never>>; state: LoanAllocationState; installments: Prisma.InstallmentGetPayload<Record<string, never>>[] }> {
    const loan = await tx.loan.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundException('Loan not found.');

    const installments = await tx.installment.findMany({
      where: { loanId, status: { notIn: ['CANCELLED'] } },
      orderBy: { sequence: 'asc' },
    });
    const openInstallments = installments.filter((i) => i.status !== 'PAID');

    const allocations = await tx.paymentAllocation.groupBy({
      by: ['installmentId', 'component'],
      where: {
        installmentId: { in: openInstallments.map((i) => i.id) },
        payment: { status: PaymentStatus.SUCCESSFUL },
      },
      _sum: { amount: true },
    });

    const allocatedFor = (installmentId: string, components: AllocationComponent[]): Decimal =>
      allocations
        .filter((a) => a.installmentId === installmentId && components.includes(a.component))
        .reduce((sum, a) => sum.plus(a._sum.amount ?? 0), new Decimal(0));

    const openInstallmentStates: OpenInstallmentState[] = openInstallments.map((i) => ({
      installmentId: i.id,
      sequence: i.sequence,
      dueDate: i.dueDate,
      isOverdue: i.status === 'OVERDUE',
      remainingPrincipal: new Decimal(i.principalAmount).minus(allocatedFor(i.id, ['EMI_PRINCIPAL'])),
      remainingCharges: new Decimal(i.chargesAmount).minus(
        allocatedFor(i.id, ['EMI_CHARGES', 'OVERDUE_PENALTY']),
      ),
    }));

    const pendingDownPayment = new Decimal(loan.downPaymentAmount).minus(loan.downPaymentPaid);

    return {
      loan,
      installments,
      state: { pendingDownPayment, openInstallments: openInstallmentStates },
    };
  }
}

function sumComponent(lines: AllocationLine[], component: AllocationComponent): Decimal {
  return lines
    .filter((l) => l.component === component)
    .reduce((sum, l) => sum.plus(l.amount), new Decimal(0));
}

function serializeLine(line: AllocationLine) {
  return { component: line.component, installmentId: line.installmentId, amount: line.amount.toFixed(2) };
}
