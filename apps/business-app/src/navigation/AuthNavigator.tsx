import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '@/theme/theme';
import { AuthStackParamList } from './types';
import { StaffLoginScreen } from '@/screens/auth/StaffLoginScreen';
import { DeviceVerifyScreen } from '@/screens/auth/DeviceVerifyScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="StaffLogin" component={StaffLoginScreen} />
      <Stack.Screen
        name="DeviceVerify"
        component={DeviceVerifyScreen}
        options={{
          headerShown: true,
          title: 'Verify Device',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { fontFamily: 'Manrope_800ExtraBold' },
          headerTintColor: colors.ink,
        }}
      />
    </Stack.Navigator>
  );
}
