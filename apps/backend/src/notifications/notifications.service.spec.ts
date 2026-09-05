import { ConfigService } from '@nestjs/config';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { NotificationEvent, renderTemplate } from './notification-events';

describe('renderTemplate', () => {
  it('fills placeholders for the requested locale', () => {
    const en = renderTemplate(NotificationEvent.EMI_DUE, 'en', { amount: '3250.00', loanNumber: 'SPTC-LOAN-1' });
    expect(en.body).toBe('Your EMI of ₹3250.00 for SPTC-LOAN-1 is due today.');

    const hi = renderTemplate(NotificationEvent.EMI_DUE, 'hi', { amount: '3250.00', loanNumber: 'SPTC-LOAN-1' });
    expect(hi.body).toContain('3250.00');
    expect(hi.body).not.toBe(en.body);
  });
});

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
    const notifications = new NotificationsService(prisma, new ConfigService({}));
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

  it('fails closed (never claims delivery) when a channel has no configured provider', async () => {
    const notifications = new NotificationsService(prisma, new ConfigService({}));
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

  // ConfigService.get() checks process.env before its internal config object,
  // so a "provider configured" scenario has to actually set process.env
  // (matching how it's configured in every real deployment) rather than
  // relying on the constructor's internalConfig, which would be shadowed by
  // the ambient (empty) SMS_PROVIDER from .env.test.
  describe('with SMS_PROVIDER set in the environment', () => {
    const originalValue = process.env.SMS_PROVIDER;

    beforeAll(() => {
      process.env.SMS_PROVIDER = 'test-provider';
    });

    afterAll(() => {
      process.env.SMS_PROVIDER = originalValue;
    });

    it('sends when a provider IS configured (still never assumed - just recorded as sent)', async () => {
      const notifications = new NotificationsService(prisma, new ConfigService({}));
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

    it('retryFailed re-attempts a FAILED notification and increments retryCount', async () => {
      process.env.SMS_PROVIDER = '';
      const unconfigured = new NotificationsService(prisma, new ConfigService({}));
      const ids = await unconfigured.enqueue(prisma, {
        event: NotificationEvent.EMI_DUE,
        customerId,
        channels: [NotificationChannel.SMS],
        payload: { amount: '50.00', loanNumber: 'SPTC-LOAN-RETRY' },
      });
      await unconfigured.dispatchAll(ids);

      process.env.SMS_PROVIDER = 'test-provider';
      const configuredNow = new NotificationsService(prisma, new ConfigService({}));
      await configuredNow.retryFailed();

      const row = await prisma.notification.findUniqueOrThrow({ where: { id: ids[0] } });
      expect(row.status).toBe(NotificationStatus.SENT);
      expect(row.retryCount).toBe(1);
    });
  });
});
