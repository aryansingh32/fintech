import { SubjectType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { ReportsService } from './reports.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';

/**
 * Integration test against a real (local test) Postgres database, covering
 * the exact bug reported: an EMI that's been partially paid but whose due
 * date has since passed must still show up in the overdue-aging report and
 * the EMI-due report - `status` alone (which gets stuck on PARTIALLY_PAID
 * forever once any money lands on the installment) can't be trusted to mean
 * "not overdue".
 */
describe('ReportsService (integration) - partially-paid overdue visibility', () => {
  const prisma = new PrismaService();
  const ledger = new LedgerService();
  const reports = new ReportsService(prisma, ledger);

  let branchId: string;
  let staffId: string;
  let customerId: string;
  let loanId: string;
  let overdueInstallmentId: string;
  let staffUser: AuthUser;

  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

  beforeAll(async () => {
    await prisma.$connect();

    const branch = await prisma.branch.create({ data: { name: 'Reports Test Branch', code: `RTB-${Date.now()}` } });
    branchId = branch.id;

    const staff = await prisma.staffUser.create({
      data: {
        branchId,
        name: 'Reports Test Staff',
        mobile: `9${Date.now().toString().slice(-9)}`,
        passwordHash: 'unused-in-this-test',
        role: 'OWNER',
        isGlobal: true,
      },
    });
    staffId = staff.id;
    staffUser = { id: staffId, subjectType: SubjectType.STAFF, sessionId: 'test', role: 'OWNER', branchId, isGlobal: true };

    const customer = await prisma.customer.create({
      data: {
        branchId,
        customerCode: `CUST-RPT-${Date.now()}`,
        mobile: `8${Date.now().toString().slice(-9)}`,
        name: 'Reports Test Customer',
      },
    });
    customerId = customer.id;

    const loanProduct = await prisma.loanProduct.create({ data: { name: 'Reports Test Plan' } });
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

    const loan = await prisma.loan.create({
      data: {
        loanNumber: `SPTC-LOAN-RPT-${Date.now()}`,
        customerId,
        branchId,
        loanProductVersionId: version.id,
        cashPrice: '6000',
        downPaymentAmount: '0',
        financedPrincipal: '6000',
        financeCharges: '0',
        feesTotal: '0',
        totalPayable: '6000',
        installmentAmount: '6000',
        numberOfInstallments: 1,
        installmentFrequency: 'MONTHLY',
        startDate: daysAgo(40),
        maturityDate: daysAgo(10),
        status: 'ACTIVE',
        createdByStaffId: staffId,
      },
    });
    loanId = loan.id;

    // Due 10 days ago, partially paid - this is the exact shape of EMI that
    // was invisible to both reports before the fix.
    const installment = await prisma.installment.create({
      data: {
        loanId,
        sequence: 1,
        dueDate: daysAgo(10),
        principalAmount: '6000',
        chargesAmount: '0',
        totalAmount: '6000',
        paidAmount: '1000',
        status: 'PARTIALLY_PAID',
      },
    });
    overdueInstallmentId = installment.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('overdue-aging includes a partially-paid installment whose due date has passed', async () => {
    const buckets = await reports.overdueAging(staffUser, {});
    const allRows = Object.values(buckets).flat() as { loanId: string; overdueAmount: string }[];
    const row = allRows.find((r) => r.loanId === loanId);
    expect(row).toBeDefined();
    expect(row!.overdueAmount).toBe('5000.00');
  });

  it('emi-due includes the same partially-paid overdue installment when its due date falls in the queried window', async () => {
    const rows = await reports.emiDue(staffUser, { fromDate: daysAgo(15).toISOString(), toDate: daysAgo(5).toISOString() });
    expect(rows.some((r) => r.id === overdueInstallmentId)).toBe(true);
  });
});
