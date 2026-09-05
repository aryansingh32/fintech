import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { AuditActorType, LedgerEntryType, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../ledger/ledger.service';
import { computeInstallmentStatus } from '../loans/installment-status';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationEvent } from '../notifications/notification-events';

export interface ReversePaymentInput {
  paymentId: string;
  reason: string;
  initiatedByStaffId: string;
  approvedByStaffId?: string;
  actor: { role?: string; ipAddress?: string; deviceId?: string; sessionId?: string };
}

/**
 * Reverses a payment WITHOUT deleting it (blueprint #53, acceptance TEST 6):
 * the original Payment row stays exactly as it was, a linked Reversal row is
 * created, every affected Installment/Loan balance the payment touched is
 * unwound, and a new ledger entry + audit event record the correction.
 */
@Injectable()
export class ReversalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async reverse(input: ReversePaymentInput) {
    const notificationIds: string[] = [];

    const reversal = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: input.paymentId },
        include: { allocations: true, reversal: true },
      });
      if (!payment) throw new NotFoundException('Payment not found.');
      if (payment.status !== PaymentStatus.SUCCESSFUL) {
        throw new BadRequestException(`Cannot reverse a payment with status ${payment.status}.`);
      }
      if (payment.reversal) {
        throw new BadRequestException('This payment has already been reversed.');
      }

      const loan = await tx.loan.findUniqueOrThrow({ where: { id: payment.loanId } });

      const downPaymentAmount = payment.allocations
        .filter((a) => a.component === 'DOWN_PAYMENT')
        .reduce((sum, a) => sum.plus(a.amount), new Decimal(0));
      if (downPaymentAmount.gt(0)) {
        await tx.loan.update({
          where: { id: loan.id },
          data: { downPaymentPaid: { decrement: downPaymentAmount.toFixed(2) } },
        });
      }

      const perInstallment = new Map<string, Decimal>();
      for (const alloc of payment.allocations) {
        if (!alloc.installmentId) continue;
        const prev = perInstallment.get(alloc.installmentId) ?? new Decimal(0);
        perInstallment.set(alloc.installmentId, prev.plus(alloc.amount));
      }

      for (const [installmentId, amount] of perInstallment) {
        const installment = await tx.installment.findUniqueOrThrow({ where: { id: installmentId } });
        const newPaidAmount = Decimal.max(0, new Decimal(installment.paidAmount).minus(amount));
        const newStatus = computeInstallmentStatus(installment.totalAmount, newPaidAmount, installment.dueDate);
        await tx.installment.update({
          where: { id: installmentId },
          data: { paidAmount: newPaidAmount.toFixed(2), status: newStatus },
        });
      }

      if (loan.status === 'COMPLETED') {
        await tx.loan.update({ where: { id: loan.id }, data: { status: 'ACTIVE' } });
      }

      const reversal = await tx.reversal.create({
        data: {
          originalPaymentId: payment.id,
          reversalAmount: payment.amount,
          reason: input.reason,
          initiatedByStaffId: input.initiatedByStaffId,
          approvedByStaffId: input.approvedByStaffId,
        },
      });

      await tx.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.REVERSED } });

      const refreshedLoan = await tx.loan.findUniqueOrThrow({ where: { id: loan.id } });
      const refreshedInstallments = await tx.installment.findMany({ where: { loanId: loan.id } });
      const newBalance = this.ledger.computeOutstanding(refreshedLoan, refreshedInstallments);

      await this.ledger.appendEntry(tx, {
        customerId: loan.customerId,
        loanId: loan.id,
        entryType: LedgerEntryType.REVERSAL,
        debit: payment.amount,
        balanceAfter: newBalance,
        referenceType: 'Reversal',
        referenceId: reversal.id,
        description: `Reversal of payment ${payment.paymentNumber}: ${input.reason}`,
      });

      await this.audit.record({
        actorType: AuditActorType.STAFF,
        actorId: input.initiatedByStaffId,
        role: input.actor.role,
        action: 'PAYMENT_REVERSED',
        entityType: 'Payment',
        entityId: payment.id,
        reason: input.reason,
        beforeState: { status: PaymentStatus.SUCCESSFUL },
        afterState: { status: PaymentStatus.REVERSED, newBalance: newBalance.toFixed(2) },
        ipAddress: input.actor.ipAddress,
        deviceId: input.actor.deviceId,
        sessionId: input.actor.sessionId,
      });

      notificationIds.push(
        ...(await this.notifications.enqueue(tx, {
          event: NotificationEvent.PAYMENT_REVERSED,
          customerId: loan.customerId,
          payload: { amount: payment.amount.toFixed(2), loanNumber: loan.loanNumber, reason: input.reason },
        })),
      );

      return reversal;
    });

    await this.notifications.dispatchAll(notificationIds);
    return reversal;
  }
}
