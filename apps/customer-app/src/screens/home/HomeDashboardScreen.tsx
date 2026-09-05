import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, EmptyState, ErrorState, LoadingState, PrimaryButton } from '@/components/ui';
import { useLoanList, useNotifications } from '@/hooks/useApi';
import { formatDate, formatMoney, daysUntil } from '@/utils/format';
import { summarizeLoan } from '@/utils/loanMath';
import { Loan, LoanStatus } from '@sptc/shared';
import { MainTabParamList, RootStackParamList } from '@/navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function HomeDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { data: loans, isLoading, isError, error, refetch, isRefetching } = useLoanList();
  const { data: notifications } = useNotifications();

  if (isLoading) return <LoadingState label="Loading your account..." />;
  if (isError) {
    return <ErrorState message={error instanceof Error ? error.message : 'Please try again.'} onRetry={refetch} />;
  }

  const activeLoan = loans?.find((l) => l.status === LoanStatus.ACTIVE) ?? loans?.[0];
  const unreadNotifications = notifications?.filter((n) => n.status !== 'DELIVERED').length ?? 0;
  const greeting = getGreeting();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.name}>Welcome back</Text>
        </View>
        <PrimaryButton
          label={unreadNotifications > 0 ? `🔔 ${unreadNotifications}` : '🔔'}
          onPress={() => navigation.navigate('Notifications')}
          variant="secondary"
        />
      </View>

      {!activeLoan ? (
        <Card style={{ marginTop: spacing.xl }}>
          <EmptyState title="No active loans yet" subtitle="Visit your SPTC Finance store to set up a financing plan." />
        </Card>
      ) : (
        <ActiveLoanCard loan={activeLoan} onOpenLoan={() => navigation.navigate('LoanDetail', { loanId: activeLoan.id })} />
      )}

      <View style={styles.quickActions}>
        <QuickAction
          label="Pay EMI"
          onPress={() => activeLoan && navigation.navigate('PayEmi', { loanId: activeLoan.id, suggestedAmount: activeLoan.installmentAmount })}
          disabled={!activeLoan}
        />
        <QuickAction label="View Loans" onPress={() => navigation.navigate('Loans')} />
        <QuickAction label="Receipts" onPress={() => navigation.navigate('Payments')} />
        <QuickAction label="Support" onPress={() => navigation.navigate('Support')} />
      </View>
    </ScrollView>
  );
}

function ActiveLoanCard({ loan, onOpenLoan }: { loan: Loan; onOpenLoan: () => void }) {
  const summary = summarizeLoan(loan);
  const isOverdue = summary.overdueAmount > 0;
  const daysRemaining = summary.nextInstallment ? daysUntil(summary.nextInstallment.dueDate) : null;

  return (
    <Card style={styles.loanCard}>
      <Text style={styles.cardLabel}>ACTIVE LOAN</Text>

      <Text style={styles.cardLabel2}>Outstanding</Text>
      <Text style={styles.bigAmount}>{formatMoney(summary.outstanding)}</Text>

      {isOverdue ? (
        <View style={styles.overdueBanner}>
          <Text style={styles.overdueText}>⚠ {formatMoney(summary.overdueAmount)} overdue - please pay soon</Text>
        </View>
      ) : null}

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.cardLabel2}>Next EMI</Text>
          <Text style={styles.mediumAmount}>
            {summary.nextInstallment ? formatMoney(summary.nextInstallment.totalAmount) : '—'}
          </Text>
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.cardLabel2}>Due Date</Text>
          <Text style={styles.mediumAmount}>
            {summary.nextInstallment ? formatDate(summary.nextInstallment.dueDate) : '—'}
          </Text>
          {daysRemaining !== null ? (
            <Text style={styles.caption}>
              {daysRemaining > 0 ? `${daysRemaining} days remaining` : daysRemaining === 0 ? 'Due today' : `${Math.abs(daysRemaining)} days overdue`}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.progressRow}>
        <Text style={styles.caption}>
          EMIs: {summary.installmentsPaid} Paid / {summary.installmentsTotal} Total
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(100, (summary.installmentsPaid / summary.installmentsTotal) * 100)}%` },
            ]}
          />
        </View>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <PrimaryButton label="View Loan" onPress={onOpenLoan} variant="secondary" />
      </View>
    </Card>
  );
}

function QuickAction({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <View style={styles.quickActionItem}>
      <PrimaryButton label={label} onPress={onPress} disabled={disabled} variant="secondary" />
    </View>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { ...typography.body, color: colors.textSecondary },
  name: { ...typography.h1, color: colors.textPrimary },
  loanCard: { marginTop: spacing.lg },
  cardLabel: { ...typography.captionStrong, color: colors.brand, letterSpacing: 1 },
  cardLabel2: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.md },
  bigAmount: { ...typography.display, color: colors.textPrimary },
  mediumAmount: { ...typography.h2, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary },
  overdueBanner: {
    backgroundColor: colors.statusOverdueSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  overdueText: { ...typography.captionStrong, color: colors.statusOverdue },
  row: { flexDirection: 'row', marginTop: spacing.lg, gap: spacing.xl },
  rowItem: { flex: 1 },
  progressRow: { marginTop: spacing.lg },
  progressTrack: { height: 8, backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, marginTop: spacing.xs, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: colors.statusPaid },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xl },
  quickActionItem: { width: '47%' },
});
