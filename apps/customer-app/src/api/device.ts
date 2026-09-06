import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import type { DeviceInfo } from '@sptc/shared';

const DEVICE_ID_KEY = 'sptc_customer_device_id';

async function getOrCreateDeviceIdentifier(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const generated = `cust-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
  return generated;
}

/**
 * Requests notification permission and fetches this device's native push
 * token - on Android this IS the FCM registration token (backed by the
 * "sptc-finance-platform" Firebase project via google-services.json), sent
 * directly to the backend's FCM provider rather than through Expo's shared
 * push relay. Returns undefined on a simulator/emulator without push
 * services, if the user declines the permission, or if the token fetch
 * itself fails - callers must treat a missing token as "no push for this
 * device" rather than retrying indefinitely (the backend already handles a
 * customer with zero registered push tokens by failing that notification
 * closed).
 */
async function getNativePushToken(): Promise<string | undefined> {
  if (!Device.isDevice) return undefined;
  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') return undefined;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const token = await Notifications.getDevicePushTokenAsync();
    return token.data;
  } catch {
    return undefined;
  }
}

export async function getDeviceInfo(): Promise<DeviceInfo> {
  const deviceIdentifier = await getOrCreateDeviceIdentifier();
  const pushToken = await getNativePushToken();
  return {
    deviceIdentifier,
    platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
    pushToken,
  };
}
