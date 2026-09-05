import { ConfigService } from '@nestjs/config';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { NotificationEvent, renderTemplate } from './notification-events';
import { SmsProviderService } from './sms/sms-provider.service';
import { PushProviderService } from './push/push-provider.service';

describe('renderTemplate', () => {
  it('fills placeholders for the requested locale', () => {
    const en = renderTemplate(NotificationEvent.EMI_DUE, 'en', { amount: '3250.00', loanNumber: 'SPTC-LOAN-1' });
    expect(en.body).toBe('Your EMI of ₹3250.00 for SPTC-LOAN-1 is due today.');

    const hi = renderTemplate(NotificationEvent.EMI_DUE, 'hi', { amount: '3250.00', loanNumber: 'SPTC-LOAN-1' });
    expect(hi.body).toContain('3250.00');
    expect(hi.body).not.toBe(en.body);
  });
});

/** Minimal stand-ins for the two provider services - real network calls are tested separately (see provider unit tests). */
function fakeSms(configured: boolean, sendImpl?: () => Promise<{ providerMessageId: string }>): SmsProviderService {
  return {
    isConfigured: () => configured,
    send: sendImpl ?? (async () => ({ providerMessageId: 'fake' })),
  } as unknown as SmsProviderService;
}

function fakePush(
  configured: boolean,
  sendImpl?: () => Promise<{ successCount: number; failureCount: number; invalidTokens: string[] }>,
): PushProviderService {
  return {
    isConfigured: () => configured,
    send: sendImpl ?? (async () => ({ successCount: 1, failureCount: 0, invalidTokens: [] })),
  } as unknown as PushProviderService;
}

/**
 * Uses the real test Postgres database (schema-validated Notification rows)
 * but never a real SMS/push provider - this is exactly what "no fake
 * delivery" (blueprint #63) needs to prove: IN_APP is genuinely delivered
 * (it IS the storage), while an unconfigured channel fails closed rather
 * than claiming success.
 */
