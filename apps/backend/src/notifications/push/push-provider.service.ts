import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FirebaseAdminService } from '../../firebase/firebase-admin.service';

export interface PushSendResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Push delivery, either via Expo's push service (PUSH_PROVIDER=expo - every
 * device registers an Expo push token, no Firebase project needed) or
 * directly via Firebase Cloud Messaging (PUSH_PROVIDER=fcm - devices
 * register their native FCM registration token instead; requires the
 * FirebaseAdminService to be configured). Both paths report outcomes
 * honestly rather than assuming success (blueprint #9/#63), and surface
 * permanently-invalid tokens so the caller can prune stale Device rows.
 */
@Injectable()
export class PushProviderService {
  private readonly logger = new Logger(PushProviderService.name);
  private static readonly EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

  constructor(
    private readonly config: ConfigService,
    private readonly firebase?: FirebaseAdminService,
  ) {}

  isConfigured(): boolean {
    const provider = this.config.get<string>('PUSH_PROVIDER');
    if (provider === 'expo') return true;
    if (provider === 'fcm') return Boolean(this.firebase?.isConfigured());
    return false;
  }

  async send(pushTokens: string[], title: string, body: string, data?: Record<string, unknown>): Promise<PushSendResult> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Push provider not configured.');
    }
    return this.config.get<string>('PUSH_PROVIDER') === 'fcm'
      ? this.sendViaFcm(pushTokens, title, body, data)
      : this.sendViaExpo(pushTokens, title, body, data);
  }

  private async sendViaExpo(
    pushTokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<PushSendResult> {
    const validTokens = pushTokens.filter((t) => t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken'));
    if (validTokens.length === 0) {
      return { successCount: 0, failureCount: pushTokens.length, invalidTokens: pushTokens };
    }

    const messages = validTokens.map((to) => ({ to, title, body, data, sound: 'default' as const }));

    const response = await fetch(PushProviderService.EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      this.logger.error(`Expo push API returned ${response.status}`);
      throw new ServiceUnavailableException('Could not send push notification right now.');
    }

    const result = (await response.json()) as { data?: ExpoPushTicket[] };
    const tickets = result.data ?? [];

    let successCount = 0;
    const invalidTokens: string[] = [];
    tickets.forEach((ticket, i) => {
      if (ticket.status === 'ok') {
        successCount++;
      } else if (ticket.details?.error === 'DeviceNotRegistered') {
        invalidTokens.push(validTokens[i]);
      } else {
        this.logger.warn(`Expo push ticket error for token ${validTokens[i]}: ${ticket.message}`);
      }
    });

    return { successCount, failureCount: tickets.length - successCount, invalidTokens };
  }

  private async sendViaFcm(
    pushTokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<PushSendResult> {
    const messaging = this.firebase?.getMessaging();
    if (!messaging) throw new ServiceUnavailableException('Firebase is not configured.');

    // FCM's data payload values must all be strings.
    const stringData = data
      ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
      : undefined;

    const response = await messaging.sendEachForMulticast({
      tokens: pushTokens,
      notification: { title, body },
      data: stringData,
    });

    const invalidTokens: string[] = [];
    response.responses.forEach((r: { success: boolean; error?: { code?: string; message?: string } }, i: number) => {
      if (!r.success) {
        const code = r.error?.code;
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
          invalidTokens.push(pushTokens[i]);
        } else {
          this.logger.warn(`FCM send error for token ${pushTokens[i]}: ${r.error?.message}`);
        }
      }
    });

    return { successCount: response.successCount, failureCount: response.failureCount, invalidTokens };
  }
}
