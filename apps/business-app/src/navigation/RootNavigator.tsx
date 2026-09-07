import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '@/theme/theme';
import { LoadingState } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { RootStackParamList } from './types';
import { AuthNavigator } from './AuthNavigator';
import { MainTabsNavigator } from './MainTabsNavigator';
import { GlobalSearchScreen } from '@/screens/search/GlobalSearchScreen';
import { CustomerProfileScreen } from '@/screens/customers/CustomerProfileScreen';
import { EditCustomerScreen } from '@/screens/customers/EditCustomerScreen';
import { CreateCustomerScreen } from '@/screens/customers/CreateCustomerScreen';
import { CreateLoanScreen } from '@/screens/loans/CreateLoanScreen';
import { LoanDetailScreen } from '@/screens/loans/LoanDetailScreen';
import { CollectPaymentScreen } from '@/screens/collections/CollectPaymentScreen';
import { CustomerReceiptsScreen } from '@/screens/receipts/CustomerReceiptsScreen';
import { ReceiptDetailScreen } from '@/screens/receipts/ReceiptDetailScreen';
import { CustomerLedgerScreen } from '@/screens/customers/CustomerLedgerScreen';
import { AuditLogScreen } from '@/screens/settings/AuditLogScreen';
import { StaffSupportListScreen } from '@/screens/support/StaffSupportListScreen';
import { StaffSupportChatScreen } from '@/screens/support/StaffSupportChatScreen';
import { LoanProductsAdminScreen } from '@/screens/settings/LoanProductsAdminScreen';
import { AgreementTemplatesAdminScreen } from '@/screens/settings/AgreementTemplatesAdminScreen';
import { StaffManagementScreen } from '@/screens/settings/StaffManagementScreen';
import { StaffProfileScreen } from '@/screens/settings/StaffProfileScreen';
import { SecurityDevicesScreen } from '@/screens/settings/SecurityDevicesScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { status } = useAuth();

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
        <LoadingState label="Starting SPTC Finance Business..." />
      ) : status === 'unauthenticated' || status === 'device_verification_required' ? (
        <AuthNavigator />
      ) : (
        <Stack.Navigator
          screenOptions={{
            animation: 'slide_from_right',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.surface },
            headerTitleStyle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 18, color: colors.textPrimary },
            headerTintColor: colors.ink,
          }}
        >
          <Stack.Screen name="Main" component={MainTabsNavigator} options={{ headerShown: false }} />
          <Stack.Screen name="GlobalSearch" component={GlobalSearchScreen} options={{ title: 'Search' }} />
          <Stack.Screen name="CustomerProfile" component={CustomerProfileScreen} options={{ title: 'Customer' }} />
          <Stack.Screen name="EditCustomer" component={EditCustomerScreen} options={{ title: 'Edit Customer' }} />
          <Stack.Screen name="CreateCustomer" component={CreateCustomerScreen} options={{ title: 'New Customer' }} />
          <Stack.Screen name="CreateLoan" component={CreateLoanScreen} options={{ title: 'New Loan' }} />
          <Stack.Screen name="LoanDetail" component={LoanDetailScreen} options={{ title: 'Loan' }} />
          <Stack.Screen name="CollectPayment" component={CollectPaymentScreen} options={{ title: 'Collect Payment' }} />
          <Stack.Screen name="CustomerReceipts" component={CustomerReceiptsScreen} options={{ title: 'Receipts' }} />
          <Stack.Screen name="CustomerLedger" component={CustomerLedgerScreen} options={{ title: 'Transaction Ledger' }} />
          <Stack.Screen name="ReceiptDetail" component={ReceiptDetailScreen} options={{ title: 'Receipt' }} />
          <Stack.Screen name="AuditLog" component={AuditLogScreen} options={{ title: 'Activity Log' }} />
          <Stack.Screen name="SupportList" component={StaffSupportListScreen} options={{ title: 'Support' }} />
          <Stack.Screen name="SupportChat" component={StaffSupportChatScreen} options={{ title: 'Ticket' }} />
          <Stack.Screen name="LoanProductsAdmin" component={LoanProductsAdminScreen} options={{ title: 'Loan Products' }} />
          <Stack.Screen name="AgreementTemplatesAdmin" component={AgreementTemplatesAdminScreen} options={{ title: 'Agreements' }} />
          <Stack.Screen name="StaffManagement" component={StaffManagementScreen} options={{ title: 'Staff & Approvals' }} />
          <Stack.Screen name="Profile" component={StaffProfileScreen} options={{ title: 'Profile' }} />
          <Stack.Screen name="SecurityDevices" component={SecurityDevicesScreen} options={{ title: 'Active Sessions' }} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
