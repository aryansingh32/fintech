import { ConfigService } from '@nestjs/config';
import { ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { BackupStatus, BackupTrigger } from '@prisma/client';
import { BackupService } from './backup.service';

jest.mock('child_process', () => ({ ...jest.requireActual('child_process'), spawn: jest.fn() }));
jest.mock('@aws-sdk/client-s3', () => {
  const send = jest.fn();
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send })),
    PutObjectCommand: jest.fn((input) => ({ __type: 'Put', input })),
    GetObjectCommand: jest.fn((input) => ({ __type: 'Get', input })),
    HeadObjectCommand: jest.fn((input) => ({ __type: 'Head', input })),
    ListObjectsV2Command: jest.fn((input) => ({ __type: 'List', input })),
    DeleteObjectCommand: jest.fn((input) => ({ __type: 'Delete', input })),
  };
});
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://r2.example/presigned-url'),
}));

import { spawn } from 'child_process';
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function fakeChildProcess() {
  const proc: any = new EventEmitter();
  proc.stdout = new PassThrough();
  proc.stderr = new PassThrough();
  proc.stdin = new PassThrough();
  proc.kill = jest.fn();
  return proc;
}

// mkdtemp/readFile/stat are real fs calls (not mocked), so spawn() is only
// invoked after a real I/O round-trip - poll instead of assuming spawn has
// already run synchronously after calling service.run(...).
async function waitForSpawnCalls(times = 2) {
  for (let i = 0; i < 50; i++) {
    if ((spawn as jest.Mock).mock.calls.length >= times) return;
    await new Promise((r) => setImmediate(r));
  }
  throw new Error('spawn was not called in time');
}

const CONFIG = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/sptc_finance',
  BACKUP_ENCRYPTION_PASSPHRASE: 'test-passphrase',
  BACKUP_R2_BUCKET_NAME: 'sptc-finance-backups',
  R2_ACCOUNT_ID: 'account-id',
  R2_ACCESS_KEY_ID: 'access-key',
  R2_SECRET_ACCESS_KEY: 'secret-key',
};

// Prisma Client auto-loads apps/backend/.env as a side effect of being
// imported (a documented Prisma behavior), which can leak real values for
// these keys into process.env regardless of what this suite passes to
// ConfigService - and ConfigService.get() checks process.env before the
// object passed to its constructor. Clear them for the duration of this
// suite so tests only see the CONFIG object below.
const ENV_KEYS_UNDER_TEST = Object.keys({
  DATABASE_URL: '',
  BACKUP_ENCRYPTION_PASSPHRASE: '',
  BACKUP_R2_BUCKET_NAME: '',
  R2_ACCOUNT_ID: '',
  R2_ACCESS_KEY_ID: '',
  R2_SECRET_ACCESS_KEY: '',
});
let savedRealEnv: Record<string, string | undefined> = {};

