import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { Installment, LedgerEntryType, Loan, Prisma } from '@prisma/client';

export type PrismaTx = Prisma.TransactionClient;

/**
 * Authoritative outstanding-balance computation and append-only ledger
 * writes. Loan.downPaymentPaid and Installment.paidAmount are the source of
 * truth for balances; every LedgerEntry recorded here must be computed from
 * them in the same database transaction as the underlying change, so the
 * ledger can never drift from the balances it explains (blueprint #34, #43).
 */
@Injectable()
export class LedgerService {
  /** Total amount the customer still owes on this loan (down payment + EMIs). */
  computeOutstanding(loan: Pick<Loan, 'downPaymentAmount' | 'downPaymentPaid' | 'totalPayable'>, installments: Pick<Installment, 'totalAmount' | 'paidAmount'>[]): Decimal {
    const pendingDownPayment = new Decimal(loan.downPaymentAmount).minus(loan.downPaymentPaid);
    const paidInstallments = installments.reduce((sum, i) => sum.plus(i.paidAmount), new Decimal(0));
    const pendingInstallments = new Decimal(loan.totalPayable).minus(paidInstallments);
    return pendingDownPayment.plus(pendingInstallments);
  }

  async appendEntry(
    tx: PrismaTx,
    params: {
      customerId: string;
      loanId?: string;
      entryType: LedgerEntryType;
      debit?: Decimal.Value;
      credit?: Decimal.Value;
      balanceAfter: Decimal.Value;
      referenceType: string;
      referenceId: string;
      description: string;
    },
  ) {
    return tx.ledgerEntry.create({
      data: {
        customerId: params.customerId,
        loanId: params.loanId,
        entryType: params.entryType,
        debit: new Decimal(params.debit ?? 0).toFixed(2),
        credit: new Decimal(params.credit ?? 0).toFixed(2),
        balanceAfter: new Decimal(params.balanceAfter).toFixed(2),
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        description: params.description,
      },
    });
  }
}
