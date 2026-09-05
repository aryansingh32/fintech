/** Matches apps/backend/src/common/filters/all-exceptions.filter.ts */
export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  path: string;
  timestamp: string;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, body: Partial<ApiErrorBody['error']> & { message: string }) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code ?? 'ERROR';
    this.details = body.details;
  }
}

export interface DeviceInfo {
  deviceIdentifier: string;
  platform: 'ANDROID' | 'IOS';
  appVersion?: string;
  pushToken?: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}