describe('BackupService', () => {
  let prisma: any;
  let notifications: any;
  let googleDrive: any;
  let sendMock: jest.Mock;

  beforeAll(() => {
    for (const key of ENV_KEYS_UNDER_TEST) {
      savedRealEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterAll(() => {
    for (const key of ENV_KEYS_UNDER_TEST) {
      if (savedRealEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedRealEnv[key];
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    sendMock = (new (S3Client as any)()).send;
    prisma = {
      backupRun: {
        create: jest.fn().mockResolvedValue({ id: 'run-1' }),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'run-1', ...data })),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      staffUser: { findMany: jest.fn().mockResolvedValue([]) },
    };
    notifications = { enqueue: jest.fn().mockResolvedValue(['n1']), dispatchAll: jest.fn().mockResolvedValue(undefined) };
    googleDrive = { uploadFile: jest.fn().mockResolvedValue({ id: 'drive-file-1' }) };
  });

  function makeService(omit: (keyof typeof CONFIG)[] = []) {
    const env: any = { ...CONFIG };
    for (const key of omit) delete env[key];
    const config = new ConfigService(env);
    return new BackupService(config, prisma, notifications, googleDrive);
  }

  it('is unconfigured when any required variable is missing', () => {
    expect(makeService(['BACKUP_ENCRYPTION_PASSPHRASE']).isConfigured()).toBe(false);
    expect(makeService(['BACKUP_R2_BUCKET_NAME']).isConfigured()).toBe(false);
    expect(makeService().isConfigured()).toBe(true);
  });

  it('refuses to start a backup when not configured', async () => {
    const service = makeService(['BACKUP_R2_BUCKET_NAME']);
    await expect(service.run(BackupTrigger.MANUAL)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('refuses to start a backup that is already in progress', async () => {
    const service = makeService();
    (service as any).running = true;
    await expect(service.run(BackupTrigger.MANUAL)).rejects.toBeInstanceOf(ConflictException);
  });

  it('dumps, encrypts, uploads, and records a SUCCEEDED run', async () => {
    const service = makeService();

    const dumpProc = fakeChildProcess();
    const encryptProc = fakeChildProcess();
    (spawn as jest.Mock).mockImplementation((cmd: string) => (cmd === 'pg_dump' ? dumpProc : encryptProc));

    // HeadObjectCommand (monthly-exists check) rejects -> not present yet.
    // ListObjectsV2Command returns no old objects to prune.
    sendMock.mockImplementation((command: any) => {
      if (command.__type === 'Head') return Promise.reject(new Error('NotFound'));
      if (command.__type === 'List') return Promise.resolve({ Contents: [], IsTruncated: false });
      return Promise.resolve({});
    });

    const runPromise = service.run(BackupTrigger.SCHEDULED);
    await waitForSpawnCalls();

    // Simulate the pg_dump | openssl pipeline producing >1KB of output then
    // both processes exiting cleanly.
    encryptProc.stdout.write(Buffer.alloc(2048, 'x'));
    encryptProc.stdout.end();
    dumpProc.emit('close', 0);
    encryptProc.emit('close', 0);

    const result = await runPromise;

    expect(result.status).toBe(BackupStatus.SUCCEEDED);
    expect(prisma.backupRun.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BackupStatus.SUCCEEDED, sizeBytes: 2048 }) }),
    );
    // Uploaded both a daily and a monthly copy (monthly didn't exist yet).
    const putCalls = sendMock.mock.calls.filter(([cmd]) => cmd.__type === 'Put');
    expect(putCalls).toHaveLength(2);
    expect(putCalls[0][0].input.Key).toMatch(/^daily\/\d{4}-\d{2}-\d{2}\.dump\.enc$/);
    expect(putCalls[1][0].input.Key).toMatch(/^monthly\/\d{4}-\d{2}\.dump\.enc$/);
  });

  it('records a FAILED run and alerts SUPER_ADMINs when pg_dump exits non-zero', async () => {
    const service = makeService();
    prisma.staffUser.findMany.mockResolvedValue([{ id: 'admin-1' }]);

    const dumpProc = fakeChildProcess();
    const encryptProc = fakeChildProcess();
    (spawn as jest.Mock).mockImplementation((cmd: string) => (cmd === 'pg_dump' ? dumpProc : encryptProc));

    const runPromise = service.run(BackupTrigger.SCHEDULED);
    await waitForSpawnCalls();
    dumpProc.stderr.write('connection refused');
    dumpProc.emit('close', 1);

    await expect(runPromise).rejects.toThrow(/pg_dump exited with code 1/);

    expect(prisma.backupRun.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BackupStatus.FAILED }) }),
    );
    expect(notifications.enqueue).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ staffUserId: 'admin-1', event: 'BACKUP_FAILED' }),
    );
    expect(notifications.dispatchAll).toHaveBeenCalledWith(['n1']);
  });

  it('rejects a suspiciously small backup instead of uploading it', async () => {
    const service = makeService();

    const dumpProc = fakeChildProcess();
    const encryptProc = fakeChildProcess();
    (spawn as jest.Mock).mockImplementation((cmd: string) => (cmd === 'pg_dump' ? dumpProc : encryptProc));

    const runPromise = service.run(BackupTrigger.MANUAL);
    await waitForSpawnCalls();
    encryptProc.stdout.write(Buffer.alloc(10, 'x'));
    encryptProc.stdout.end();
    dumpProc.emit('close', 0);
    encryptProc.emit('close', 0);

    await expect(runPromise).rejects.toThrow(/likely-corrupt/);
    const putCalls = sendMock.mock.calls.filter(([cmd]) => cmd.__type === 'Put');
    expect(putCalls).toHaveLength(0);
  });

  it('passes a date range through to the backupRun query', async () => {
    const service = makeService();
    const from = new Date('2026-01-01');
    const to = new Date('2026-01-31');
    await service.list({ from, to });
    expect(prisma.backupRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { startedAt: { gte: from, lte: to } } }),
    );
  });

  it('getDownloadUrl presigns the object for a succeeded run and forces a download', async () => {
    const service = makeService();
    prisma.backupRun.findUnique.mockResolvedValue({
      id: 'run-1',
      status: BackupStatus.SUCCEEDED,
      objectKey: 'daily/2026-01-01.dump.enc',
    });

    const result = await service.getDownloadUrl('run-1');

    expect(result).toEqual({ url: 'https://r2.example/presigned-url', filename: '2026-01-01.dump.enc' });
    const [, command] = (getSignedUrl as jest.Mock).mock.calls[0];
    expect(command.input).toMatchObject({
      Bucket: 'sptc-finance-backups',
      Key: 'daily/2026-01-01.dump.enc',
      ResponseContentDisposition: 'attachment; filename="2026-01-01.dump.enc"',
    });
  });

  it('getDownloadUrl rejects a run that never succeeded', async () => {
    const service = makeService();
    prisma.backupRun.findUnique.mockResolvedValue({ id: 'run-1', status: BackupStatus.FAILED, objectKey: null });
    await expect(service.getDownloadUrl('run-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('getDownloadUrl rejects an unknown run', async () => {
    const service = makeService();
    prisma.backupRun.findUnique.mockResolvedValue(null);
    await expect(service.getDownloadUrl('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sendToDrive fetches the object from R2 and uploads it to Drive, recording the result', async () => {
    const service = makeService();
    prisma.backupRun.findUnique.mockResolvedValue({
      id: 'run-1',
      status: BackupStatus.SUCCEEDED,
      objectKey: 'daily/2026-01-01.dump.enc',
    });
    const bytes = Buffer.from('encrypted-backup-bytes');
    sendMock.mockImplementation((command: any) => {
      if (command.__type === 'Get') return Promise.resolve({ Body: { transformToByteArray: async () => bytes } });
      return Promise.resolve({});
    });

    const result = await service.sendToDrive('run-1');

    expect(googleDrive.uploadFile).toHaveBeenCalledWith('2026-01-01.dump.enc', bytes);
    expect(prisma.backupRun.update).toHaveBeenLastCalledWith({
      where: { id: 'run-1' },
      data: { driveFileId: 'drive-file-1', sentToDriveAt: expect.any(Date) },
    });
    expect(result).toMatchObject({ driveFileId: 'drive-file-1' });
  });

  it('sendToDrive refuses a run that never succeeded', async () => {
    const service = makeService();
    prisma.backupRun.findUnique.mockResolvedValue({ id: 'run-1', status: BackupStatus.RUNNING, objectKey: null });
    await expect(service.sendToDrive('run-1')).rejects.toBeInstanceOf(ConflictException);
    expect(googleDrive.uploadFile).not.toHaveBeenCalled();
  });
});
