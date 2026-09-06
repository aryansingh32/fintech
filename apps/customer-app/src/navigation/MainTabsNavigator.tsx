import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '@/theme/theme';
import { MainTabParamList } from './types';
import { HomeDashboardScreen } from '@/screens/home/HomeDashboardScreen';
import { LoanListScreen } from '@/screens/loans/LoanListScreen';
import { ReceiptHistoryScreen } from '@/screens/receipts/ReceiptHistoryScreen';
import { SupportListScreen } from '@/screens/support/SupportListScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: Record<keyof MainTabParamList, { icon: { active: IconName; inactive: IconName }; label: string }> = {
  Home: { icon: { active: 'home', inactive: 'home-outline' }, label: 'Home' },
  Loans: { icon: { active: 'document-text', inactive: 'document-text-outline' }, label: 'Loans' },
  Payments: { icon: { active: 'receipt', inactive: 'receipt-outline' }, label: 'Receipts' },
  Support: { icon: { active: 'chatbubble-ellipses', inactive: 'chatbubble-ellipses-outline' }, label: 'Support' },
  Profile: { icon: { active: 'person', inactive: 'person-outline' }, label: 'Profile' },
};

const ICON_SIZE = 22;
const INACTIVE_TINT = 'rgba(255,255,255,0.5)';

/** Floating black capsule bar - the active tab expands into a dark pill with icon+label. */
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
    Animated.spring(pop, { toValue: focused ? 1 : 0, useNativeDriver: false, speed: 16, bounciness: 6 }).start();
  }, [focused, pop]);

  const onPressIn = () => Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, speed: 40 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();

  return (
    <Animated.View style={{ flex: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 2.3] }), height: '100%' }}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={styles.tabButton}>
        <Animated.View
          style={[
            styles.pill,
            {
              backgroundColor: colors.accentStart,
              opacity: pop,
              paddingHorizontal: pop.interpolate({ inputRange: [0, 1], outputRange: [0, spacing.md] }),
              transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
            },
          ]}
          pointerEvents="none"
        >
          {focused ? (
            <>
              <Ionicons name={tab.icon.active} size={ICON_SIZE} color={colors.textInverse} />
              <Text style={styles.pillLabel} numberOfLines={1}>
                {tab.label}
              </Text>
            </>
          ) : null}
        </Animated.View>
        {!focused ? (
          <Animated.View style={[styles.icon, { transform: [{ scale }] }]}>
            <Ionicons name={tab.icon.inactive} size={ICON_SIZE} color={INACTIVE_TINT} />
          </Animated.View>
        ) : null}
      </Pressable>
    </Animated.View>
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
      screenOptions={{ headerShown: true, headerTitleStyle: { fontFamily: 'Manrope_700Bold' } }}
    >
      <Tab.Screen name="Home" component={HomeDashboardScreen} options={{ title: 'SPTC Finance' }} />
      <Tab.Screen name="Loans" component={LoanListScreen} options={{ title: 'My Loans' }} />
      <Tab.Screen name="Payments" component={ReceiptHistoryScreen} options={{ title: 'Receipts' }} />
      <Tab.Screen name="Support" component={SupportListScreen} options={{ title: 'Support' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

const BAR_HEIGHT = 72;
const PILL_HEIGHT = 48;

export const TAB_BAR_CLEARANCE = BAR_HEIGHT + spacing.xl;

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
    backgroundColor: colors.ink,
    height: BAR_HEIGHT,
    width: '100%',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    overflow: 'hidden',
    ...shadow.raised,
  },
  tabButton: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    height: PILL_HEIGHT,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  pillLabel: { ...typography.captionStrong, color: colors.textInverse, marginLeft: spacing.xs },
});
