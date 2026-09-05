import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { ApiClient } from '@sptc/shared';

const ACCESS_TOKEN_KEY = 'sptc_staff_access_token';
const REFRESH_TOKEN_KEY = 'sptc_staff_refresh_token';

const apiBaseUrl = (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? 'http://10.0.2.2:3000';

let forceLogoutHandler: (() => void) | null = null;
export function setForceLogoutHandler(handler: (() => void) | null): void {
  forceLogoutHandler = handler;
}

export async function persistTokens(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export async function getStoredAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getStoredRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export const apiClient = new ApiClient({
  baseUrl: apiBaseUrl,
  domain: 'staff',
  getAccessToken: getStoredAccessToken,
  getRefreshToken: getStoredRefreshToken,
  onTokensRefreshed: async (tokens) => {
    await persistTokens(tokens.accessToken, tokens.refreshToken);
  },
  onAuthFailure: async () => {
    await clearTokens();
    forceLogoutHandler?.();
  },
});
