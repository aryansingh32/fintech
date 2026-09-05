import { InstallmentStatus, Loan } from '@sptc/shared';

/**
 * Display-only aggregates derived from a Loan the API already returned.
 * These are NEVER sent back to the server as the basis for a financial
 * decision - the actual amount owed for a payment always comes fresh from
 * POST /payments/loans/:id/allocation-preview at the moment of paying, so a
 * stale client-side number here can never cause an incorrect charge.
 */
export interface LoanSummary {
  outstanding: number;
  nextInstallment: Loan['installments'][number] | null;
  overdueAmount: number;
  installmentsPaid: number;
  installmentsTotal: number;
}

export function summarizeLoan(loan: Loan): LoanSummary {
  const downPaymentPending = Number(loan.downPaymentAmount) - Number(loan.downPaymentPaid);
  const paidTowardsInstallments = loan.installments.reduce((sum, i) => sum + Number(i.paidAmount), 0);
  const outstanding = Math.max(0, downPaymentPending + (Number(loan.totalPayable) - paidTowardsInstallments));

  const openStatuses: InstallmentStatus[] = [
    InstallmentStatus.OVERDUE,
    InstallmentStatus.DUE,
    InstallmentStatus.PARTIALLY_PAID,
    InstallmentStatus.UPCOMING,
  ];
  const sorted = [...loan.installments].sort((a, b) => a.sequence - b.sequence);
  const nextInstallment = sorted.find((i) => openStatuses.includes(i.status)) ?? null;

  const overdueAmount = loan.installments
    .filter((i) => i.status === InstallmentStatus.OVERDUE)
    .reduce((sum, i) => sum + (Number(i.totalAmount) - Number(i.paidAmount)), 0);

  const installmentsPaid = loan.installments.filter((i) => i.status === InstallmentStatus.PAID).length;

  return {
    outstanding,
    nextInstallment,
    overdueAmount,
    installmentsPaid,
    installmentsTotal: loan.numberOfInstallments,
  };
}
