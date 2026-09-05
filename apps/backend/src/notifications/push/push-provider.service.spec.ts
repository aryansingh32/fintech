import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { PushProviderService } from './push-provider.service';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe('PushProviderService', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('reports unconfigured unless PUSH_PROVIDER=expo', () => {
    expect(new PushProviderService(new ConfigService({})).isConfigured()).toBe(false);
    expect(new PushProviderService(new ConfigService({ PUSH_PROVIDER: 'fcm' })).isConfigured()).toBe(false);
    expect(new PushProviderService(new ConfigService({ PUSH_PROVIDER: 'expo' })).isConfigured()).toBe(true);
  });

  it('throws rather than silently no-op-ing when not configured', async () => {
    const service = new PushProviderService(new ConfigService({}));
    await expect(service.send(['ExponentPushToken[abc]'], 'Title', 'Body')).rejects.toThrow(ServiceUnavailableException);
  });

  it('treats all-invalid-format tokens as a full failure without calling the API', async () => {
    const service = new PushProviderService(new ConfigService({ PUSH_PROVIDER: 'expo' }));
    const result = await service.send(['not-a-real-token'], 'Title', 'Body');
    expect(result).toEqual({ successCount: 0, failureCount: 1, invalidTokens: ['not-a-real-token'] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends valid tokens and reports success/failure/invalid per-token from Expo tickets', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [
          { status: 'ok', id: 'ticket-1' },
          { status: 'error', message: 'DeviceNotRegistered', details: { error: 'DeviceNotRegistered' } },
        ],
      }),
    );
    const service = new PushProviderService(new ConfigService({ PUSH_PROVIDER: 'expo' }));

    const result = await service.send(
      ['ExponentPushToken[good]', 'ExponentPushToken[stale]'],
      'Payment received',
      'We received your payment.',
    );

    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
    expect(result.invalidTokens).toEqual(['ExponentPushToken[stale]']);
  });

  it('throws when the Expo push API itself errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false, 500));
    const service = new PushProviderService(new ConfigService({ PUSH_PROVIDER: 'expo' }));
    await expect(service.send(['ExponentPushToken[abc]'], 'T', 'B')).rejects.toThrow(ServiceUnavailableException);
  });
});
