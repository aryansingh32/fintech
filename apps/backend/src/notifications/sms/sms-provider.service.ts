import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SmsSendResult {
  providerMessageId: string;
}

/**
 * Real SMS delivery via Twilio's REST API. This is the only place in the
 * codebase that talks to an SMS provider - OtpService and NotificationsService
 * both call `send()` and treat any thrown error as "delivery did not happen",
 * never as a soft failure to paper over (blueprint #9/#63: no fake delivery).
 *
 * Configure via env: SMS_PROVIDER=twilio, TWILIO_ACCOUNT_SID,
 * TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER. Leaving SMS_PROVIDER unset keeps
 * the whole codebase in its existing fail-closed/dev-OTP-surfaced behavior.
 */
@Injectable()
export class SmsProviderService {
  private readonly logger = new Logger(SmsProviderService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('SMS_PROVIDER'));
  }

  async send(to: string, body: string): Promise<SmsSendResult> {
    const provider = this.config.get<string>('SMS_PROVIDER');
    if (!provider) {
      throw new ServiceUnavailableException('SMS provider not configured.');
    }

    switch (provider) {
      case 'twilio':
        return this.sendViaTwilio(to, body);
      default:
        throw new ServiceUnavailableException(`Unsupported SMS_PROVIDER "${provider}".`);
    }
  }

  private async sendViaTwilio(to: string, body: string): Promise<SmsSendResult> {
    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const fromNumber = this.config.get<string>('TWILIO_FROM_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      throw new ServiceUnavailableException(
        'Twilio is selected as SMS_PROVIDER but TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER are not fully set.',
      );
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const params = new URLSearchParams({ To: this.toE164(to), From: fromNumber, Body: body });
    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const payload = (await response.json().catch(() => null)) as { sid?: string; message?: string } | null;

    if (!response.ok) {
      this.logger.error(`Twilio send failed (${response.status}): ${payload?.message ?? 'unknown error'}`);
      throw new ServiceUnavailableException('Could not send SMS right now. Please try again.');
    }

    return { providerMessageId: payload?.sid ?? 'unknown' };
  }

  /** Twilio (and most SMS gateways) require E.164. Assumes Indian numbers when no country code is present. */
  private toE164(mobile: string): string {
    const digits = mobile.replace(/[^\d]/g, '');
    if (mobile.startsWith('+')) return mobile;
    if (digits.length === 10) return `+91${digits}`;
    return `+${digits}`;
  }
}
