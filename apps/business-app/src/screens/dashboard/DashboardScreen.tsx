import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { colors, spacing, typography } from '@/theme/theme';
import { Card, PrimaryButton } from '@/components/ui';
import { StatTile } from '@/components/StatTile';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useDailyCollection, useEmiDueToday, useLoanPortfolio, useLoans, useOverdueAging } from '@/hooks/useApi';
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
        <PrimaryButton label="🔍 Search" onPress={() => navigation.navigate('GlobalSearch')} variant="secondary" />
      </View>

      <View style={styles.grid}>
        <StatTile label="Today's Collection" value={formatMoney(dailyCollection.data?.total ?? 0)} accent="success" />
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
          <PrimaryButton label="New Customer" onPress={() => navigation.navigate('CreateCustomer')} variant="secondary" />
        </View>
        <View style={styles.quickActionItem}>
          <PrimaryButton label="Collections" onPress={() => navigation.navigate('Collections')} variant="secondary" />
        </View>
      </View>

      {identity?.isGlobal ? (
        <View style={{ marginTop: spacing.lg }}>
          <PrimaryButton label="Manage Loan Products" onPress={() => navigation.navigate('LoanProductsAdmin')} variant="secondary" />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  title: { ...typography.h1, color: colors.textPrimary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  pendingCard: { marginTop: spacing.md, backgroundColor: colors.statusPendingSoft, borderColor: colors.statusPending },
  sectionTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  quickActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  quickActionItem: { flex: 1 },
});
