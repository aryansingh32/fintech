import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '@/theme/theme';
import { MainTabParamList } from './types';
import { DashboardScreen } from '@/screens/dashboard/DashboardScreen';
import { CustomerListScreen } from '@/screens/customers/CustomerListScreen';
import { LoansTabScreen } from '@/screens/loans/LoansTabScreen';
import { OverdueListScreen } from '@/screens/collections/OverdueListScreen';
import { ReportsTabScreen } from '@/screens/reports/ReportsTabScreen';
import { MoreScreen } from '@/screens/settings/MoreScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: Record<keyof MainTabParamList, { icon: { active: IconName; inactive: IconName }; label: string }> = {
  Dashboard: { icon: { active: 'stats-chart', inactive: 'stats-chart-outline' }, label: 'Home' },
  Customers: { icon: { active: 'people', inactive: 'people-outline' }, label: 'Customers' },
  Loans: { icon: { active: 'document-text', inactive: 'document-text-outline' }, label: 'Loans' },
  Collections: { icon: { active: 'cash', inactive: 'cash-outline' }, label: 'Collect' },
  Reports: { icon: { active: 'bar-chart', inactive: 'bar-chart-outline' }, label: 'Reports' },
  More: { icon: { active: 'grid', inactive: 'grid-outline' }, label: 'More' },
};

/** Floating capsule tab bar - the active tab expands into an icon+label pill, matching the reference nav design. */
function TabBarButton({
  focused,
  tab,
  onPress,
}: {
  focused: boolean;
  tab: { icon: { active: IconName; inactive: IconName }; label: string };
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(focused ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.spring(pop, { toValue: focused ? 1 : 0, useNativeDriver: false, speed: 18, bounciness: 8 }).start();
  }, [focused, pop]);

  const onPressIn = () => Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, speed: 40 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={styles.tabButton}>
      <Animated.View
        style={[
          styles.pill,
          {
            backgroundColor: colors.accent,
            paddingHorizontal: pop.interpolate({ inputRange: [0, 1], outputRange: [0, spacing.md] }),
            opacity: pop,
            transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          },
        ]}
      >
        {focused ? (
          <>
            <Ionicons name={tab.icon.active} size={18} color={colors.accentText} />
            <Text style={styles.pillLabel} numberOfLines={1}>
              {tab.label}
            </Text>
          </>
        ) : null}
      </Animated.View>
      {!focused ? (
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons name={tab.icon.inactive} size={22} color="rgba(255,255,255,0.55)" />
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.barWrap, { bottom: insets.bottom + spacing.sm }]} pointerEvents="box-none">
      <View style={styles.bar}>
        {state.routes.map((route: any, index: number) => {
          const focused = state.index === index;
          const tab = TABS[route.name as keyof MainTabParamList];
          return (
            <TabBarButton
              key={route.key}
              focused={focused}
              tab={tab}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

export function MainTabsNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: true, headerTitleStyle: { fontFamily: 'Manrope_800ExtraBold' } }}
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

export const TAB_BAR_CLEARANCE = 96;

const styles = StyleSheet.create({
  barWrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    backgroundColor: colors.ink,
    height: 64,
    width: '100%',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    overflow: 'hidden',
    ...shadow.raised,
  },
  tabButton: { minWidth: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  pillLabel: { ...typography.captionStrong, color: colors.accentText, marginLeft: spacing.xs },
});
