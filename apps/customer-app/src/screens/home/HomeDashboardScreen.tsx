import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { BalanceCard, Card, EmptyState, ErrorState, IconTile, LoadingState, PrimaryButton } from '@/components/ui';
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
  const hasUnreadNotifications = notifications?.some((n) => !n.readAt) ?? false;
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
        <Pressable onPress={() => navigation.navigate('Notifications')}>
          <IconTile icon="notifications" size={48} iconSize={22} />
          {hasUnreadNotifications ? <View style={styles.unreadDot} /> : null}
        </Pressable>
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
          icon="wallet"
          label="Pay EMI"
          onPress={() => activeLoan && navigation.navigate('PayEmi', { loanId: activeLoan.id, suggestedAmount: activeLoan.installmentAmount })}
          disabled={!activeLoan}
        />
        <QuickAction icon="document-text" label="View Loans" onPress={() => navigation.navigate('Loans')} />
        <QuickAction icon="receipt" label="Receipts" onPress={() => navigation.navigate('Payments')} />
        <QuickAction icon="chatbubble-ellipses" label="Support" onPress={() => navigation.navigate('Support')} />
      </View>
    </ScrollView>
  );
}

function ActiveLoanCard({ loan, onOpenLoan }: { loan: Loan; onOpenLoan: () => void }) {
  const summary = summarizeLoan(loan);
  const isOverdue = summary.overdueAmount > 0;
  const daysRemaining = summary.nextInstallment ? daysUntil(summary.nextInstallment.dueDate) : null;
  const progressPct = Math.min(100, (summary.installmentsPaid / summary.installmentsTotal) * 100);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, { toValue: progressPct, duration: 700, useNativeDriver: false }).start();
  }, [progressPct, progressAnim]);

  return (
    <BalanceCard style={styles.loanCard}>
      <Text style={styles.cardLabel}>ACTIVE LOAN</Text>

      <Text style={styles.cardLabel2}>Outstanding</Text>
      <Text style={styles.bigAmount}>{formatMoney(summary.outstanding)}</Text>

      {isOverdue ? (
        <View style={styles.overdueBanner}>
          <Ionicons name="warning" size={14} color={colors.statusOverdue} />
          <Text style={styles.overdueText}>{formatMoney(summary.overdueAmount)} overdue - please pay soon</Text>
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
          <Animated.View
            style={[
              styles.progressFill,
              { width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
            ]}
          />
        </View>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <PrimaryButton label="View Loan" onPress={onOpenLoan} variant="secondary" icon="arrow-forward" />
      </View>
    </BalanceCard>
  );
}

function QuickAction({ icon, label, onPress, disabled }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; disabled?: boolean }) {
  // Note: BlurView-backed Card must never sit inside an Animated transform (scale/translate) -
  // on Android its blur snapshot desyncs from the view's actual position, producing a duplicated
  // "ghost" box. Press feedback here is opacity-only, which is safe for blur content.
  return (
    <View style={[styles.quickActionItem, disabled && { opacity: 0.5 }]}>
      <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => pressed && { opacity: 0.6 }}>
        <Card style={styles.quickActionCard}>
          <IconTile icon={icon} size={40} iconSize={18} />
          <Text style={styles.quickActionLabel}>{label}</Text>
        </Card>
      </Pressable>
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
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing.lg, paddingBottom: 120 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { ...typography.body, color: colors.textSecondary },
  name: { ...typography.h1, color: colors.textPrimary },
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
  loanCard: { marginTop: spacing.lg },
  cardLabel: { ...typography.captionStrong, color: colors.accentStart, letterSpacing: 1 },
  cardLabel2: { ...typography.caption, color: colors.textInverseSecondary, marginTop: spacing.md },
  bigAmount: { ...typography.display, color: colors.textInverse },
  mediumAmount: { ...typography.h2, color: colors.textInverse },
  caption: { ...typography.caption, color: colors.textInverseSecondary },
  overdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(224,51,63,0.18)',
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  overdueText: { ...typography.captionStrong, color: colors.statusOverdue },
  row: { flexDirection: 'row', marginTop: spacing.lg, gap: spacing.xl },
  rowItem: { flex: 1 },
  progressRow: { marginTop: spacing.lg },
  progressTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.pill, marginTop: spacing.xs, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: colors.accentStart },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xl },
  quickActionItem: { width: '47%' },
  quickActionCard: { alignItems: 'flex-start', gap: spacing.sm },
  quickActionLabel: { ...typography.bodyStrong, color: colors.textPrimary },
});
