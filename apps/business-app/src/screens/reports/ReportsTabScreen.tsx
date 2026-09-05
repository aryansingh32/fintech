import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/theme';
import { Card, LoadingState } from '@/components/ui';
import { useDailyCollection, useLoanPortfolio, usePaymentReconciliation, useStaffPerformance } from '@/hooks/useApi';
import { formatMoney } from '@/utils/format';

export function ReportsTabScreen() {
  const dailyCollection = useDailyCollection();
  const loanPortfolio = useLoanPortfolio();
  const staffPerformance = useStaffPerformance();
  const reconciliation = usePaymentReconciliation();

  if (dailyCollection.isLoading || loanPortfolio.isLoading) return <LoadingState label="Loading reports..." />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Reports</Text>

      <Card>
        <Text style={styles.sectionTitle}>Daily Collection</Text>
        <Text style={styles.bigAmount}>{formatMoney(dailyCollection.data?.total ?? 0)}</Text>
        <Text style={styles.caption}>{dailyCollection.data?.count ?? 0} payment(s) today</Text>
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={styles.sectionTitle}>Loan Portfolio</Text>
        {loanPortfolio.data?.map((row) => (
          <View key={row.status} style={styles.rowBetween}>
            <Text style={styles.body}>{row.status.replace('_', ' ')}</Text>
            <Text style={styles.bodyStrong}>
              {row.count} · {formatMoney(row.totalPayable)}
            </Text>
          </View>
        ))}
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={styles.sectionTitle}>Staff Performance</Text>
        {(staffPerformance.data as { staffName: string; paymentsCollected: number; totalCollected: string }[] | undefined)?.map(
          (row, idx) => (
            <View key={idx} style={styles.rowBetween}>
              <Text style={styles.body}>{row.staffName}</Text>
              <Text style={styles.bodyStrong}>
                {row.paymentsCollected} · {formatMoney(row.totalCollected)}
              </Text>
            </View>
          ),
        )}
        {!staffPerformance.data?.length ? <Text style={styles.caption}>No collections recorded yet.</Text> : null}
      </Card>

      <Card style={{ marginTop: spacing.lg, marginBottom: spacing.xxl }}>
        <Text style={styles.sectionTitle}>Payment Reconciliation</Text>
        {(reconciliation.data as { method: string; status: string; count: number; total: string }[] | undefined)?.map(
          (row, idx) => (
            <View key={idx} style={styles.rowBetween}>
              <Text style={styles.body}>
                {row.method} · {row.status}
              </Text>
              <Text style={styles.bodyStrong}>
                {row.count} · {formatMoney(row.total)}
              </Text>
            </View>
          ),
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.lg },
  sectionTitle: { ...typography.bodyStrong, color: colors.textPrimary, marginBottom: spacing.sm },
  bigAmount: { ...typography.display, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  body: { ...typography.body, color: colors.textPrimary },
  bodyStrong: { ...typography.bodyStrong, color: colors.textPrimary },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
});
