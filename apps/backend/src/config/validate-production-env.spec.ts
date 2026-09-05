import { validateProductionEnv } from './validate-production-env';

const validEnv = {
  NODE_ENV: 'production',
  JWT_ACCESS_SECRET: 'a'.repeat(40),
  JWT_REFRESH_SECRET: 'b'.repeat(40),
  DATABASE_URL: 'postgresql://user:pass@host:5432/db',
  CORS_ORIGINS: 'https://app.example.com',
  SMS_PROVIDER: 'twilio',
  PAYMENT_GATEWAY_PROVIDER: 'razorpay',
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
});
