import { ConflictException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { BackupStatus, BackupTrigger, NotificationChannel } from '@prisma/client';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { mkdtemp, readFile, rm, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationEvent } from '../notifications/notification-events';
import { pgEnvFromUrl } from './pg-connection';
import { GoogleDriveService } from './google-drive.service';

// Daily snapshots are for "restore to yesterday"; monthly ones are the
// longer-lived safety net (accidental mass-delete discovered weeks later,
// a compliance/audit request for a past period). 400 days so a full 13
// months of month-end snapshots always survive even if a run lands a few
// days late.
const DAILY_RETENTION_DAYS = 14;
const MONTHLY_RETENTION_DAYS = 400;

// A valid pg_dump custom-format file always has this magic header even for
// an empty schema, plus catalog metadata - well under this is a sign the
// pipeline produced a truncated/corrupt file, not a real backup.
const MIN_PLAUSIBLE_BACKUP_BYTES = 1024;

const DOWNLOAD_PRESIGN_TTL_SECONDS = 300;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Renders a UTC instant as its India-local (IST) calendar date/month, so a
 * backup that runs at 02:00 IST (20:30 UTC the previous day) is filed and
 * displayed under the date the shop actually thinks of it as, not a day
 * behind. */
function istDateKey(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}
function istMonthKey(date: Date): string {
  return istDateKey(date).slice(0, 7);
}

/**
 * Nightly encrypted database backup (blueprint: "high risk data needs daily
 * backup"). Dumps the whole Postgres database with pg_dump, encrypts it
 * (AES-256, passphrase-derived key via openssl - never touches the
 * plaintext dump before it's encrypted-on-disk), and uploads it to a
 * dedicated, private Cloudflare R2 bucket (NOT the same bucket as
 * StorageService's customer-photo/KYC bucket, which is served publicly via
 * R2_PUBLIC_BASE_URL - backups must never be reachable by a guessable
 * public URL).
 *
 * Every attempt (success or failure) is recorded in BackupRun so a missed
 * night is visible in the app, not just in server logs. A failed run also
 * pushes a PUSH+SMS+in-app alert to every active SUPER_ADMIN.
 *
 * Runs on a single instance's cron; if this backend is ever scaled to
 * multiple replicas, only one replica's schedule should have this enabled
 * (or migrate to a dedicated job runner) or every replica will duplicate
 * the nightly dump.
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private client: S3Client | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly googleDrive: GoogleDriveService,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('DATABASE_URL') &&
        this.config.get<string>('BACKUP_ENCRYPTION_PASSPHRASE') &&
        this.config.get<string>('BACKUP_R2_BUCKET_NAME') &&
        this.config.get<string>('R2_ACCOUNT_ID') &&
        this.config.get<string>('R2_ACCESS_KEY_ID') &&
        this.config.get<string>('R2_SECRET_ACCESS_KEY'),
    );
  }

  private getClient(): S3Client {
    if (this.client) return this.client;
    const accountId = this.config.get<string>('R2_ACCOUNT_ID')!;
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.get<string>('R2_ACCESS_KEY_ID')!,
        secretAccessKey: this.config.get<string>('R2_SECRET_ACCESS_KEY')!,
      },
    });
    return this.client;
  }

  private get bucket(): string {
    return this.config.get<string>('BACKUP_R2_BUCKET_NAME')!;
  }

  // 02:00 India time (explicit timeZone, not server-local) - outside the
  // shop's business hours. Without this, a container defaulting to UTC
  // (the norm for node:*-bookworm-slim with no TZ set) would run this at
  // 07:30 IST, well inside opening hours.
  @Cron('0 2 * * *', { timeZone: 'Asia/Kolkata' })
  async runScheduled(): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn('Skipping scheduled backup: BACKUP_ENCRYPTION_PASSPHRASE/BACKUP_R2_BUCKET_NAME/R2_* not fully configured.');
      return;
    }
    try {
      await this.run(BackupTrigger.SCHEDULED);
    } catch {
      // Already logged and recorded in BackupRun + alerted inside run() - a
      // scheduled Cron handler must not throw, or Nest logs an unhandled
      // rejection on top of the alert we already sent.
    }
  }

  async list(filter: { from?: Date; to?: Date } = {}, limit = 100) {
    return this.prisma.backupRun.findMany({
      where: {
        startedAt: {
          gte: filter.from,
          lte: filter.to,
        },
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  private async getSucceededRun(backupRunId: string) {
    const run = await this.prisma.backupRun.findUnique({ where: { id: backupRunId } });
    if (!run) throw new NotFoundException('Backup not found.');
    if (run.status !== BackupStatus.SUCCEEDED || !run.objectKey) {
      throw new ConflictException('This backup did not complete successfully and has no file to use.');
    }
    return run;
  }

  /** Presigned, time-limited GET URL so the Business App can download the
   * (still-encrypted) backup file directly from R2 without proxying the
   * bytes through this API process. Forces a "Save" prompt via
   * Content-Disposition rather than rendering inline. */
  async getDownloadUrl(backupRunId: string): Promise<{ url: string; filename: string }> {
    const run = await this.getSucceededRun(backupRunId);
    const filename = run.objectKey!.split('/').pop()!;
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: run.objectKey!,
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    });
    const url = await getSignedUrl(this.getClient(), command, { expiresIn: DOWNLOAD_PRESIGN_TTL_SECONDS });
    return { url, filename };
  }

  /** Manual, human-triggered export of one backup run to the calling
   * SUPER_ADMIN's own Google Drive - a second, independent-provider copy on
   * top of the automatic nightly R2 backup, not a replacement for it. */
  async sendToDrive(backupRunId: string) {
    const run = await this.getSucceededRun(backupRunId);
    const object = await this.getClient().send(new GetObjectCommand({ Bucket: this.bucket, Key: run.objectKey! }));
    const buffer = Buffer.from(await object.Body!.transformToByteArray());
    const filename = run.objectKey!.split('/').pop()!;

    const uploaded = await this.googleDrive.uploadFile(filename, buffer);

    return this.prisma.backupRun.update({
      where: { id: run.id },
      data: { driveFileId: uploaded.id, sentToDriveAt: new Date() },
    });
  }

  async run(trigger: BackupTrigger, actorStaffId?: string): Promise<{ id: string; status: BackupStatus }> {
    if (this.running) {
      throw new ConflictException('A backup is already in progress.');
    }
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Backups are not configured. Set BACKUP_ENCRYPTION_PASSPHRASE, BACKUP_R2_BUCKET_NAME and the R2_* variables.',
      );
    }

    this.running = true;
    const startedAt = new Date();
    const record = await this.prisma.backupRun.create({
      data: { trigger, status: BackupStatus.RUNNING, startedAt, triggeredByStaffId: actorStaffId },
    });

    let tempDir: string | undefined;
    try {
      tempDir = await mkdtemp(join(tmpdir(), 'sptc-backup-'));
      const dumpPath = join(tempDir, 'db.dump.enc');
      await this.dumpAndEncrypt(dumpPath);

      const fileStat = await stat(dumpPath);
      if (fileStat.size < MIN_PLAUSIBLE_BACKUP_BYTES) {
        throw new Error(`Backup file is only ${fileStat.size} bytes - refusing to upload a likely-corrupt backup.`);
      }
      const buffer = await readFile(dumpPath);

      const dateKey = istDateKey(startedAt);
      const monthKey = istMonthKey(startedAt);
      const dailyKey = `daily/${dateKey}.dump.enc`;
      await this.upload(dailyKey, buffer);

      const monthlyKey = `monthly/${monthKey}.dump.enc`;
      if (!(await this.objectExists(monthlyKey))) {
        await this.upload(monthlyKey, buffer);
      }

      const prunedKeys = await this.pruneOldBackups();

      const updated = await this.prisma.backupRun.update({
        where: { id: record.id },
        data: {
          status: BackupStatus.SUCCEEDED,
          finishedAt: new Date(),
          sizeBytes: buffer.length,
          objectKey: dailyKey,
          prunedKeys,
        },
      });
      this.logger.log(`Backup ${record.id} succeeded: ${dailyKey} (${buffer.length} bytes), pruned ${prunedKeys.length} old object(s).`);
      return { id: updated.id, status: updated.status };
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`Backup ${record.id} failed: ${message}`);
      await this.prisma.backupRun.update({
        where: { id: record.id },
        data: { status: BackupStatus.FAILED, finishedAt: new Date(), errorMessage: message },
      });
      await this.alertFailure(message);
      throw err;
    } finally {
      this.running = false;
      if (tempDir) await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async dumpAndEncrypt(outPath: string): Promise<void> {
    const databaseUrl = this.config.get<string>('DATABASE_URL')!;
    const passphrase = this.config.get<string>('BACKUP_ENCRYPTION_PASSPHRASE')!;
    const pgEnv = pgEnvFromUrl(databaseUrl);

    await new Promise<void>((resolve, reject) => {
      const dump = spawn('pg_dump', ['-Fc', '--no-owner', '--no-acl'], { env: { ...process.env, ...pgEnv } });
      const encrypt = spawn('openssl', ['enc', '-aes-256-cbc', '-pbkdf2', '-salt', '-pass', 'env:BACKUP_ENCRYPTION_PASSPHRASE'], {
        env: { ...process.env, BACKUP_ENCRYPTION_PASSPHRASE: passphrase },
      });
      const out = createWriteStream(outPath);

      let dumpStderr = '';
      let encryptStderr = '';
      dump.stderr.on('data', (d) => (dumpStderr += d.toString()));
      encrypt.stderr.on('data', (d) => (encryptStderr += d.toString()));

      dump.stdout.pipe(encrypt.stdin);
      encrypt.stdout.pipe(out);

      let settled = false;
      const fail = (msg: string) => {
        if (settled) return;
        settled = true;
        dump.kill();
        encrypt.kill();
        reject(new Error(msg));
      };
      const succeed = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      dump.on('error', (err) => fail(`pg_dump could not start: ${err.message}`));
      encrypt.on('error', (err) => fail(`openssl could not start: ${err.message}`));
      out.on('error', (err) => fail(`Could not write backup file: ${err.message}`));

      dump.on('close', (code) => {
        if (code !== 0) fail(`pg_dump exited with code ${code}: ${dumpStderr.trim()}`);
      });
      encrypt.on('close', (code) => {
        if (code !== 0) fail(`openssl exited with code ${code}: ${encryptStderr.trim()}`);
      });
      out.on('close', succeed);
    });
  }

  private async upload(key: string, body: Buffer): Promise<void> {
    await this.getClient().send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: 'application/octet-stream' }),
    );
  }

  private async objectExists(key: string): Promise<boolean> {
    try {
      await this.getClient().send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  private async pruneOldBackups(): Promise<string[]> {
    const now = Date.now();
    const pruned: string[] = [];
    for (const { prefix, maxAgeDays } of [
      { prefix: 'daily/', maxAgeDays: DAILY_RETENTION_DAYS },
      { prefix: 'monthly/', maxAgeDays: MONTHLY_RETENTION_DAYS },
    ]) {
      let continuationToken: string | undefined;
      do {
        const page = await this.getClient().send(
          new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: continuationToken }),
        );
        for (const obj of page.Contents ?? []) {
          if (!obj.Key || !obj.LastModified) continue;
          const ageDays = (now - obj.LastModified.getTime()) / 86_400_000;
          if (ageDays > maxAgeDays) {
            await this.getClient().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: obj.Key }));
            pruned.push(obj.Key);
          }
        }
        continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (continuationToken);
    }
    return pruned;
  }

  private async alertFailure(message: string): Promise<void> {
    try {
      const superAdmins = await this.prisma.staffUser.findMany({
        where: { role: 'SUPER_ADMIN', isActive: true },
        select: { id: true },
      });
      for (const admin of superAdmins) {
        const ids = await this.notifications.enqueue(this.prisma, {
          event: NotificationEvent.BACKUP_FAILED,
          staffUserId: admin.id,
          channels: [NotificationChannel.PUSH, NotificationChannel.SMS, NotificationChannel.IN_APP],
          payload: { reason: message.slice(0, 200) },
        });
        await this.notifications.dispatchAll(ids);
      }
    } catch (err) {
      this.logger.error(`Could not send backup-failure alert: ${(err as Error).message}`);
    }
  }
}
