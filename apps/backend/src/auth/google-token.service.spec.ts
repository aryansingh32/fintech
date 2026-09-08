import { ConfigService } from '@nestjs/config';
import { GoogleTokenService } from './google-token.service';

describe('GoogleTokenService', () => {
  it('reports unconfigured unless GOOGLE_WEB_CLIENT_ID is set', () => {
    expect(new GoogleTokenService(new ConfigService({})).isConfigured()).toBe(false);
    expect(new GoogleTokenService(new ConfigService({ GOOGLE_WEB_CLIENT_ID: 'client-id' })).isConfigured()).toBe(true);
  });

  it('rejects with invalid_token when not configured, without attempting verification', async () => {
    const service = new GoogleTokenService(new ConfigService({}));
    const result = await service.verify('anything');
    expect(result).toEqual({ ok: false, reason: 'invalid_token' });
  });

  it('rejects a malformed token as invalid_token rather than a Firebase-ID-token check', async () => {
    // This is the regression this service exists to fix: verifying the raw
    // Google ID token (google-auth-library) instead of a Firebase ID token
    // (firebase-admin), which rejected every real Google Sign-In attempt.
    const service = new GoogleTokenService(new ConfigService({ GOOGLE_WEB_CLIENT_ID: 'test-client-id' }));
    const result = await service.verify('not-a-real-jwt');
    expect(result).toEqual({ ok: false, reason: 'invalid_token' });
  });
});
