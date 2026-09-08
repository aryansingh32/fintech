import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { colors, spacing, typography } from '@/theme/theme';
import { BalanceCard, Card, IconTile, PrimaryButton } from '@/components/ui';
import { StatTile } from '@/components/StatTile';
import { OfflineBanner } from '@/components/OfflineBanner';
import { canManageCustomersAndLoans } from '@/rbac/uiPermissions';
import {
  useDailyCollection,
  useEmiDueToday,
  useLoanPortfolio,
  useLoans,
  useNotifications,
  useOverdueAging,
} from '@/hooks/useApi';
import { formatMoney } from '@/utils/format';
import { useAuth } from '@/auth/AuthContext';
import { MainTabParamList, RootStackParamList } from '@/navigation/types';
import { LoanStatus } from '@sptc/shared';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Dashboard'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { identity } = useAuth();
  const dailyCollection = useDailyCollection();
  const overdueAging = useOverdueAging();
  const loanPortfolio = useLoanPortfolio();
  const emiDueToday = useEmiDueToday();
  const pendingApprovals = useLoans({ status: LoanStatus.PENDING_APPROVAL });
  const { data: notifications } = useNotifications();
  const hasUnreadNotifications = notifications?.some((n) => !n.readAt) ?? false;

  const isLoading =
    dailyCollection.isLoading || overdueAging.isLoading || loanPortfolio.isLoading || emiDueToday.isLoading;

  const activeLoans = loanPortfolio.data?.find((r) => r.status === 'ACTIVE')?.count ?? 0;
  const overdueTotal = overdueAging.data
    ? Object.values(overdueAging.data)
        .flat()
        .reduce((sum: number, row) => sum + Number((row as { overdueAmount: string }).overdueAmount), 0)
    : 0;

  const refresh = () => {
    dailyCollection.refetch();
    overdueAging.refetch();
    loanPortfolio.refetch();
    emiDueToday.refetch();
    pendingApprovals.refetch();
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
    >
      <OfflineBanner />

      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => navigation.navigate('Notifications')}>
            <IconTile icon="notifications" size={44} iconSize={20} bg={colors.surfaceMuted} iconColor={colors.textPrimary} />
            {hasUnreadNotifications ? <View style={styles.unreadDot} /> : null}
          </Pressable>
          <Pressable onPress={() => navigation.navigate('GlobalSearch')}>
            <IconTile icon="search" size={44} iconSize={20} bg={colors.surfaceMuted} iconColor={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      <BalanceCard style={styles.heroCard}>
        <Text style={styles.heroLabel}>TODAY'S COLLECTION</Text>
        <Text style={styles.heroAmount}>{formatMoney(dailyCollection.data?.total ?? 0)}</Text>
        <Text style={styles.heroCaption}>{dailyCollection.data?.count ?? 0} payments collected today</Text>
      </BalanceCard>

      <View style={styles.grid}>
        <StatTile label="Total Overdue" value={formatMoney(overdueTotal)} accent="danger" />
        <StatTile label="Active Loans" value={String(activeLoans)} />
        <StatTile label="Due Today" value={String(emiDueToday.data?.length ?? 0)} />
      </View>

      {(pendingApprovals.data?.length ?? 0) > 0 ? (
        <Card style={styles.pendingCard}>
          <Text style={styles.sectionTitle}>Pending Actions</Text>
          <Text style={styles.body}>
            {pendingApprovals.data!.length} loan application(s) awaiting your decision.
          </Text>
          <View style={{ marginTop: spacing.md }}>
            <PrimaryButton
              label="Review Applications"
              onPress={() => navigation.navigate('LoanDetail', { loanId: pendingApprovals.data![0].id })}
            />
          </View>
        </Card>
      ) : null}

      <View style={styles.quickActions}>
        <View style={styles.quickActionItem}>
          <PrimaryButton label="New Customer" icon="person-add" onPress={() => navigation.navigate('CreateCustomer')} variant="secondary" />
        </View>
        <View style={styles.quickActionItem}>
          <PrimaryButton label="Collections" icon="cash" onPress={() => navigation.navigate('Collections')} variant="secondary" />
        </View>
      </View>

      {identity && canManageCustomersAndLoans(identity.role) ? (
        <View style={{ marginTop: spacing.lg }}>
          <PrimaryButton label="Manage Loan Products" icon="settings" onPress={() => navigation.navigate('LoanProductsAdmin')} variant="secondary" />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 120 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  unreadDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.statusOverdue,
    borderWidth: 2,
    borderColor: colors.background,
  },
  title: { ...typography.h1, color: colors.textPrimary },
  heroCard: { marginBottom: spacing.lg },
  heroLabel: { ...typography.captionStrong, color: colors.accent, letterSpacing: 1 },
  heroAmount: { ...typography.display, color: colors.textInverse, marginTop: spacing.sm },
  heroCaption: { ...typography.caption, color: colors.textInverseSecondary, marginTop: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  pendingCard: { marginTop: spacing.md, backgroundColor: colors.statusPendingSoft },
  sectionTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  quickActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  quickActionItem: { flex: 1 },
});
