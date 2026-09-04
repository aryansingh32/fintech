import { AuditActorType, PaymentSource, PaymentStatus, SubjectType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../ledger/ledger.service';
import { PaymentsService } from './payments.service';
import { ReversalService } from './reversal.service';
import { calculateEmiSchedule } from '../loans/emi-calculator';
import { AuthUser } from '../common/interfaces/auth-user.interface';

/**
 * Integration tests against a real (local test) Postgres database - these
 * exercise the acceptance criteria from the blueprint (#61) that a pure unit
 * test cannot: DB-level unique constraints, transaction atomicity, and
 * cross-table balance reconciliation.
 */
describe('PaymentsService (integration)', () => {
  const prisma = new PrismaService();
  const ledger = new LedgerService();
  const audit = new AuditService(prisma);
  const payments = new PaymentsService(prisma, ledger, audit);
  const reversals = new ReversalService(prisma, ledger, audit);

  let branchId: string;
  let staffId: string;
  let customerId: string;
  let loanId: string;
  let installmentIds: string[];
  let staffUser: AuthUser;

  beforeAll(async () => {
    await prisma.$connect();

    const branch = await prisma.branch.create({
      data: { name: 'Test Branch', code: `TB-${Date.now()}` },
    });
    branchId = branch.id;

    const staff = await prisma.staffUser.create({
      data: {
        branchId,
        name: 'Test Shopkeeper',
        mobile: `9${Date.now().toString().slice(-9)}`,
        passwordHash: 'unused-in-this-test',
        role: 'SHOPKEEPER',
      },
    });
    staffId = staff.id;
    staffUser = {
      id: staffId,
      subjectType: SubjectType.STAFF,
      sessionId: 'test-session',
      role: 'SHOPKEEPER',
      branchId,
      isGlobal: false,
    };

    const customer = await prisma.customer.create({
      data: {
        branchId,
        customerCode: `CUST-TEST-${Date.now()}`,
        mobile: `8${Date.now().toString().slice(-9)}`,
        name: 'Test Customer',
      },
    });
    customerId = customer.id;

    const loanProduct = await prisma.loanProduct.create({ data: { name: 'Test Plan' } });
    const version = await prisma.loanProductVersion.create({
      data: {
        loanProductId: loanProduct.id,
        versionNumber: 1,
        interestType: 'ZERO_COST',
        minInstallments: 1,
        maxInstallments: 12,
        feeRules: [],
        latePaymentRules: {},
        partialPaymentRules: { allowed: true },
        prepaymentRules: { allowed: true },
        earlyClosureRules: { allowed: true },
        settlementRules: {},
        waiverRules: {},
        reversalRules: {},
      },
    });

    const schedule = calculateEmiSchedule({
      cashPrice: 20000,
      downPaymentAmount: 2000,
      numberOfInstallments: 3,
      installmentFrequency: 'MONTHLY',
      interestType: 'ZERO_COST',
      feeRules: [],
      startDate: new Date('2026-01-01T00:00:00Z'),
    });

    const loan = await prisma.loan.create({
      data: {
        loanNumber: `SPTC-LOAN-TEST-${Date.now()}`,
        customerId,
        branchId,
        loanProductVersionId: version.id,
        cashPrice: '20000',
        downPaymentAmount: '2000',
        financedPrincipal: schedule.financedPrincipal.toFixed(2),
        financeCharges: schedule.financeCharges.toFixed(2),
        feesTotal: schedule.feesTotal.toFixed(2),
        totalPayable: schedule.totalPayable.toFixed(2),
        installmentAmount: schedule.installmentAmount.toFixed(2),
        numberOfInstallments: schedule.numberOfInstallments,
        installmentFrequency: 'MONTHLY',
        startDate: new Date('2026-01-01T00:00:00Z'),
        maturityDate: schedule.maturityDate,
        status: 'ACTIVE',
        createdByStaffId: staffId,
      },
    });
    loanId = loan.id;

    const created = await Promise.all(
      schedule.installments.map((i) =>
        prisma.installment.create({
          data: {
            loanId,
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
    installmentIds = created.sort((a, b) => a.sequence - b.sequence).map((i) => i.id);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('TEST 1: collecting a payment creates exactly one payment, one receipt, correct allocation and balances', async () => {
    const idempotencyKey = `idem-${Date.now()}-1`;

    const { payment, receipt, idempotentReplay } = await payments.collectPayment({
      loanId,
      amount: 2000, // exactly the pending down payment
      method: 'CASH',
      idempotencyKey,
      source: PaymentSource.STAFF_COLLECTED,
      collectedByStaffId: staffId,
      branchId,
      requestingUser: staffUser,
      actor: { actorType: AuditActorType.STAFF, actorId: staffId, role: 'SHOPKEEPER' },
    });

    expect(idempotentReplay).toBe(false);
    expect(payment.status).toBe(PaymentStatus.SUCCESSFUL);
    expect(payment.allocations).toHaveLength(1);
    expect(payment.allocations[0].component).toBe('DOWN_PAYMENT');
    expect(receipt.previousBalance.toFixed(2)).toBe('20000.00');
    expect(receipt.newBalance.toFixed(2)).toBe('18000.00');

    const loan = await prisma.loan.findUniqueOrThrow({ where: { id: loanId } });
    expect(loan.downPaymentPaid.toFixed(2)).toBe('2000.00');

    const paymentCount = await prisma.payment.count({ where: { loanId } });
    expect(paymentCount).toBe(1);

    const auditCount = await prisma.auditEvent.count({
      where: { entityType: 'Payment', entityId: payment.id, action: 'PAYMENT_CREATED' },
    });
    expect(auditCount).toBe(1);
  });

  it('TEST 2: replaying the same idempotency key never creates a second payment', async () => {
    const idempotencyKey = `idem-${Date.now()}-2`;
    const request = {
      loanId,
      amount: 6666.67,
      method: 'CASH' as const,
      idempotencyKey,
      source: PaymentSource.STAFF_COLLECTED,
      collectedByStaffId: staffId,
      branchId,
      requestingUser: staffUser,
      actor: { actorType: AuditActorType.STAFF, actorId: staffId, role: 'SHOPKEEPER' },
    };

    const [first, second, third] = await Promise.all([
      payments.collectPayment(request),
      payments.collectPayment(request),
      payments.collectPayment(request),
    ]);

    expect(first.payment.id).toBe(second.payment.id);
    expect(second.payment.id).toBe(third.payment.id);

    const countWithThisKey = await prisma.payment.count({ where: { idempotencyKey } });
    expect(countWithThisKey).toBe(1);
  });

  it('supports a partial payment against a single installment', async () => {
    const installmentBefore = await prisma.installment.findUniqueOrThrow({
      where: { id: installmentIds[2] },
    });
    const remainingPrincipal = Number(installmentBefore.principalAmount) - Number(installmentBefore.paidAmount);

    const partialAmount = Math.min(500, remainingPrincipal);
    const { payment } = await payments.collectPayment({
      loanId,
      amount: partialAmount,
      method: 'CASH',
      idempotencyKey: `idem-${Date.now()}-partial`,
      allocation: [
        { component: 'EMI_PRINCIPAL' as const, installmentId: installmentIds[2], amount: partialAmount },
      ],
      source: PaymentSource.STAFF_COLLECTED,
      collectedByStaffId: staffId,
      branchId,
      requestingUser: staffUser,
      actor: { actorType: AuditActorType.STAFF, actorId: staffId, role: 'SHOPKEEPER' },
    });

    expect(payment.status).toBe(PaymentStatus.SUCCESSFUL);
    const installmentAfter = await prisma.installment.findUniqueOrThrow({
      where: { id: installmentIds[2] },
    });
    expect(installmentAfter.status).toBe('PARTIALLY_PAID');
    expect(Number(installmentAfter.paidAmount)).toBeCloseTo(
      Number(installmentBefore.paidAmount) + partialAmount,
      2,
    );
  });

  it('TEST 6: reversing a payment preserves the original row and restores balances', async () => {
    const idempotencyKey = `idem-${Date.now()}-reversal`;
    const { payment } = await payments.collectPayment({
      loanId,
      amount: 100,
      method: 'CASH',
      idempotencyKey,
      allocation: [{ component: 'EMI_PRINCIPAL' as const, installmentId: installmentIds[1], amount: 100 }],
      source: PaymentSource.STAFF_COLLECTED,
      collectedByStaffId: staffId,
      branchId,
      requestingUser: staffUser,
      actor: { actorType: AuditActorType.STAFF, actorId: staffId, role: 'SHOPKEEPER' },
    });

    const installmentBeforeReversal = await prisma.installment.findUniqueOrThrow({
      where: { id: installmentIds[1] },
    });

    const reversal = await reversals.reverse({
      paymentId: payment.id,
      reason: 'Customer disputed the charge',
      initiatedByStaffId: staffId,
      actor: { role: 'SHOPKEEPER' },
    });

    const reversedPayment = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(reversedPayment.status).toBe(PaymentStatus.REVERSED);
    // Original payment row is NOT deleted.
    expect(reversedPayment.id).toBe(payment.id);
    expect(reversedPayment.amount.toFixed(2)).toBe('100.00');

    const installmentAfterReversal = await prisma.installment.findUniqueOrThrow({
      where: { id: installmentIds[1] },
    });
    expect(Number(installmentAfterReversal.paidAmount)).toBeCloseTo(
      Number(installmentBeforeReversal.paidAmount) - 100,
      2,
    );

    const auditCount = await prisma.auditEvent.count({
      where: { entityType: 'Payment', entityId: payment.id, action: 'PAYMENT_REVERSED' },
    });
    expect(auditCount).toBe(1);
    expect(reversal.originalPaymentId).toBe(payment.id);
  });

  it('rejects a collection agent from another branch collecting on this loan', async () => {
    const otherBranch = await prisma.branch.create({ data: { name: 'Other Branch', code: `OB-${Date.now()}` } });
    const outsiderUser: AuthUser = {
      id: 'outsider-staff',
      subjectType: SubjectType.STAFF,
      sessionId: 'outsider-session',
      role: 'COLLECTION_AGENT',
      branchId: otherBranch.id,
      isGlobal: false,
    };

    await expect(
      payments.collectPayment({
        loanId,
        amount: 10,
        method: 'CASH',
        idempotencyKey: `idem-${Date.now()}-outsider`,
        source: PaymentSource.STAFF_COLLECTED,
        collectedByStaffId: 'outsider-staff',
        branchId: otherBranch.id,
        requestingUser: outsiderUser,
        actor: { actorType: AuditActorType.STAFF, actorId: 'outsider-staff', role: 'COLLECTION_AGENT' },
      }),
    ).rejects.toThrow(/access/i);
  });
});