describe('NotificationsService (integration)', () => {
  const prisma = new PrismaService();
  let customerId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const branch = await prisma.branch.create({ data: { name: 'Notif Branch', code: `NB-${Date.now()}` } });
    const customer = await prisma.customer.create({
      data: {
        branchId: branch.id,
        customerCode: `CUST-NOTIF-${Date.now()}`,
        mobile: `7${Date.now().toString().slice(-9)}`,
        name: 'Notif Customer',
      },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('marks an IN_APP notification DELIVERED without any provider configured', async () => {
    const notifications = new NotificationsService(prisma, new ConfigService({}), fakeSms(false), fakePush(false));
    const ids = await notifications.enqueue(prisma, {
      event: NotificationEvent.PAYMENT_CONFIRMED,
      customerId,
      channels: [NotificationChannel.IN_APP],
      payload: { amount: '100.00', loanNumber: 'SPTC-LOAN-X' },
    });
    await notifications.dispatchAll(ids);

    const row = await prisma.notification.findUniqueOrThrow({ where: { id: ids[0] } });
    expect(row.status).toBe(NotificationStatus.DELIVERED);
  });

  it('fails closed (never claims delivery) when SMS has no configured provider', async () => {
    const notifications = new NotificationsService(prisma, new ConfigService({}), fakeSms(false), fakePush(false));
    const ids = await notifications.enqueue(prisma, {
      event: NotificationEvent.EMI_DUE,
      customerId,
      channels: [NotificationChannel.SMS],
      payload: { amount: '100.00', loanNumber: 'SPTC-LOAN-X' },
    });
    await notifications.dispatchAll(ids);

    const row = await prisma.notification.findUniqueOrThrow({ where: { id: ids[0] } });
    expect(row.status).toBe(NotificationStatus.FAILED);
    expect((row.deliveryMetadata as { reason?: string })?.reason).toBe('SMS_PROVIDER_NOT_CONFIGURED');
  });

  it('sends SMS when a provider IS configured (still never assumed - just recorded as sent)', async () => {
    const notifications = new NotificationsService(prisma, new ConfigService({}), fakeSms(true), fakePush(false));
    const ids = await notifications.enqueue(prisma, {
      event: NotificationEvent.EMI_DUE,
      customerId,
      channels: [NotificationChannel.SMS],
      payload: { amount: '100.00', loanNumber: 'SPTC-LOAN-X' },
    });
    await notifications.dispatchAll(ids);

    const row = await prisma.notification.findUniqueOrThrow({ where: { id: ids[0] } });
    expect(row.status).toBe(NotificationStatus.SENT);
  });

  it('marks SMS FAILED (not thrown) when the provider call itself errors', async () => {
    const notifications = new NotificationsService(
      prisma,
      new ConfigService({}),
      fakeSms(true, async () => {
        throw new Error('provider down');
      }),
      fakePush(false),
    );
    const ids = await notifications.enqueue(prisma, {
      event: NotificationEvent.EMI_DUE,
      customerId,
      channels: [NotificationChannel.SMS],
      payload: { amount: '100.00', loanNumber: 'SPTC-LOAN-X' },
    });
    await notifications.dispatchAll(ids);

    const row = await prisma.notification.findUniqueOrThrow({ where: { id: ids[0] } });
    expect(row.status).toBe(NotificationStatus.FAILED);
    expect((row.deliveryMetadata as { reason?: string })?.reason).toBe('SEND_FAILED');
  });

  it('fails closed on PUSH with no registered device token, even if the provider is configured', async () => {
    const notifications = new NotificationsService(prisma, new ConfigService({}), fakeSms(false), fakePush(true));
    const ids = await notifications.enqueue(prisma, {
      event: NotificationEvent.PAYMENT_CONFIRMED,
      customerId,
      channels: [NotificationChannel.PUSH],
      payload: { amount: '100.00', loanNumber: 'SPTC-LOAN-X' },
    });
    await notifications.dispatchAll(ids);

    const row = await prisma.notification.findUniqueOrThrow({ where: { id: ids[0] } });
    expect(row.status).toBe(NotificationStatus.FAILED);
    expect((row.deliveryMetadata as { reason?: string })?.reason).toBe('NO_DEVICE_TOKEN');
  });

  it('sends PUSH and prunes an invalid token reported by the provider', async () => {
    const device = await prisma.device.create({
      data: {
        subjectType: 'CUSTOMER',
        customerId,
        deviceIdentifier: `device-${Date.now()}`,
        platform: 'ANDROID',
        pushToken: 'ExponentPushToken[stale]',
      },
    });

    const notifications = new NotificationsService(
      prisma,
      new ConfigService({}),
      fakeSms(false),
      fakePush(true, async () => ({ successCount: 0, failureCount: 1, invalidTokens: ['ExponentPushToken[stale]'] })),
    );
    const ids = await notifications.enqueue(prisma, {
      event: NotificationEvent.PAYMENT_CONFIRMED,
      customerId,
      channels: [NotificationChannel.PUSH],
      payload: { amount: '100.00', loanNumber: 'SPTC-LOAN-X' },
    });
    await notifications.dispatchAll(ids);

    const refreshedDevice = await prisma.device.findUniqueOrThrow({ where: { id: device.id } });
    expect(refreshedDevice.pushToken).toBeNull();
  });

  it('retryFailed re-attempts a FAILED notification and increments retryCount', async () => {
    const unconfigured = new NotificationsService(prisma, new ConfigService({}), fakeSms(false), fakePush(false));
    const ids = await unconfigured.enqueue(prisma, {
      event: NotificationEvent.EMI_DUE,
      customerId,
      channels: [NotificationChannel.SMS],
      payload: { amount: '50.00', loanNumber: 'SPTC-LOAN-RETRY' },
    });
    await unconfigured.dispatchAll(ids);

    const configuredNow = new NotificationsService(prisma, new ConfigService({}), fakeSms(true), fakePush(false));
    await configuredNow.retryFailed();

    const row = await prisma.notification.findUniqueOrThrow({ where: { id: ids[0] } });
    expect(row.status).toBe(NotificationStatus.SENT);
    expect(row.retryCount).toBe(1);
  });
});
