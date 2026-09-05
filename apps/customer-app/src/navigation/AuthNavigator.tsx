import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types';
import { MobileLoginScreen } from '@/screens/auth/MobileLoginScreen';
import { OtpVerifyScreen } from '@/screens/auth/OtpVerifyScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MobileLogin" component={MobileLoginScreen} />
      <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} options={{ headerShown: true, title: 'Verify' }} />
    </Stack.Navigator>
  );
}
