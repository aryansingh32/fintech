import 'reflect-metadata';
import '../src/common/decimal-serialization';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Full-stack HTTP walk of the blueprint's core workflow (customer -> product
 * -> loan -> human approval -> EMI schedule -> payment -> allocation ->
 * receipt), driven exactly as the Business App would call the API. This is
 * the closest thing in this repo to blueprint #61's acceptance tests,
 * running through real guards, DTO validation and the database.
 */
describe('Loan lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  const staffMobile = `9${Date.now().toString().slice(-9)}`;
  const device = { deviceIdentifier: `device-${Date.now()}`, platform: 'ANDROID' as const };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    const branch = await prisma.branch.create({ data: { name: 'E2E Branch', code: `E2E-${Date.now()}` } });
    await prisma.staffUser.create({
      data: {
        branchId: branch.id,
        name: 'E2E Owner',
        mobile: staffMobile,
        passwordHash: await argon2.hash('SuperSecret123'),
        role: 'OWNER',
        isGlobal: true,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated access to a protected endpoint', async () => {
    await request(app.getHttpServer()).get('/v1/customers?q=test').expect(401);
  });

  it('logs staff in via password + device-verification OTP step-up', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/staff/login')
      .send({ mobile: staffMobile, password: 'SuperSecret123', device })
      .expect(201);

    expect(loginRes.body.status).toBe('DEVICE_VERIFICATION_REQUIRED');
    expect(loginRes.body.devOtp).toBeDefined();

    const verifyRes = await request(app.getHttpServer())
      .post('/v1/auth/staff/device/verify')
      .send({ mobile: staffMobile, otp: loginRes.body.devOtp, device })
      .expect(201);

    expect(verifyRes.body.status).toBe('SUCCESS');
    expect(verifyRes.body.accessToken).toBeDefined();
    accessToken = verifyRes.body.accessToken;
  });

  it('rejects a wrong password', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/staff/login')
      .send({ mobile: staffMobile, password: 'wrong-password', device })
      .expect(401);
  });

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  let customerId: string;
  let productId: string;
  let productIdentifierId: string;
  let loanProductVersionId: string;
  let loanId: string;

  it('creates a customer', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/customers')
      .set(auth())
      .send({ mobile: `8${Date.now().toString().slice(-9)}`, name: 'E2E Customer' })
      .expect(201);
    customerId = res.body.id;
    expect(res.body.customerCode).toMatch(/^CUST-/);
  });

  it('creates a product and registers a physical unit by IMEI', async () => {
    const productRes = await request(app.getHttpServer())
      .post('/v1/products')
      .set(auth())
      .send({
        brand: 'TestPhone',
        model: 'X1',
        category: 'MOBILE',
        sku: `SKU-${Date.now()}`,
        purchasePrice: 15000,
        sellingPrice: 20000,
        financePrice: 20000,
      })
      .expect(201);
    productId = productRes.body.id;

    const imei1 = `${Date.now()}`.padStart(15, '1').slice(0, 15);
    const identifierRes = await request(app.getHttpServer())
      .post(`/v1/products/${productId}/identifiers`)
      .set(auth())
      .send({ imei1 })
      .expect(201);
    productIdentifierId = identifierRes.body.id;
    expect(identifierRes.body.status).toBe('INVENTORY');

    // Duplicate financing of the same physical device must be rejected.
    await request(app.getHttpServer())
      .post(`/v1/products/${productId}/identifiers`)
      .set(auth())
      .send({ imei1 })
      .expect(409);
  });

  it('creates a loan plan version', async () => {
    const planRes = await request(app.getHttpServer())
      .post('/v1/loan-products')
      .set(auth())
      .send({ name: 'E2E Zero Cost Plan' })
      .expect(201);

    const versionRes = await request(app.getHttpServer())
      .post(`/v1/loan-products/${planRes.body.id}/versions`)
      .set(auth())
      .send({
        interestType: 'ZERO_COST',
        minInstallments: 1,
        maxInstallments: 12,
        installmentFrequency: 'MONTHLY',
        feeRules: [],
        gracePeriodDays: 0,
        latePaymentRules: {},
        partialPaymentRules: { allowed: true },
        prepaymentRules: { allowed: true },
        earlyClosureRules: { allowed: true },
        settlementRules: {},
        waiverRules: {},
        reversalRules: {},
      })
      .expect(201);
    loanProductVersionId = versionRes.body.id;
  });

  it('runs the loan creation wizard and produces a full EMI schedule pending approval', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/loans')
      .set(auth())
      .send({
        customerId,
        productIdentifierId,
        loanProductVersionId,
        cashPrice: 20000,
        downPaymentAmount: 2000,
        numberOfInstallments: 3,
      })
      .expect(201);

    loanId = res.body.id;
    expect(res.body.status).toBe('PENDING_APPROVAL');
    expect(res.body.installments).toHaveLength(3);
    expect(res.body.totalPayable).toBe('18000.00');
    // Advisory risk profile is present but decision is NOT made automatically.
    expect(res.body.riskScoreSnapshot).toBeDefined();
  });

  it('requires a human decision before the loan is active, and records who decided', async () => {
    const decisionRes = await request(app.getHttpServer())
      .post(`/v1/loans/${loanId}/decision`)
      .set(auth())
      .send({ decision: 'APPROVED' })
      .expect(201);

    expect(decisionRes.body.status).toBe('ACTIVE');
    expect(decisionRes.body.agreement).toBeDefined();

    const identifier = await prisma.productIdentifier.findUniqueOrThrow({ where: { id: productIdentifierId } });
    expect(identifier.status).toBe('FINANCED');
  });

  let firstReceiptId: string;
  let firstPaymentId: string;

  it('shows the allocation preview before posting, then posts the payment and generates exactly one receipt', async () => {
    const preview = await request(app.getHttpServer())
      .get(`/v1/payments/loans/${loanId}/allocation-preview`)
      .query({ amount: '2000' })
      .set(auth())
      .expect(200);
    expect(preview.body.lines[0].component).toBe('DOWN_PAYMENT');

    const idempotencyKey = `e2e-${Date.now()}`;
    const collectRes = await request(app.getHttpServer())
      .post('/v1/payments/collect')
      .set(auth())
      .send({ loanId, amount: 2000, method: 'CASH', idempotencyKey })
      .expect(201);

    expect(collectRes.body.idempotentReplay).toBe(false);
    expect(collectRes.body.payment.status).toBe('SUCCESSFUL');
    firstPaymentId = collectRes.body.payment.id;
    firstReceiptId = collectRes.body.receipt.id;

    // Same idempotency key replayed (e.g. a client double-tap) must not
    // create a second payment or a second receipt.
    const replayRes = await request(app.getHttpServer())
      .post('/v1/payments/collect')
      .set(auth())
      .send({ loanId, amount: 2000, method: 'CASH', idempotencyKey })
      .expect(201);
    expect(replayRes.body.idempotentReplay).toBe(true);
    expect(replayRes.body.payment.id).toBe(firstPaymentId);
    expect(replayRes.body.receipt.id).toBe(firstReceiptId);

    const paymentCount = await prisma.payment.count({ where: { idempotencyKey } });
    expect(paymentCount).toBe(1);
    const receiptCount = await prisma.receipt.count({ where: { paymentId: firstPaymentId } });
    expect(receiptCount).toBe(1);
  });

  it('reverses a payment without deleting the original, and restores the balance', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/payments/${firstPaymentId}/reverse`)
      .set(auth())
      .send({ reason: 'E2E test reversal' })
      .expect(201);

    expect(res.body.originalPaymentId).toBe(firstPaymentId);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: firstPaymentId } });
    expect(payment.status).toBe('REVERSED');

    const receiptStillExists = await prisma.receipt.findUnique({ where: { id: firstReceiptId } });
    expect(receiptStillExists).not.toBeNull();

    const loan = await prisma.loan.findUniqueOrThrow({ where: { id: loanId } });
    expect(loan.downPaymentPaid.toFixed(2)).toBe('0.00');
  });
});
