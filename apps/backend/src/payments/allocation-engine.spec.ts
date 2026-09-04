import Decimal from 'decimal.js';
import {
  AllocationError,
  computeSuggestedAllocation,
  LoanAllocationState,
  validateAllocation,
} from './allocation-engine';

const D = (v: Decimal.Value) => new Decimal(v);

function state(overrides: Partial<LoanAllocationState> = {}): LoanAllocationState {
  return {
    pendingDownPayment: D(0),
    openInstallments: [],
    ...overrides,
  };
}

describe('computeSuggestedAllocation', () => {
  it('matches the blueprint example: 5000 collected, 2000 pending down payment -> 2000 DP + 3000 EMI', () => {
    const loanState = state({
      pendingDownPayment: D(2000),
      openInstallments: [
        {
          installmentId: 'inst-1',
          sequence: 1,
          dueDate: new Date('2026-04-12'),
          isOverdue: false,
          remainingPrincipal: D(2500),
          remainingCharges: D(750),
        },
      ],
    });

    const lines = computeSuggestedAllocation(5000, loanState);

    expect(lines).toEqual([
      { component: 'DOWN_PAYMENT', amount: D(2000) },
      { component: 'EMI_PRINCIPAL', installmentId: 'inst-1', amount: D(2500) },
      { component: 'EMI_CHARGES', installmentId: 'inst-1', amount: D(500) },
    ]);

    const total = lines.reduce((sum, l) => sum.plus(l.amount), D(0));
    expect(total.toFixed(2)).toBe('5000.00');
  });

  it('prioritizes overdue installments over upcoming ones', () => {
    const loanState = state({
      openInstallments: [
        {
          installmentId: 'upcoming',
          sequence: 2,
          dueDate: new Date('2026-06-01'),
          isOverdue: false,
          remainingPrincipal: D(1000),
          remainingCharges: D(0),
        },
        {
          installmentId: 'overdue',
          sequence: 1,
          dueDate: new Date('2026-05-01'),
          isOverdue: true,
          remainingPrincipal: D(1000),
          remainingCharges: D(0),
        },
      ],
    });

    const lines = computeSuggestedAllocation(1000, loanState);
    expect(lines[0].installmentId).toBe('overdue');
  });

  it('routes an amount exceeding all open balances to OTHER instead of guessing', () => {
    const loanState = state({ pendingDownPayment: D(100) });
    const lines = computeSuggestedAllocation(500, loanState);

    expect(lines).toEqual([
      { component: 'DOWN_PAYMENT', amount: D(100) },
      { component: 'OTHER', amount: D(400) },
    ]);
  });

  it('rejects a non-positive amount', () => {
    expect(() => computeSuggestedAllocation(0, state())).toThrow(AllocationError);
    expect(() => computeSuggestedAllocation(-10, state())).toThrow(AllocationError);
  });
});

describe('validateAllocation (partial payment support)', () => {
  const loanState = state({
    pendingDownPayment: D(2000),
    openInstallments: [
      {
        installmentId: 'inst-1',
        sequence: 1,
        dueDate: new Date('2026-04-12'),
        isOverdue: false,
        remainingPrincipal: D(2500),
        remainingCharges: D(750),
      },
    ],
  });

  it('accepts a partial payment against a single installment (2000 of a 5000 EMI)', () => {
    expect(() =>
      validateAllocation(
        2000,
        [{ component: 'EMI_PRINCIPAL', installmentId: 'inst-1', amount: D(2000) }],
        state({ openInstallments: loanState.openInstallments }),
      ),
    ).not.toThrow();
  });

  it('rejects when the allocation total does not match the payment amount', () => {
    expect(() =>
      validateAllocation(
        5000,
        [{ component: 'DOWN_PAYMENT', amount: D(2000) }, { component: 'EMI_PRINCIPAL', installmentId: 'inst-1', amount: D(2500) }],
        loanState,
      ),
    ).toThrow(AllocationError);
  });

  it('rejects over-allocating the down payment beyond what is pending', () => {
    expect(() =>
      validateAllocation(3000, [{ component: 'DOWN_PAYMENT', amount: D(3000) }], loanState),
    ).toThrow(/exceeds pending down payment/);
  });

  it('rejects over-allocating an installment principal beyond its remaining balance', () => {
    expect(() =>
      validateAllocation(
        3000,
        [{ component: 'EMI_PRINCIPAL', installmentId: 'inst-1', amount: D(3000) }],
        loanState,
      ),
    ).toThrow(/exceeds its remaining balance/);
  });

  it('rejects an EMI allocation line with no installmentId', () => {
    expect(() =>
      validateAllocation(100, [{ component: 'EMI_PRINCIPAL', amount: D(100) }], loanState),
    ).toThrow(/must reference an installment/);
  });

  it('rejects a zero or negative line amount', () => {
    expect(() =>
      validateAllocation(
        0,
        [{ component: 'EMI_PRINCIPAL', installmentId: 'inst-1', amount: D(0) }],
        loanState,
      ),
    ).toThrow(AllocationError);
  });

  it('accepts an allocation that exactly exhausts down payment + full installment (the blueprint example)', () => {
    expect(() =>
      validateAllocation(
        5000,
        [
          { component: 'DOWN_PAYMENT', amount: D(2000) },
          { component: 'EMI_PRINCIPAL', installmentId: 'inst-1', amount: D(2500) },
          { component: 'EMI_CHARGES', installmentId: 'inst-1', amount: D(500) },
        ],
        loanState,
      ),
    ).not.toThrow();
  });
});
