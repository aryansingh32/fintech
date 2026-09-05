import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import type { DeviceInfo } from '@sptc/shared';

const DEVICE_ID_KEY = 'sptc_staff_device_id';

async function getOrCreateDeviceIdentifier(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const generated = `staff-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
  return generated;
}

/** See customer-app's device.ts for the fail-soft rationale - a missing token just means no push for this device. */
async function getExpoPushToken(): Promise<string | undefined> {
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

    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch {
    return undefined;
  }
}

export async function getDeviceInfo(): Promise<DeviceInfo> {
  const deviceIdentifier = await getOrCreateDeviceIdentifier();
  const pushToken = await getExpoPushToken();
  return {
    deviceIdentifier,
    platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
    pushToken,
  };
}
