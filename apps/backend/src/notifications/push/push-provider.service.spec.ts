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

  it('with PUSH_PROVIDER=fcm, is configured only when a FirebaseAdminService reports itself configured', () => {
    const unconfiguredFirebase = { isConfigured: () => false } as never;
    const configuredFirebase = { isConfigured: () => true } as never;
    expect(new PushProviderService(new ConfigService({ PUSH_PROVIDER: 'fcm' }), unconfiguredFirebase).isConfigured()).toBe(false);
    expect(new PushProviderService(new ConfigService({ PUSH_PROVIDER: 'fcm' }), configuredFirebase).isConfigured()).toBe(true);
  });

  it('sends via FCM and maps registration-token-not-registered to invalidTokens', async () => {
    const sendEachForMulticast = jest.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [
        { success: true },
        { success: false, error: { code: 'messaging/registration-token-not-registered', message: 'stale' } },
      ],
    });
    const firebase = {
      isConfigured: () => true,
      getMessaging: () => ({ sendEachForMulticast }),
    } as never;
    const service = new PushProviderService(new ConfigService({ PUSH_PROVIDER: 'fcm' }), firebase);

    const result = await service.send(['fcm-good', 'fcm-stale'], 'Payment received', 'We received your payment.');

    expect(sendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({ tokens: ['fcm-good', 'fcm-stale'], notification: { title: 'Payment received', body: 'We received your payment.' } }),
    );
    expect(result).toEqual({ successCount: 1, failureCount: 1, invalidTokens: ['fcm-stale'] });
  });
});
