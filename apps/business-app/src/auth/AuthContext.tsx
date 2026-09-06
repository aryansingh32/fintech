import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient, clearTokens, getStoredAccessToken, persistTokens, setForceLogoutHandler } from '@/api/apiClient';
import { getDeviceInfo } from '@/api/device';
import { decodeAccessTokenForDisplay, StaffRole } from '@sptc/shared';

type AuthStatus = 'loading' | 'unauthenticated' | 'device_verification_required' | 'authenticated';

interface StaffIdentity {
  staffUserId: string;
  role: StaffRole;
  branchId: string | null;
  isGlobal: boolean;
}

interface AuthContextValue {
  status: AuthStatus;
  identity: StaffIdentity | null;
  pendingMobile: string | null;
  login: (mobile: string, password: string) => Promise<{ devOtp?: string }>;
  verifyDevice: (mobile: string, otp: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [identity, setIdentity] = useState<StaffIdentity | null>(null);
  const [pendingMobile, setPendingMobile] = useState<string | null>(null);

  useEffect(() => {
    setForceLogoutHandler(() => {
      setStatus('unauthenticated');
      setIdentity(null);
    });
    return () => setForceLogoutHandler(null);
  }, []);

  useEffect(() => {
    (async () => {
      const token = await getStoredAccessToken();
      if (token) {
        const decoded = decodeAccessTokenForDisplay(token);
        if (decoded?.role) {
          setIdentity({
            staffUserId: decoded.sub,
            role: decoded.role,
            branchId: decoded.branchId ?? null,
            isGlobal: Boolean(decoded.isGlobal),
          });
          setStatus('authenticated');
          return;
        }
      }
      setStatus('unauthenticated');
    })();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      identity,
      pendingMobile,
      login: async (mobile: string, password: string) => {
        const device = await getDeviceInfo();
        const res = await apiClient.staffAuth.login(mobile, password, device);
        if (res.status === 'DEVICE_VERIFICATION_REQUIRED') {
          setPendingMobile(mobile);
          setStatus('device_verification_required');
          return { devOtp: res.devOtp };
        }
        await persistTokens(res.accessToken, res.refreshToken);
        const decoded = decodeAccessTokenForDisplay(res.accessToken);
        setIdentity({
          staffUserId: res.staffUserId,
          role: decoded?.role ?? StaffRole.SHOPKEEPER,
          branchId: decoded?.branchId ?? null,
          isGlobal: Boolean(decoded?.isGlobal),
        });
        setStatus('authenticated');
        return {};
      },
      verifyDevice: async (mobile: string, otp: string) => {
        const device = await getDeviceInfo();
        const res = await apiClient.staffAuth.verifyDevice(mobile, otp, device);
        await persistTokens(res.accessToken, res.refreshToken);
        const decoded = decodeAccessTokenForDisplay(res.accessToken);
        setIdentity({
          staffUserId: res.staffUserId,
          role: decoded?.role ?? StaffRole.SHOPKEEPER,
          branchId: decoded?.branchId ?? null,
          isGlobal: Boolean(decoded?.isGlobal),
        });
        setPendingMobile(null);
        setStatus('authenticated');
      },
      loginWithGoogle: async (idToken: string) => {
        const device = await getDeviceInfo();
        const res = await apiClient.staffAuth.googleLogin(idToken, device);
        if (res.status === 'DEVICE_VERIFICATION_REQUIRED') {
          throw new Error('Additional verification is required for this account. Please sign in with your password instead.');
        }
        await persistTokens(res.accessToken, res.refreshToken);
        const decoded = decodeAccessTokenForDisplay(res.accessToken);
        setIdentity({
          staffUserId: res.staffUserId,
          role: decoded?.role ?? StaffRole.SHOPKEEPER,
          branchId: decoded?.branchId ?? null,
          isGlobal: Boolean(decoded?.isGlobal),
        });
        setStatus('authenticated');
      },
      logout: async () => {
        try {
          await apiClient.staffAuth.logout();
        } catch {
          // Best-effort - always clear local state below regardless.
        }
        await clearTokens();
        setIdentity(null);
        setStatus('unauthenticated');
      },
    }),
    [status, identity, pendingMobile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
