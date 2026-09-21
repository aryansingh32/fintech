import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink';
const BOUNDARY = 'sptc-finance-backup-boundary';

/**
 * Manual, on-demand export of a single backup to a SUPER_ADMIN's own Google
 * Drive (Business App "Send to Drive" button - BackupService.sendToDrive).
 * This is separate from and does NOT replace the automatic nightly R2
 * backup; it's a human-triggered second copy of one specific backup run.
 *
 * Requires a one-time manual setup outside this codebase: create an OAuth
 * 2.0 Client (Desktop app type) in Google Cloud Console for the same
 * project as GOOGLE_WEB_CLIENT_ID, grant it the
 * https://www.googleapis.com/auth/drive.file scope, and obtain a refresh
 * token for the SUPER_ADMIN's own Google account (e.g. via Google's OAuth
 * Playground: https://developers.google.com/oauthplayground, using your own
 * client ID/secret under its gear icon) - this cannot be done from server
 * code since it requires an interactive browser consent screen. Put the
 * three values in GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET /
 * GOOGLE_DRIVE_REFRESH_TOKEN. Optional GOOGLE_DRIVE_FOLDER_ID uploads into
 * a specific folder instead of Drive's root.
 *
 * drive.file scope (not full Drive access) means this app can only see
 * files IT created - it never has visibility into the rest of that Drive
 * account.
 */
@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);
  private client: OAuth2Client | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('GOOGLE_DRIVE_CLIENT_ID') &&
        this.config.get<string>('GOOGLE_DRIVE_CLIENT_SECRET') &&
        this.config.get<string>('GOOGLE_DRIVE_REFRESH_TOKEN'),
    );
  }

  private getClient(): OAuth2Client {
    if (this.client) return this.client;
    this.client = new OAuth2Client({
      clientId: this.config.get<string>('GOOGLE_DRIVE_CLIENT_ID'),
      clientSecret: this.config.get<string>('GOOGLE_DRIVE_CLIENT_SECRET'),
    });
    this.client.setCredentials({ refresh_token: this.config.get<string>('GOOGLE_DRIVE_REFRESH_TOKEN') });
    return this.client;
  }

  async uploadFile(name: string, body: Buffer, mimeType = 'application/octet-stream'): Promise<{ id: string; webViewLink?: string }> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Google Drive export is not configured. Set GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET and GOOGLE_DRIVE_REFRESH_TOKEN.',
      );
    }

    let accessToken: string;
    try {
      const tokenResponse = await this.getClient().getAccessToken();
      if (!tokenResponse.token) throw new Error('No access token returned.');
      accessToken = tokenResponse.token;
    } catch (err) {
      this.logger.error(`Could not obtain a Google Drive access token: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Could not authenticate with Google Drive - the refresh token may have been revoked.');
    }

    const folderId = this.config.get<string>('GOOGLE_DRIVE_FOLDER_ID');
    const metadata: Record<string, unknown> = { name };
    if (folderId) metadata.parents = [folderId];

    const multipartBody = Buffer.concat([
      Buffer.from(`--${BOUNDARY}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
      Buffer.from(`--${BOUNDARY}\r\nContent-Type: ${mimeType}\r\n\r\n`),
      body,
      Buffer.from(`\r\n--${BOUNDARY}--`),
    ]);

    const response = await fetch(DRIVE_UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${BOUNDARY}`,
        'Content-Length': String(multipartBody.length),
      },
      body: multipartBody,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.error(`Drive upload failed (${response.status}): ${text.slice(0, 500)}`);
      throw new ServiceUnavailableException(`Google Drive upload failed (HTTP ${response.status}).`);
    }

    return (await response.json()) as { id: string; webViewLink?: string };
  }
}
