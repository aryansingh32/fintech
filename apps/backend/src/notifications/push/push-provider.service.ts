import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
 * Real push delivery via Expo's push service - the natural fit since both
 * apps are Expo-managed and every device already registers an Expo push
 * token (no Firebase project needed to get started). `DeviceNotRegistered`
 * responses are surfaced as invalidTokens so the caller can prune stale
 * Device rows; every other outcome is reported honestly rather than assumed
 * successful (blueprint #9/#63).
 */
@Injectable()
export class PushProviderService {
  private readonly logger = new Logger(PushProviderService.name);
  private static readonly EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return this.config.get<string>('PUSH_PROVIDER') === 'expo';
  }

  async send(pushTokens: string[], title: string, body: string, data?: Record<string, unknown>): Promise<PushSendResult> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Push provider not configured.');
    }
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
}
