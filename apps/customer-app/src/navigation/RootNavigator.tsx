import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '@/theme/theme';
import { LoadingState } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { RootStackParamList } from './types';
import { AuthNavigator } from './AuthNavigator';
import { MainTabsNavigator } from './MainTabsNavigator';
import { CreatePinScreen } from '@/screens/auth/CreatePinScreen';
import { BiometricLockScreen } from '@/screens/auth/BiometricLockScreen';
import { LoanDetailScreen } from '@/screens/loans/LoanDetailScreen';
import { PayEmiScreen } from '@/screens/payments/PayEmiScreen';
import { ReceiptDetailScreen } from '@/screens/receipts/ReceiptDetailScreen';
import { SupportChatScreen } from '@/screens/support/SupportChatScreen';
import { NotificationsScreen } from '@/screens/home/NotificationsScreen';
import { KycStatusScreen } from '@/screens/profile/KycStatusScreen';
import { SecurityDevicesScreen } from '@/screens/profile/SecurityDevicesScreen';
import { TermsScreen } from '@/screens/profile/TermsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { status, isLocked } = useAuth();

  return (
    <NavigationContainer
      theme={{
        dark: false,
        colors: {
          primary: colors.brand,
          background: colors.background,
          card: colors.surface,
          text: colors.textPrimary,
          border: colors.border,
          notification: colors.statusOverdue,
        },
      }}
    >
      {status === 'loading' ? (
        <LoadingState label="Starting SPTC Finance..." />
      ) : status === 'unauthenticated' ? (
        <AuthNavigator />
      ) : status === 'pin_setup_required' ? (
        <CreatePinScreen />
      ) : isLocked ? (
        <BiometricLockScreen />
      ) : (
        <Stack.Navigator>
          <Stack.Screen name="Main" component={MainTabsNavigator} options={{ headerShown: false }} />
          <Stack.Screen name="LoanDetail" component={LoanDetailScreen} options={{ title: 'Loan Details' }} />
          <Stack.Screen name="PayEmi" component={PayEmiScreen} options={{ title: 'Pay EMI' }} />
          <Stack.Screen name="ReceiptDetail" component={ReceiptDetailScreen} options={{ title: 'Receipt' }} />
          <Stack.Screen name="SupportChat" component={SupportChatScreen} options={{ title: 'Support' }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
          <Stack.Screen name="KycStatus" component={KycStatusScreen} options={{ title: 'KYC Status' }} />
          <Stack.Screen name="SecurityDevices" component={SecurityDevicesScreen} options={{ title: 'Security & Devices' }} />
          <Stack.Screen name="Terms" component={TermsScreen} options={{ title: 'Terms & Privacy' }} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
