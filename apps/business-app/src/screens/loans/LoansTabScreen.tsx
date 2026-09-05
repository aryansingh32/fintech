import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, EmptyState, LoadingState } from '@/components/ui';
import { useLoans } from '@/hooks/useApi';
import { formatMoney } from '@/utils/format';
import { LoanStatus } from '@sptc/shared';
import { MainTabParamList, RootStackParamList } from '@/navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Loans'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const FILTERS: { label: string; value?: LoanStatus }[] = [
  { label: 'All', value: undefined },
  { label: 'Pending', value: LoanStatus.PENDING_APPROVAL },
  { label: 'Active', value: LoanStatus.ACTIVE },
  { label: 'Completed', value: LoanStatus.COMPLETED },
];

export function LoansTabScreen() {
  const navigation = useNavigation<Nav>();
  const [filter, setFilter] = useState<LoanStatus | undefined>(undefined);
  const { data: loans, isLoading } = useLoans({ status: filter });

  return (
    <View style={styles.screen}>
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable key={f.label} onPress={() => setFilter(f.value)} style={[styles.chip, filter === f.value && styles.chipActive]}>
            <Text style={[styles.chipText, filter === f.value && styles.chipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <LoadingState label="Loading loans..." />
      ) : !loans?.length ? (
        <EmptyState title="No loans found" />
      ) : (
        <FlatList
          contentContainerStyle={styles.content}
          data={loans}
          keyExtractor={(l) => l.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate('LoanDetail', { loanId: item.id })}>
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.loanNumber}>{item.loanNumber}</Text>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
                  </View>
                </View>
                <Text style={styles.caption}>{item.customer?.name}</Text>
                <Text style={styles.amount}>{formatMoney(item.totalPayable)}</Text>
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { ...typography.caption, color: colors.textPrimary },
  chipTextActive: { color: colors.textInverse },
  content: { paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loanNumber: { ...typography.bodyStrong, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  amount: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.xs },
  statusPill: { backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusText: { ...typography.captionStrong, color: colors.textPrimary },
});
