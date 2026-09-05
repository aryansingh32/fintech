import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '@/theme/theme';
import { MainTabParamList } from './types';
import { DashboardScreen } from '@/screens/dashboard/DashboardScreen';
import { CustomerListScreen } from '@/screens/customers/CustomerListScreen';
import { LoansTabScreen } from '@/screens/loans/LoansTabScreen';
import { OverdueListScreen } from '@/screens/collections/OverdueListScreen';
import { ReportsTabScreen } from '@/screens/reports/ReportsTabScreen';
import { MoreScreen } from '@/screens/settings/MoreScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, string> = {
  Dashboard: '📊',
  Customers: '👥',
  Loans: '📄',
  Collections: '💰',
  Reports: '📈',
  More: '☰',
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
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'SPTC Finance' }} />
      <Tab.Screen name="Customers" component={CustomerListScreen} />
      <Tab.Screen name="Loans" component={LoansTabScreen} />
      <Tab.Screen name="Collections" component={OverdueListScreen} options={{ title: 'Overdue Collections' }} />
      <Tab.Screen name="Reports" component={ReportsTabScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
}
