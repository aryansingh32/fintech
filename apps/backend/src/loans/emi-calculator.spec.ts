import Decimal from 'decimal.js';
import { calculateEmiSchedule } from './emi-calculator';

const D = (v: Decimal.Value) => new Decimal(v);

describe('calculateEmiSchedule', () => {
  it('is deterministic: identical input always produces identical output', () => {
    const input = {
      cashPrice: 30000,
      downPaymentAmount: 5000,
      numberOfInstallments: 6,
      installmentFrequency: 'MONTHLY' as const,
      interestType: 'REDUCING' as const,
      interestRateAnnual: 18,
      feeRules: [{ code: 'PROCESSING_FEE', type: 'FLAT' as const, amount: 199 }],
      startDate: new Date('2026-01-15T00:00:00Z'),
    };

    const first = calculateEmiSchedule(input);
    const second = calculateEmiSchedule(input);

    expect(first.totalPayable.toFixed(2)).toBe(second.totalPayable.toFixed(2));
    expect(first.installments.map((i) => i.totalAmount.toFixed(2))).toEqual(
      second.installments.map((i) => i.totalAmount.toFixed(2)),
    );
    expect(first.maturityDate.toISOString()).toBe(second.maturityDate.toISOString());
  });

  it('ZERO_COST plan: no finance charges, principal fully spread across installments', () => {
    const result = calculateEmiSchedule({
      cashPrice: 24000,
      downPaymentAmount: 4000,
      numberOfInstallments: 4,
      installmentFrequency: 'MONTHLY',
      interestType: 'ZERO_COST',
      feeRules: [],
      startDate: new Date('2026-02-01T00:00:00Z'),
    });

    expect(result.financedPrincipal.toFixed(2)).toBe('20000.00');
    expect(result.financeCharges.toFixed(2)).toBe('0.00');
    expect(result.totalPayable.toFixed(2)).toBe('20000.00');
    expect(result.installments).toHaveLength(4);
    expect(result.installments[0].totalAmount.toFixed(2)).toBe('5000.00');
  });

  it('every installment sum reconciles exactly to totalPayable (no rounding drift)', () => {
    // A principal chosen specifically to NOT divide evenly across installments.
    const result = calculateEmiSchedule({
      cashPrice: 10000,
      downPaymentAmount: 0,
      numberOfInstallments: 7,
      installmentFrequency: 'MONTHLY',
      interestType: 'REDUCING',
      interestRateAnnual: 24,
      feeRules: [{ code: 'FEE', type: 'FLAT', amount: 50 }],
      startDate: new Date('2026-03-10T00:00:00Z'),
    });

    const sumOfInstallments = result.installments.reduce(
      (acc, i) => acc.plus(i.totalAmount),
      new Decimal(0),
    );
    const sumOfPrincipal = result.installments.reduce(
      (acc, i) => acc.plus(i.principalAmount),
      new Decimal(0),
    );

    expect(sumOfInstallments.toFixed(2)).toBe(result.totalPayable.toFixed(2));
    expect(sumOfPrincipal.toFixed(2)).toBe(result.financedPrincipal.toFixed(2));
  });

  it('REDUCING balance produces a smaller total payable than FLAT for the same nominal rate', () => {
    const base = {
      cashPrice: 50000,
      downPaymentAmount: 0,
      numberOfInstallments: 12,
      installmentFrequency: 'MONTHLY' as const,
      interestRateAnnual: 20,
      feeRules: [],
      startDate: new Date('2026-01-01T00:00:00Z'),
    };

    const flat = calculateEmiSchedule({ ...base, interestType: 'FLAT' });
    const reducing = calculateEmiSchedule({ ...base, interestType: 'REDUCING' });

    expect(reducing.totalPayable.lessThan(flat.totalPayable)).toBe(true);
  });

  it('monthly due dates clamp correctly across month-end boundaries (31 Jan -> 28/29 Feb)', () => {
    const result = calculateEmiSchedule({
      cashPrice: 6000,
      downPaymentAmount: 0,
      numberOfInstallments: 3,
      installmentFrequency: 'MONTHLY',
      interestType: 'ZERO_COST',
      feeRules: [],
      startDate: new Date('2026-01-31T00:00:00Z'),
    });

    expect(result.installments[0].dueDate.toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(result.installments[1].dueDate.toISOString().slice(0, 10)).toBe('2026-03-31');
    expect(result.installments[2].dueDate.toISOString().slice(0, 10)).toBe('2026-04-30');
  });

  it('weekly frequency spaces installments 7 days apart', () => {
    const result = calculateEmiSchedule({
      cashPrice: 2000,
      downPaymentAmount: 0,
      numberOfInstallments: 4,
      installmentFrequency: 'WEEKLY',
      interestType: 'ZERO_COST',
      feeRules: [],
      startDate: new Date('2026-05-01T00:00:00Z'),
    });

    expect(result.installments[0].dueDate.toISOString().slice(0, 10)).toBe('2026-05-08');
    expect(result.installments[3].dueDate.toISOString().slice(0, 10)).toBe('2026-05-29');
  });

  it('rejects a down payment greater than the cash price', () => {
    expect(() =>
      calculateEmiSchedule({
        cashPrice: 1000,
        downPaymentAmount: 1500,
        numberOfInstallments: 3,
        installmentFrequency: 'MONTHLY',
        interestType: 'ZERO_COST',
        feeRules: [],
        startDate: new Date('2026-01-01T00:00:00Z'),
      }),
    ).toThrow();
  });

  it('rejects a non-positive cash price', () => {
    expect(() =>
      calculateEmiSchedule({
        cashPrice: 0,
        downPaymentAmount: 0,
        numberOfInstallments: 3,
        installmentFrequency: 'MONTHLY',
        interestType: 'ZERO_COST',
        feeRules: [],
        startDate: new Date('2026-01-01T00:00:00Z'),
      }),
    ).toThrow();
  });

  it('percent-of-principal fee rules scale with the financed principal', () => {
    const result = calculateEmiSchedule({
      cashPrice: 10000,
      downPaymentAmount: 0,
      numberOfInstallments: 5,
      installmentFrequency: 'MONTHLY',
      interestType: 'ZERO_COST',
      feeRules: [{ code: 'PROCESSING_FEE', type: 'PERCENT_OF_PRINCIPAL', amount: 2 }],
      startDate: new Date('2026-01-01T00:00:00Z'),
    });

    expect(result.feesTotal.toFixed(2)).toBe('200.00');
    expect(result.totalPayable.toFixed(2)).toBe('10200.00');
  });

  it('single-installment (n=1) plan places the full amount in installment 1', () => {
    const result = calculateEmiSchedule({
      cashPrice: 5000,
      downPaymentAmount: 1000,
      numberOfInstallments: 1,
      installmentFrequency: 'MONTHLY',
      interestType: 'ZERO_COST',
      feeRules: [],
      startDate: new Date('2026-01-01T00:00:00Z'),
    });

    expect(result.installments).toHaveLength(1);
    expect(result.installments[0].totalAmount.toFixed(2)).toBe('4000.00');
  });
});
