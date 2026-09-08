import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, NotificationRecipientType, NotificationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaTx } from '../ledger/ledger.service';
import { SmsProviderService } from './sms/sms-provider.service';
import { PushProviderService } from './push/push-provider.service';
import { NotificationEvent, renderTemplate, SupportedLocale } from './notification-events';

export interface NotifyParams {
  event: NotificationEvent;
  customerId?: string;
  staffUserId?: string;
  channels?: NotificationChannel[];
  payload: Record<string, string | number>;
  locale?: SupportedLocale;
}

/**
 * Centralized, event-driven notification creation + dispatch (blueprint
 * #11, #21, #38). `enqueue` is called from INSIDE the same DB transaction as
 * the event that caused it (payment posted, loan approved, ...) so the
 * intent to notify is never lost even if delivery later fails; `dispatchAll`
 * is called AFTER that transaction commits (no network I/O inside a DB
 * transaction) and performs the actual send, recording a truthful
 * PENDING/SENT/FAILED status - never claiming delivery that didn't happen.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly sms: SmsProviderService,
    private readonly push: PushProviderService,
  ) {}

  async enqueue(tx: PrismaTx | PrismaService, params: NotifyParams): Promise<string[]> {
    const recipientType = params.customerId ? NotificationRecipientType.CUSTOMER : NotificationRecipientType.STAFF;
    const channels = params.channels ?? this.defaultChannelsFor(recipientType);
    const locale = params.locale ?? 'en';

    const ids: string[] = [];
    for (const channel of channels) {
      const row = await tx.notification.create({
        data: {
          recipientType,
          customerId: params.customerId,
          staffUserId: params.staffUserId,
          event: params.event,
          channel,
          templateKey: params.event,
          locale,
          payload: params.payload as Prisma.InputJsonValue,
          status: NotificationStatus.PENDING,
        },
      });
      ids.push(row.id);
    }
    return ids;
  }

  async dispatchAll(notificationIds: string[]): Promise<void> {
    for (const id of notificationIds) {
      await this.dispatch(id);
    }
  }

  async dispatch(notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notification || notification.status !== NotificationStatus.PENDING) return;

    const { title, body } = renderTemplate(
      notification.event as NotificationEvent,
      notification.locale as SupportedLocale,
      notification.payload as Record<string, string | number>,
    );

    switch (notification.channel) {
      case NotificationChannel.IN_APP:
        // Stored row IS the delivery mechanism - the app fetches it directly.
        await this.markStatus(notificationId, NotificationStatus.DELIVERED, { title, body });
        return;
      case NotificationChannel.SMS:
        await this.dispatchSms(notification.id, notification.customerId, notification.staffUserId, title, body);
        return;
      case NotificationChannel.PUSH:
        await this.dispatchPush(notification.id, notification.customerId, notification.staffUserId, title, body, {
          event: notification.event,
        });
        return;
      case NotificationChannel.EMAIL:
      default:
        this.logger.warn(`EMAIL provider not configured - notification ${notificationId} not sent.`);
        await this.markStatus(notificationId, NotificationStatus.FAILED, { title, body, reason: 'EMAIL_PROVIDER_NOT_CONFIGURED' });
    }
  }

  private async dispatchSms(
    notificationId: string,
    customerId: string | null,
    staffUserId: string | null,
    title: string,
    body: string,
  ): Promise<void> {
    if (!this.sms.isConfigured()) {
      this.logger.warn(`SMS provider not configured - notification ${notificationId} not sent. Would have said: "${title}: ${body}"`);
      await this.markStatus(notificationId, NotificationStatus.FAILED, { title, body, reason: 'SMS_PROVIDER_NOT_CONFIGURED' });
      return;
    }

    const mobile = customerId
      ? (await this.prisma.customer.findUnique({ where: { id: customerId } }))?.mobile
      : (await this.prisma.staffUser.findUnique({ where: { id: staffUserId! } }))?.mobile;
    if (!mobile) {
      await this.markStatus(notificationId, NotificationStatus.FAILED, { title, body, reason: 'RECIPIENT_NOT_FOUND' });
      return;
    }

    try {
      const result = await this.sms.send(mobile, body);
      await this.markStatus(notificationId, NotificationStatus.SENT, { title, body, providerMessageId: result.providerMessageId });
    } catch (err) {
      this.logger.error(`SMS dispatch failed for notification ${notificationId}: ${(err as Error).message}`);
      await this.markStatus(notificationId, NotificationStatus.FAILED, { title, body, reason: 'SEND_FAILED' });
    }
  }

  private async dispatchPush(
    notificationId: string,
    customerId: string | null,
    staffUserId: string | null,
    title: string,
    body: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (!this.push.isConfigured()) {
      this.logger.warn(`PUSH provider not configured - notification ${notificationId} not sent. Would have said: "${title}: ${body}"`);
      await this.markStatus(notificationId, NotificationStatus.FAILED, { title, body, reason: 'PUSH_PROVIDER_NOT_CONFIGURED' });
      return;
    }

    const devices = await this.prisma.device.findMany({
      where: { customerId: customerId ?? undefined, staffUserId: staffUserId ?? undefined, pushToken: { not: null } },
    });
    const tokens = devices.map((d) => d.pushToken).filter((t): t is string => Boolean(t));
    if (tokens.length === 0) {
      await this.markStatus(notificationId, NotificationStatus.FAILED, { title, body, reason: 'NO_DEVICE_TOKEN' });
      return;
    }

    try {
      const result = await this.push.send(tokens, title, body, data);
      if (result.invalidTokens.length > 0) {
        await this.prisma.device.updateMany({ where: { pushToken: { in: result.invalidTokens } }, data: { pushToken: null } });
      }
      const status = result.successCount > 0 ? NotificationStatus.SENT : NotificationStatus.FAILED;
      await this.markStatus(notificationId, status, {
        title,
        body,
        successCount: result.successCount,
        failureCount: result.failureCount,
      });
    } catch (err) {
      this.logger.error(`Push dispatch failed for notification ${notificationId}: ${(err as Error).message}`);
      await this.markStatus(notificationId, NotificationStatus.FAILED, { title, body, reason: 'SEND_FAILED' });
    }
  }

  async listForCustomer(customerId: string) {
    return this.prisma.notification.findMany({
      where: { customerId, channel: NotificationChannel.IN_APP },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async listForStaff(staffUserId: string) {
    return this.prisma.notification.findMany({
      where: { staffUserId, channel: NotificationChannel.IN_APP },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** Marks one IN_APP notification read - scoped to the requesting recipient so one user can never mark another's as read. */
  async markRead(id: string, recipient: { customerId?: string; staffUserId?: string }) {
    await this.prisma.notification.updateMany({
      where: { id, customerId: recipient.customerId, staffUserId: recipient.staffUserId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  async markAllRead(recipient: { customerId?: string; staffUserId?: string }) {
    await this.prisma.notification.updateMany({
      where: {
        customerId: recipient.customerId,
        staffUserId: recipient.staffUserId,
        channel: NotificationChannel.IN_APP,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  private async markStatus(
    id: string,
    status: NotificationStatus,
    deliveryMetadata: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.notification.update({
      where: { id },
      data: { status, deliveryMetadata: deliveryMetadata as Prisma.InputJsonValue, sentAt: new Date() },
    });
  }

  /** Retries FAILED sends up to a bounded number of times (called by a scheduled job). */
  async retryFailed(maxRetries = 3): Promise<number> {
    const candidates = await this.prisma.notification.findMany({
      where: { status: NotificationStatus.FAILED, retryCount: { lt: maxRetries } },
      take: 100,
    });
    for (const n of candidates) {
      await this.prisma.notification.update({
        where: { id: n.id },
        data: { status: NotificationStatus.PENDING, retryCount: { increment: 1 } },
      });
      await this.dispatch(n.id);
    }
    return candidates.length;
  }

  private defaultChannelsFor(_recipientType: NotificationRecipientType): NotificationChannel[] {
    // Staff carry a registered push token exactly the same way customers do
    // (see Device.pushToken) - there's no reason to only ever deliver
    // IN_APP to them. Both recipient types get the same default channels.
    return [NotificationChannel.IN_APP, NotificationChannel.PUSH];
  }
}
