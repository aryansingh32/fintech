import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types';
import { StaffLoginScreen } from '@/screens/auth/StaffLoginScreen';
import { DeviceVerifyScreen } from '@/screens/auth/DeviceVerifyScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StaffLogin" component={StaffLoginScreen} />
      <Stack.Screen name="DeviceVerify" component={DeviceVerifyScreen} options={{ headerShown: true, title: 'Verify Device' }} />
    </Stack.Navigator>
  );
}
