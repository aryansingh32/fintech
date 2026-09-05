import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { SmsProviderService } from './sms-provider.service';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

// See razorpay-gateway.service.spec.ts for why these tests set process.env
// directly rather than passing values through ConfigService's
// internalConfig - .env.test's ambient SMS_PROVIDER="" takes priority over it.
const ENV_KEYS = ['SMS_PROVIDER', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'] as const;

describe('SmsProviderService', () => {
  const originalEnv: Record<string, string | undefined> = {};
  let fetchMock: jest.SpyInstance;

  beforeAll(() => {
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
  });

  afterAll(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('reports unconfigured with no SMS_PROVIDER set', () => {
    const service = new SmsProviderService(new ConfigService({}));
    expect(service.isConfigured()).toBe(false);
  });

  it('rejects an unsupported provider name rather than silently no-op-ing', async () => {
    process.env.SMS_PROVIDER = 'unknown-provider';
    const service = new SmsProviderService(new ConfigService({}));
    await expect(service.send('9876543210', 'hello')).rejects.toThrow(/Unsupported SMS_PROVIDER/);
  });

  it('sends via Twilio with Basic auth and a normalized E.164 Indian number', async () => {
    process.env.SMS_PROVIDER = 'twilio';
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'secret';
    process.env.TWILIO_FROM_NUMBER = '+15551234567';
    fetchMock.mockResolvedValue(jsonResponse({ sid: 'SM123' }));
    const service = new SmsProviderService(new ConfigService({}));

    const result = await service.send('9876543210', 'Your OTP is 123456');

    expect(result.providerMessageId).toBe('SM123');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('AC123/Messages.json');
    expect(options.headers.Authorization).toBe(`Basic ${Buffer.from('AC123:secret').toString('base64')}`);
    const params = new URLSearchParams(options.body as string);
    expect(params.get('To')).toBe('+919876543210');
    expect(params.get('From')).toBe('+15551234567');
  });

  it('throws (never silently drops) when Twilio credentials are incomplete', async () => {
    process.env.SMS_PROVIDER = 'twilio';
    const service = new SmsProviderService(new ConfigService({}));
    await expect(service.send('9876543210', 'hi')).rejects.toThrow(ServiceUnavailableException);
  });

  it('throws when Twilio itself rejects the send', async () => {
    process.env.SMS_PROVIDER = 'twilio';
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'secret';
    process.env.TWILIO_FROM_NUMBER = '+15551234567';
    fetchMock.mockResolvedValue(jsonResponse({ message: 'invalid number' }, false, 400));
    const service = new SmsProviderService(new ConfigService({}));
    await expect(service.send('9876543210', 'hi')).rejects.toThrow(ServiceUnavailableException);
  });
});
