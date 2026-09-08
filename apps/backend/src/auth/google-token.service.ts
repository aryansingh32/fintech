import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

/**
 * Verifies the Google ID token the mobile apps get directly from
 * @react-native-google-signin/google-signin (GoogleSignin.signIn()). This is
 * a Google-issued OAuth ID token (iss: accounts.google.com, aud: the Google
 * Web Client ID) - NOT a Firebase ID token (iss: securetoken.google.com/
 * <project>, aud: the Firebase project ID). Firebase Admin's
 * auth.verifyIdToken() only ever accepts the latter, so passing it the raw
 * Google token (as this codebase used to) rejects every sign-in attempt as
 * "invalid or expired" regardless of whether the token was actually fine -
 * this is Google's own client library for verifying its own tokens instead.
 */
@Injectable()
export class GoogleTokenService {
  private readonly logger = new Logger(GoogleTokenService.name);
  private client: OAuth2Client | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('GOOGLE_WEB_CLIENT_ID'));
  }

  private getClient(): OAuth2Client | null {
    if (this.client) return this.client;
    const clientId = this.config.get<string>('GOOGLE_WEB_CLIENT_ID');
    if (!clientId) return null;
    this.client = new OAuth2Client(clientId);
    return this.client;
  }

  /**
   * Distinguishes "the token itself is bad" from "the token is fine but that
   * Google account's email isn't verified" - the two need different
   * customer-facing messages (one is a broken sign-in, the other tells the
   * user exactly what to fix on the Google side).
   */
  async verify(idToken: string): Promise<{ ok: true; email: string } | { ok: false; reason: 'invalid_token' | 'email_not_verified' }> {
    const client = this.getClient();
    if (!client) return { ok: false, reason: 'invalid_token' };
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: this.config.get<string>('GOOGLE_WEB_CLIENT_ID')!,
      });
      const payload = ticket.getPayload();
      if (!payload?.email) return { ok: false, reason: 'invalid_token' };
      if (!payload.email_verified) return { ok: false, reason: 'email_not_verified' };
      return { ok: true, email: payload.email };
    } catch (err) {
      this.logger.warn(`Google ID token verification failed: ${(err as Error).message}`);
      return { ok: false, reason: 'invalid_token' };
    }
  }
}
