import Decimal from 'decimal.js';

export type AllocationComponentInput =
  | 'DOWN_PAYMENT'
  | 'EMI_PRINCIPAL'
  | 'EMI_CHARGES'
  | 'OVERDUE_PENALTY'
  | 'FEE'
  | 'OTHER';

export interface OpenInstallmentState {
  installmentId: string;
  sequence: number;
  dueDate: Date;
  isOverdue: boolean;
  remainingPrincipal: Decimal;
  remainingCharges: Decimal;
}

export interface LoanAllocationState {
  pendingDownPayment: Decimal;
  openInstallments: OpenInstallmentState[]; // must be pre-sorted oldest-due first by caller
}

export interface AllocationLine {
  component: AllocationComponentInput;
  installmentId?: string;
  amount: Decimal;
}

export class AllocationError extends Error {}

/**
 * Produces the system's suggested split for a collected amount: pending
 * down payment first, then overdue installments oldest-first, then upcoming
 * installments in sequence. This is shown to staff as a starting point -
 * blueprint #30 requires staff to be able to override it, which
 * `validateAllocation` below enforces the legality of.
 */
export function computeSuggestedAllocation(
  amount: Decimal.Value,
  state: LoanAllocationState,
): AllocationLine[] {
  let remaining = new Decimal(amount);
  if (remaining.lte(0)) throw new AllocationError('Payment amount must be positive.');

  const lines: AllocationLine[] = [];

  if (state.pendingDownPayment.gt(0) && remaining.gt(0)) {
    const take = Decimal.min(remaining, state.pendingDownPayment);
    if (take.gt(0)) {
      lines.push({ component: 'DOWN_PAYMENT', amount: take });
      remaining = remaining.minus(take);
    }
  }

  const sortedInstallments = [...state.openInstallments].sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    return a.sequence - b.sequence;
  });

  for (const installment of sortedInstallments) {
    if (remaining.lte(0)) break;

    if (installment.remainingPrincipal.gt(0)) {
      const take = Decimal.min(remaining, installment.remainingPrincipal);
      if (take.gt(0)) {
        lines.push({ component: 'EMI_PRINCIPAL', installmentId: installment.installmentId, amount: take });
        remaining = remaining.minus(take);
      }
    }

    if (remaining.gt(0) && installment.remainingCharges.gt(0)) {
      const take = Decimal.min(remaining, installment.remainingCharges);
      if (take.gt(0)) {
        lines.push({
          component: installment.isOverdue ? 'OVERDUE_PENALTY' : 'EMI_CHARGES',
          installmentId: installment.installmentId,
          amount: take,
        });
        remaining = remaining.minus(take);
      }
    }
  }

  if (remaining.gt(0)) {
    // Nothing left to allocate against (loan is otherwise settled) - staff
    // must explicitly decide where an excess amount goes (e.g. advance
    // credit or refund); the engine never invents a destination for it.
    lines.push({ component: 'OTHER', amount: remaining });
  }

  return lines;
}

/**
 * Validates a staff-specified (possibly manually edited) allocation against
 * the loan's actual open balances. Never trusts the client's arithmetic:
 * every line is checked against server-known remaining capacity, and the
 * total must equal the collected amount exactly.
 */
export function validateAllocation(
  amount: Decimal.Value,
  lines: AllocationLine[],
  state: LoanAllocationState,
): void {
  const total = new Decimal(amount);
  if (total.lte(0)) throw new AllocationError('Payment amount must be positive.');
  if (lines.length === 0) throw new AllocationError('Allocation must contain at least one line.');

  const sumOfLines = lines.reduce((sum, l) => sum.plus(l.amount), new Decimal(0));
  if (!sumOfLines.eq(total)) {
    throw new AllocationError(
      `Allocation total (${sumOfLines.toFixed(2)}) does not match payment amount (${total.toFixed(2)}).`,
    );
  }

  for (const line of lines) {
    if (line.amount.lte(0)) {
      throw new AllocationError('Each allocation line must be a positive amount.');
    }
  }

  const downPaymentLines = lines.filter((l) => l.component === 'DOWN_PAYMENT');
  const downPaymentSum = downPaymentLines.reduce((s, l) => s.plus(l.amount), new Decimal(0));
  if (downPaymentSum.gt(state.pendingDownPayment)) {
    throw new AllocationError(
      `Down payment allocation (${downPaymentSum.toFixed(2)}) exceeds pending down payment (${state.pendingDownPayment.toFixed(2)}).`,
    );
  }

  const installmentById = new Map(state.openInstallments.map((i) => [i.installmentId, i]));
  const principalAllocated = new Map<string, Decimal>();
  const chargesAllocated = new Map<string, Decimal>();

  for (const line of lines) {
    if (line.component === 'EMI_PRINCIPAL' || line.component === 'EMI_CHARGES' || line.component === 'OVERDUE_PENALTY') {
      if (!line.installmentId) {
        throw new AllocationError(`${line.component} allocation must reference an installment.`);
      }
      const installment = installmentById.get(line.installmentId);
      if (!installment) {
        throw new AllocationError(`Installment ${line.installmentId} is not open on this loan.`);
      }

      if (line.component === 'EMI_PRINCIPAL') {
        const soFar = principalAllocated.get(line.installmentId) ?? new Decimal(0);
        const next = soFar.plus(line.amount);
        if (next.gt(installment.remainingPrincipal)) {
          throw new AllocationError(
            `Principal allocation for installment #${installment.sequence} exceeds its remaining balance.`,
          );
        }
        principalAllocated.set(line.installmentId, next);
      } else {
        const soFar = chargesAllocated.get(line.installmentId) ?? new Decimal(0);
        const next = soFar.plus(line.amount);
        if (next.gt(installment.remainingCharges)) {
          throw new AllocationError(
            `Charges allocation for installment #${installment.sequence} exceeds its remaining balance.`,
          );
        }
        chargesAllocated.set(line.installmentId, next);
      }
    }
  }
}
