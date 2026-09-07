import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import {
  useFonts,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { LoadingState } from '@/components/ui';
import { OtpIslandBannerProvider } from '@/components/OtpIslandBanner';
import { ensureNotificationPermission } from '@/api/device';
import { AuthProvider } from '@/auth/AuthContext';
import { RootNavigator } from '@/navigation/RootNavigator';

// Controls how a push notification is presented while the app is in the
// foreground (Expo shows nothing by default in that case otherwise).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000 },
  },
});

/** Returning to the foreground triggers a refetch of any stale query - the app "catches up" without an explicit pull-to-refresh. */
function onAppStateChange(status: AppStateStatus) {
  focusManager.setFocused(status === 'active');
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, []);

  // Ask for the notification permission right at first launch, rather than
  // it surfacing for the first time mid-login (see api/device.ts).
  useEffect(() => {
    ensureNotificationPermission();
  }, []);

  if (!fontsLoaded) {
    return <LoadingState label="Starting SPTC Finance..." />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <OtpIslandBannerProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </AuthProvider>
      </OtpIslandBannerProvider>
    </QueryClientProvider>
  );
}
