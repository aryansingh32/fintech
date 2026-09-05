import 'reflect-metadata';
import '../src/common/decimal-serialization';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { calculateEmiSchedule } from '../src/loans/emi-calculator';

describe('Support / Reports / Offline Sync (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let agentToken: string;
  let customerToken: string;
  let customerId: string;
  let loanId: string;
  const device = { deviceIdentifier: `device-${Date.now()}`, platform: 'ANDROID' as const };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    const branch = await prisma.branch.create({ data: { name: 'SRS Branch', code: `SRS-${Date.now()}` } });

    const ownerMobile = `9${Date.now().toString().slice(-9)}`;
    await prisma.staffUser.create({
      data: {
        branchId: branch.id,
        name: 'SRS Owner',
        mobile: ownerMobile,
        passwordHash: await argon2.hash('SuperSecret123'),
        role: 'OWNER',
        isGlobal: true,
      },
    });
    ownerToken = await staffLogin(app, ownerMobile, 'SuperSecret123', { ...device, deviceIdentifier: `${device.deviceIdentifier}-owner` });

    const agentMobile = `9${(Date.now() + 1).toString().slice(-9)}`;
    await prisma.staffUser.create({
      data: {
        branchId: branch.id,
        name: 'SRS Collection Agent',
        mobile: agentMobile,
        passwordHash: await argon2.hash('SuperSecret123'),
        role: 'COLLECTION_AGENT',
      },
    });
    agentToken = await staffLogin(app, agentMobile, 'SuperSecret123', { ...device, deviceIdentifier: `${device.deviceIdentifier}-agent` });

    // Customer via OTP flow (mirrors what the Customer App actually does).
    const customerMobile = `8${Date.now().toString().slice(-9)}`;
    const otpRes = await request(app.getHttpServer())
      .post('/v1/auth/customer/otp/request')
      .send({ mobile: customerMobile })
      .expect(201);
    const verifyRes = await request(app.getHttpServer())
      .post('/v1/auth/customer/otp/verify')
      .send({ mobile: customerMobile, otp: otpRes.body.devOtp, device: { ...device, deviceIdentifier: `${device.deviceIdentifier}-cust` } })
      .expect(201);
    customerToken = verifyRes.body.accessToken;
    customerId = verifyRes.body.customerId;
    await prisma.customer.update({ where: { id: customerId }, data: { branchId: branch.id } });

    // Loan set up directly via Prisma (already covered end-to-end via HTTP in loan-lifecycle.e2e.spec.ts).
    const loanProduct = await prisma.loanProduct.create({ data: { name: 'SRS Plan' } });
    const version = await prisma.loanProductVersion.create({
      data: {
        loanProductId: loanProduct.id,
        versionNumber: 1,
        interestType: 'ZERO_COST',
        minInstallments: 1,
        maxInstallments: 12,
        feeRules: [],
        latePaymentRules: {},
        partialPaymentRules: {},
        prepaymentRules: {},
        earlyClosureRules: {},
        settlementRules: {},
        waiverRules: {},
        reversalRules: {},
      },
    });
    const schedule = calculateEmiSchedule({
      cashPrice: 12000,
      downPaymentAmount: 0,
      numberOfInstallments: 3,
      installmentFrequency: 'MONTHLY',
      interestType: 'ZERO_COST',
      feeRules: [],
      startDate: new Date(),
    });
    const owner = await prisma.staffUser.findFirstOrThrow({ where: { mobile: ownerMobile } });
    const loan = await prisma.loan.create({
      data: {
        loanNumber: `SPTC-LOAN-SRS-${Date.now()}`,
        customerId,
        branchId: branch.id,
        loanProductVersionId: version.id,
        cashPrice: '12000',
        downPaymentAmount: '0',
        financedPrincipal: schedule.financedPrincipal.toFixed(2),
        financeCharges: schedule.financeCharges.toFixed(2),
        feesTotal: schedule.feesTotal.toFixed(2),
        totalPayable: schedule.totalPayable.toFixed(2),
        installmentAmount: schedule.installmentAmount.toFixed(2),
        numberOfInstallments: 3,
        installmentFrequency: 'MONTHLY',
        startDate: new Date(),
        maturityDate: schedule.maturityDate,
        status: 'ACTIVE',
        createdByStaffId: owner.id,
      },
    });
    loanId = loan.id;
    await Promise.all(
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
  });

  afterAll(async () => {
    await app.close();
  });

  let ticketId: string;

  it('customer opens a support ticket', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/support/tickets')
      .set(bearer(customerToken))
      .send({ category: 'PAYMENT', message: 'My EMI amount looks wrong.' })
      .expect(201);
    ticketId = res.body.id;
    expect(res.body.status).toBe('OPEN');
    expect(res.body.messages).toHaveLength(1);
  });

  it('a collection agent (no SUPPORT_VIEW permission) cannot list support tickets', async () => {
    await request(app.getHttpServer()).get('/v1/support/tickets').set(bearer(agentToken)).expect(403);
  });

  it('owner sees the ticket, replies, and the ticket moves to IN_PROGRESS', async () => {
    const listRes = await request(app.getHttpServer()).get('/v1/support/tickets').set(bearer(ownerToken)).expect(200);
    expect(listRes.body.some((t: { id: string }) => t.id === ticketId)).toBe(true);

    await request(app.getHttpServer())
      .post(`/v1/support/tickets/${ticketId}/messages`)
      .set(bearer(ownerToken))
      .send({ message: 'Looking into it now.' })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/v1/support/tickets/${ticketId}`)
      .set(bearer(ownerToken))
      .expect(200);
    expect(detail.body.status).toBe('IN_PROGRESS');
    expect(detail.body.messages).toHaveLength(2);
  });

  it('a collection agent (no REPORTS_VIEW_BRANCH permission) cannot view reports', async () => {
    await request(app.getHttpServer()).get('/v1/reports/loan-portfolio').set(bearer(agentToken)).expect(403);
  });

  it('owner can view the loan portfolio and overdue aging reports', async () => {
    const portfolio = await request(app.getHttpServer())
      .get('/v1/reports/loan-portfolio')
      .set(bearer(ownerToken))
      .expect(200);
    expect(Array.isArray(portfolio.body)).toBe(true);
    expect(portfolio.body.some((row: { status: string }) => row.status === 'ACTIVE')).toBe(true);

    const aging = await request(app.getHttpServer())
      .get('/v1/reports/overdue-aging')
      .set(bearer(ownerToken))
      .expect(200);
    expect(aging.body).toHaveProperty('1-7');
  });

  it('offline payment sync is idempotent by clientTransactionId', async () => {
    const clientTransactionId = `offline-${Date.now()}`;
    const payload = {
      payments: [
        {
          loanId,
          amount: 4000,
          method: 'CASH',
          idempotencyKey: 'client-supplied-ignored',
          clientTransactionId,
        },
      ],
    };

    const firstRes = await request(app.getHttpServer())
      .post('/v1/sync/payments/batch')
      .set(bearer(ownerToken))
      .send(payload)
      .expect(201);
    expect(firstRes.body[0].status).toBe('SYNCED');
    const paymentId = firstRes.body[0].paymentId;

    // Simulates the device retrying the same queued item after a dropped
    // connection - must not create a second payment.
    const secondRes = await request(app.getHttpServer())
      .post('/v1/sync/payments/batch')
      .set(bearer(ownerToken))
      .send(payload)
      .expect(201);
    expect(secondRes.body[0].status).toBe('ALREADY_SYNCED');
    expect(secondRes.body[0].paymentId).toBe(paymentId);

    const count = await prisma.payment.count({ where: { clientTransactionId } });
    expect(count).toBe(1);
  });

  it('offline sync pull returns branch-scoped data for the staff member', async () => {
    const res = await request(app.getHttpServer()).get('/v1/sync/pull').set(bearer(ownerToken)).expect(200);
    expect(res.body.customers.some((c: { id: string }) => c.id === customerId)).toBe(true);
    expect(res.body.loans.some((l: { id: string }) => l.id === loanId)).toBe(true);
  });
});

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function staffLogin(
  app: INestApplication,
  mobile: string,
  password: string,
  device: { deviceIdentifier: string; platform: 'ANDROID' },
): Promise<string> {
  const loginRes = await request(app.getHttpServer())
    .post('/v1/auth/staff/login')
    .send({ mobile, password, device })
    .expect(201);
  const verifyRes = await request(app.getHttpServer())
    .post('/v1/auth/staff/device/verify')
    .send({ mobile, otp: loginRes.body.devOtp, device })
    .expect(201);
  return verifyRes.body.accessToken;
}
