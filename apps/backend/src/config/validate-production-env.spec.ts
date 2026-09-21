import { validateProductionEnv } from './validate-production-env';

const validEnv = {
  NODE_ENV: 'production',
  JWT_ACCESS_SECRET: 'a'.repeat(40),
  JWT_REFRESH_SECRET: 'b'.repeat(40),
  DATABASE_URL: 'postgresql://user:pass@host:5432/db',
  CORS_ORIGINS: 'https://app.example.com',
  SMS_PROVIDER: 'twilio',
  PAYMENT_GATEWAY_PROVIDER: 'razorpay',
  BACKUP_ENCRYPTION_PASSPHRASE: 'd'.repeat(40),
  BACKUP_R2_BUCKET_NAME: 'sptc-finance-backups',
  R2_BUCKET_NAME: 'sptc-finance-storage',
  R2_ACCOUNT_ID: 'account-id',
  R2_ACCESS_KEY_ID: 'access-key',
  R2_SECRET_ACCESS_KEY: 'secret-key',
} as NodeJS.ProcessEnv;

describe('validateProductionEnv', () => {
  it('passes for a fully-configured production environment', () => {
    expect(() => validateProductionEnv({ ...validEnv })).not.toThrow();
  });

  it('is a no-op outside production', () => {
    expect(() => validateProductionEnv({ ...validEnv, NODE_ENV: 'development', JWT_ACCESS_SECRET: '' })).not.toThrow();
  });

  it('rejects a short JWT secret', () => {
    expect(() => validateProductionEnv({ ...validEnv, JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects a placeholder JWT secret', () => {
    expect(() =>
      validateProductionEnv({ ...validEnv, JWT_REFRESH_SECRET: `change-me-${'x'.repeat(30)}` }),
    ).toThrow(/JWT_REFRESH_SECRET/);
  });

  it('rejects identical access/refresh secrets', () => {
    const secret = 'c'.repeat(40);
    expect(() =>
      validateProductionEnv({ ...validEnv, JWT_ACCESS_SECRET: secret, JWT_REFRESH_SECRET: secret }),
    ).toThrow(/must not be the same/);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => validateProductionEnv({ ...validEnv, DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
  });

  it('rejects a missing CORS_ORIGINS', () => {
    expect(() => validateProductionEnv({ ...validEnv, CORS_ORIGINS: '' })).toThrow(/CORS_ORIGINS/);
  });

  it('rejects an unsupported SMS provider', () => {
    expect(() => validateProductionEnv({ ...validEnv, SMS_PROVIDER: 'nexmo' })).toThrow(/SMS_PROVIDER/);
  });

  it('rejects an unsupported payment gateway provider', () => {
    expect(() =>
      validateProductionEnv({ ...validEnv, PAYMENT_GATEWAY_PROVIDER: 'stripe' }),
    ).toThrow(/PAYMENT_GATEWAY_PROVIDER/);
  });

  it('allows SMS/payment providers to be left unset', () => {
    expect(() =>
      validateProductionEnv({ ...validEnv, SMS_PROVIDER: '', PAYMENT_GATEWAY_PROVIDER: '' }),
    ).not.toThrow();
  });

  it('rejects a missing backup encryption passphrase', () => {
    expect(() => validateProductionEnv({ ...validEnv, BACKUP_ENCRYPTION_PASSPHRASE: '' })).toThrow(/BACKUP_ENCRYPTION_PASSPHRASE/);
  });

  it('rejects a missing backup bucket', () => {
    expect(() => validateProductionEnv({ ...validEnv, BACKUP_R2_BUCKET_NAME: '' })).toThrow(/BACKUP_R2_BUCKET_NAME/);
  });

  it('rejects the backup bucket being the same as the public storage bucket', () => {
    expect(() =>
      validateProductionEnv({ ...validEnv, BACKUP_R2_BUCKET_NAME: 'sptc-finance-storage' }),
    ).toThrow(/different, private bucket/);
  });

  it('rejects missing R2 credentials even when STORAGE_PROVIDER is unset', () => {
    expect(() => validateProductionEnv({ ...validEnv, R2_ACCOUNT_ID: '' })).toThrow(/R2_ACCOUNT_ID/);
  });
});
