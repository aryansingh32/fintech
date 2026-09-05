import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useLoanList } from '@/hooks/useApi';
import { formatMoney } from '@/utils/format';
import { summarizeLoan } from '@/utils/loanMath';
import { RootStackParamList } from '@/navigation/types';

export function LoanListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data: loans, isLoading, isError, error, refetch } = useLoanList();

  if (isLoading) return <LoadingState label="Loading your loans..." />;
  if (isError) return <ErrorState message={error instanceof Error ? error.message : 'Please try again.'} onRetry={refetch} />;
  if (!loans?.length) return <EmptyState title="No loans yet" subtitle="Your financed purchases will appear here." />;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={loans}
      keyExtractor={(l) => l.id}
      renderItem={({ item }) => {
        const summary = summarizeLoan(item);
        return (
          <Pressable onPress={() => navigation.navigate('LoanDetail', { loanId: item.id })}>
            <Card style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.loanNumber}>{item.loanNumber}</Text>
                <View style={[styles.statusPill, item.status === 'ACTIVE' ? styles.statusActive : styles.statusOther]}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.caption}>Outstanding</Text>
                  <Text style={styles.amount}>{formatMoney(summary.outstanding)}</Text>
                </View>
                <View>
                  <Text style={styles.caption}>EMI</Text>
                  <Text style={styles.amount}>{formatMoney(item.installmentAmount)}/mo</Text>
                </View>
              </View>
              <Text style={styles.caption}>
                Progress: {summary.installmentsPaid} / {summary.installmentsTotal} EMIs
              </Text>
            </Card>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  card: { marginBottom: spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  loanNumber: { ...typography.bodyStrong, color: colors.textPrimary },
  amount: { ...typography.h2, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusActive: { backgroundColor: colors.statusPaidSoft },
  statusOther: { backgroundColor: colors.surfaceMuted },
  statusText: { ...typography.captionStrong, color: colors.textPrimary },
});
