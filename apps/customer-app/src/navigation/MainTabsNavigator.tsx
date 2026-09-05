import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '@/theme/theme';
import { MainTabParamList } from './types';
import { HomeDashboardScreen } from '@/screens/home/HomeDashboardScreen';
import { LoanListScreen } from '@/screens/loans/LoanListScreen';
import { ReceiptHistoryScreen } from '@/screens/receipts/ReceiptHistoryScreen';
import { SupportListScreen } from '@/screens/support/SupportListScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, string> = {
  Home: '🏠',
  Loans: '📄',
  Payments: '🧾',
  Support: '💬',
  Profile: '👤',
};

export function MainTabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarIcon: () => <Text>{ICONS[route.name]}</Text>,
      })}
    >
      <Tab.Screen name="Home" component={HomeDashboardScreen} options={{ title: 'SPTC Finance' }} />
      <Tab.Screen name="Loans" component={LoanListScreen} options={{ title: 'My Loans' }} />
      <Tab.Screen name="Payments" component={ReceiptHistoryScreen} options={{ title: 'Receipts' }} />
      <Tab.Screen name="Support" component={SupportListScreen} options={{ title: 'Support' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
