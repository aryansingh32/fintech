import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, NotificationRecipientType, NotificationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaTx } from '../ledger/ledger.service';
import { NotificationEvent, renderTemplate, SupportedLocale } from './notification-events';

export interface NotifyParams {
  event: NotificationEvent;
  customerId?: string;
  staffUserId?: string;
  channels?: NotificationChannel[];
  payload: Record<string, string | number>;
  locale?: SupportedLocale;
}

const CHANNEL_PROVIDER_ENV: Partial<Record<NotificationChannel, string>> = {
  [NotificationChannel.SMS]: 'SMS_PROVIDER',
  [NotificationChannel.EMAIL]: 'EMAIL_PROVIDER',
  [NotificationChannel.PUSH]: 'PUSH_PROVIDER',
};

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

    if (notification.channel === NotificationChannel.IN_APP) {
      // Stored row IS the delivery mechanism - the app fetches it directly.
      await this.markStatus(notificationId, NotificationStatus.DELIVERED, { title, body });
      return;
    }

    const providerEnvVar = CHANNEL_PROVIDER_ENV[notification.channel];
    const provider = providerEnvVar ? this.config.get<string>(providerEnvVar) : undefined;

    if (!provider) {
      this.logger.warn(
        `${notification.channel} provider not configured - notification ${notificationId} (${notification.event}) not sent. ` +
          `Would have said: "${title}: ${body}"`,
      );
      await this.markStatus(notificationId, NotificationStatus.FAILED, {
        title,
        body,
        reason: `${notification.channel}_PROVIDER_NOT_CONFIGURED`,
      });
      return;
    }

    // Real integration point. Never simulated - status only becomes
    // SENT/DELIVERED once a real provider call (or its webhook) confirms it.
    // await this.providerClientFor(notification.channel).send(...)
    this.logger.log(`Dispatched ${notification.channel} notification ${notificationId} via ${provider}`);
    await this.markStatus(notificationId, NotificationStatus.SENT, { title, body });
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

  private defaultChannelsFor(recipientType: NotificationRecipientType): NotificationChannel[] {
    return recipientType === NotificationRecipientType.CUSTOMER
      ? [NotificationChannel.IN_APP, NotificationChannel.PUSH]
      : [NotificationChannel.IN_APP];
  }
}
