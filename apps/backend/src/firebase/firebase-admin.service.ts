import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import type { Auth } from 'firebase-admin/auth';

/**
 * Lazily-initialized Firebase Admin SDK wrapper, shared by FCM push delivery
 * and Google Sign-In ID token verification. Configure via either:
 *  - FIREBASE_SERVICE_ACCOUNT_JSON: the full service account JSON as a
 *    single-line string (e.g. from a secrets manager), or
 *  - GOOGLE_APPLICATION_CREDENTIALS: a filesystem path to the JSON key file
 *    (firebase-admin reads this env var itself via applicationDefault()).
 * Fails closed (isConfigured() === false) rather than throwing at boot when
 * neither is set, matching the SMS/push/storage provider pattern elsewhere.
 */
@Injectable()
export class FirebaseAdminService {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private app: App | null = null;
  private initAttempted = false;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON') || this.config.get<string>('GOOGLE_APPLICATION_CREDENTIALS'));
  }

  private getApp(): App | null {
    if (this.app || this.initAttempted) return this.app;
    this.initAttempted = true;
    if (!this.isConfigured()) return null;

    try {
      const serviceAccountJson = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
      const credential = serviceAccountJson ? cert(JSON.parse(serviceAccountJson)) : applicationDefault();
      this.app = initializeApp({ credential });
      return this.app;
    } catch (err) {
      this.logger.error(`Failed to initialize Firebase Admin SDK: ${(err as Error).message}`);
      return null;
    }
  }

  getMessaging(): Messaging | null {
    const app = this.getApp();
    return app ? getMessaging(app) : null;
  }

  getAuth(): Auth | null {
    const app = this.getApp();
    if (!app) return null;
    // Lazily required (rather than statically imported) - firebase-admin/auth pulls in
    // jwks-rsa, an ESM-only package that breaks Jest's CommonJS test transform if it's
    // loaded just by importing this file, even in tests that never call getAuth().
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getAuth } = require('firebase-admin/auth');
    return getAuth(app);
  }
}
