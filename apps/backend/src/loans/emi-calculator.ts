import Decimal from 'decimal.js';
import { addDaysUtc, addMonthsClamped } from '../common/date-utils';

export type InterestType = 'FLAT' | 'REDUCING' | 'ZERO_COST';
export type InstallmentFrequencyInput = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export interface FeeRuleInput {
  code: string;
  type: 'FLAT' | 'PERCENT_OF_PRINCIPAL';
  amount: number;
}

export interface EmiCalculationInput {
  cashPrice: Decimal.Value;
  downPaymentAmount: Decimal.Value;
  numberOfInstallments: number;
  installmentFrequency: InstallmentFrequencyInput;
  interestType: InterestType;
  interestRateAnnual?: Decimal.Value; // percent, e.g. 18 for 18% p.a.
  feeRules: FeeRuleInput[];
  startDate: Date;
}

export interface EmiInstallmentPlan {
  sequence: number;
  dueDate: Date;
  principalAmount: Decimal;
  chargesAmount: Decimal;
  totalAmount: Decimal;
}

export interface EmiCalculationResult {
  financedPrincipal: Decimal;
  financeCharges: Decimal;
  feesTotal: Decimal;
  totalPayable: Decimal;
  installmentAmount: Decimal; // representative (first) installment amount
  numberOfInstallments: number;
  maturityDate: Date;
  installments: EmiInstallmentPlan[];
}

const PERIODS_PER_YEAR: Record<InstallmentFrequencyInput, number> = {
  WEEKLY: 52,
  BIWEEKLY: 26,
  MONTHLY: 12,
};

/**
 * Deterministic, pure, side-effect-free EMI/amortization engine. Same input
 * always produces the same output (blueprint #7, #26: "deterministic,
 * server-side, testable, versioned"). Money math is done with decimal.js
 * (never native float) and rounding remainders are pushed onto the final
 * installment so that sum(installments) === totalPayable exactly - this is
 * what lets the ledger and receipts reconcile to the paisa (blueprint #43).
 */
export function calculateEmiSchedule(input: EmiCalculationInput): EmiCalculationResult {
  const cashPrice = new Decimal(input.cashPrice);
  const downPayment = new Decimal(input.downPaymentAmount);
  const n = input.numberOfInstallments;

  if (n < 1) throw new Error('numberOfInstallments must be at least 1');
  if (cashPrice.lte(0)) throw new Error('cashPrice must be positive');
  if (downPayment.lt(0)) throw new Error('downPaymentAmount cannot be negative');
  if (downPayment.gt(cashPrice)) throw new Error('downPaymentAmount cannot exceed cashPrice');

  const financedPrincipal = round2(cashPrice.minus(downPayment));

  const financeCharges = calculateFinanceCharges(
    financedPrincipal,
    n,
    input.installmentFrequency,
    input.interestType,
    input.interestRateAnnual,
  );

  const feesTotal = calculateFees(financedPrincipal, input.feeRules);

  const totalPayable = round2(financedPrincipal.plus(financeCharges).plus(feesTotal));
  const totalCharges = round2(financeCharges.plus(feesTotal));

  const installments = buildInstallments(
    financedPrincipal,
    totalCharges,
    n,
    input.installmentFrequency,
    input.startDate,
  );

  return {
    financedPrincipal,
    financeCharges: round2(financeCharges),
    feesTotal: round2(feesTotal),
    totalPayable,
    installmentAmount: installments[0].totalAmount,
    numberOfInstallments: n,
    maturityDate: installments[installments.length - 1].dueDate,
    installments,
  };
}

function calculateFinanceCharges(
  principal: Decimal,
  n: number,
  frequency: InstallmentFrequencyInput,
  interestType: InterestType,
  annualRatePercent?: Decimal.Value,
): Decimal {
  if (interestType === 'ZERO_COST') return new Decimal(0);

  const rate = new Decimal(annualRatePercent ?? 0).dividedBy(100);
  if (rate.lte(0)) return new Decimal(0);

  const periodsPerYear = PERIODS_PER_YEAR[frequency];

  if (interestType === 'FLAT') {
    const tenureYears = new Decimal(n).dividedBy(periodsPerYear);
    return principal.times(rate).times(tenureYears);
  }

  // REDUCING balance: standard amortizing-loan EMI formula.
  const periodicRate = rate.dividedBy(periodsPerYear);
  if (periodicRate.eq(0)) return new Decimal(0);

  const onePlusR = periodicRate.plus(1);
  const compounded = onePlusR.pow(n);
  const emi = principal.times(periodicRate).times(compounded).dividedBy(compounded.minus(1));
  const totalOfPayments = emi.times(n);
  return totalOfPayments.minus(principal);
}

function calculateFees(principal: Decimal, feeRules: FeeRuleInput[]): Decimal {
  return feeRules.reduce((sum, rule) => {
    const amount =
      rule.type === 'FLAT'
        ? new Decimal(rule.amount)
        : principal.times(new Decimal(rule.amount).dividedBy(100));
    return sum.plus(amount);
  }, new Decimal(0));
}

function buildInstallments(
  principal: Decimal,
  totalCharges: Decimal,
  n: number,
  frequency: InstallmentFrequencyInput,
  startDate: Date,
): EmiInstallmentPlan[] {
  const basePrincipal = floor2(principal.dividedBy(n));
  const baseCharges = floor2(totalCharges.dividedBy(n));

  const installments: EmiInstallmentPlan[] = [];
  let principalAllocated = new Decimal(0);
  let chargesAllocated = new Decimal(0);

  for (let seq = 1; seq <= n; seq++) {
    const isLast = seq === n;
    const principalAmount = isLast ? round2(principal.minus(principalAllocated)) : basePrincipal;
    const chargesAmount = isLast ? round2(totalCharges.minus(chargesAllocated)) : baseCharges;

    principalAllocated = principalAllocated.plus(principalAmount);
    chargesAllocated = chargesAllocated.plus(chargesAmount);

    installments.push({
      sequence: seq,
      dueDate: dueDateForSequence(startDate, seq, frequency),
      principalAmount,
      chargesAmount,
      totalAmount: round2(principalAmount.plus(chargesAmount)),
    });
  }

  return installments;
}

function dueDateForSequence(startDate: Date, sequence: number, frequency: InstallmentFrequencyInput): Date {
  switch (frequency) {
    case 'WEEKLY':
      return addDaysUtc(startDate, 7 * sequence);
    case 'BIWEEKLY':
      return addDaysUtc(startDate, 14 * sequence);
    case 'MONTHLY':
    default:
      return addMonthsClamped(startDate, sequence);
  }
}

function round2(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function floor2(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_DOWN);
}
