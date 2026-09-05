import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiClient, clearTokens, getStoredAccessToken, persistTokens, setForceLogoutHandler } from '@/api/apiClient';
import { getDeviceInfo } from '@/api/device';

type AuthStatus = 'loading' | 'unauthenticated' | 'pin_setup_required' | 'authenticated';

interface AuthContextValue {
  status: AuthStatus;
  customerId: string | null;
  mobile: string | null;
  requestOtp: (mobile: string) => Promise<{ devOtp?: string }>;
  verifyOtp: (mobile: string, otp: string) => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  pinLogin: (mobile: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
}

const CUSTOMER_ID_KEY = 'sptc_customer_id';
const MOBILE_KEY = 'sptc_customer_mobile';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [mobile, setMobile] = useState<string | null>(null);

  useEffect(() => {
    setForceLogoutHandler(() => {
      setStatus('unauthenticated');
      setCustomerId(null);
    });
    return () => setForceLogoutHandler(null);
  }, []);

  useEffect(() => {
    (async () => {
      const [token, storedId, storedMobile] = await Promise.all([
        getStoredAccessToken(),
        SecureStore.getItemAsync(CUSTOMER_ID_KEY),
        SecureStore.getItemAsync(MOBILE_KEY),
      ]);
      if (token && storedId) {
        setCustomerId(storedId);
        setMobile(storedMobile);
        setStatus('authenticated');
      } else {
        setStatus('unauthenticated');
      }
    })();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      customerId,
      mobile,
      requestOtp: async (m: string) => {
        const res = await apiClient.customerAuth.requestOtp(m);
        return { devOtp: res.devOtp };
      },
      verifyOtp: async (m: string, otp: string) => {
        const device = await getDeviceInfo();
        const res = await apiClient.customerAuth.verifyOtp(m, otp, device);
        await persistTokens(res.accessToken, res.refreshToken);
        await SecureStore.setItemAsync(CUSTOMER_ID_KEY, res.customerId);
        await SecureStore.setItemAsync(MOBILE_KEY, m);
        setCustomerId(res.customerId);
        setMobile(m);
        setStatus(res.pinSetupRequired ? 'pin_setup_required' : 'authenticated');
      },
      setPin: async (pin: string) => {
        await apiClient.customerAuth.setPin(pin);
        setStatus('authenticated');
      },
      pinLogin: async (m: string, pin: string) => {
        const device = await getDeviceInfo();
        const res = await apiClient.customerAuth.pinLogin(m, pin, device);
        await persistTokens(res.accessToken, res.refreshToken);
        await SecureStore.setItemAsync(CUSTOMER_ID_KEY, res.customerId);
        await SecureStore.setItemAsync(MOBILE_KEY, m);
        setCustomerId(res.customerId);
        setMobile(m);
        setStatus('authenticated');
      },
      logout: async () => {
        try {
          await apiClient.customerAuth.logout();
        } catch {
          // Best-effort: even if the network call fails, still clear local session state below.
        }
        await clearTokens();
        await SecureStore.deleteItemAsync(CUSTOMER_ID_KEY);
        setCustomerId(null);
        setStatus('unauthenticated');
      },
    }),
    [status, customerId, mobile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
