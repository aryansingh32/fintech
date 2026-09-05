import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { colors, spacing, typography } from '@/theme/theme';
import { Card, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useCustomerLedger } from '@/hooks/useApi';
import { formatDateTime, formatMoney } from '@/utils/format';
import { RootStackParamList } from '@/navigation/types';

export function CustomerLedgerScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'CustomerLedger'>>();
  const { data: entries, isLoading, isError, error, refetch } = useCustomerLedger(route.params.customerId);

  if (isLoading) return <LoadingState label="Loading ledger..." />;
  if (isError) return <ErrorState message={error instanceof Error ? error.message : 'Please try again.'} onRetry={refetch} />;
  if (!entries?.length) return <EmptyState title="No ledger entries yet" subtitle="Every payment, EMI, and adjustment for this customer will appear here." />;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={entries}
      keyExtractor={(e) => e.id}
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.type}>{item.entryType.replace(/_/g, ' ')}</Text>
            <Text style={styles.caption}>{formatDateTime(item.createdAt)}</Text>
          </View>
          <Text style={styles.description}>{item.description}</Text>
          <View style={styles.row}>
            <Text style={styles.caption}>
              {item.referenceType} · {item.referenceId.slice(0, 8)}
            </Text>
            <View style={{ alignItems: 'flex-end' }}>
              {Number(item.debit) > 0 ? <Text style={styles.debit}>Debit {formatMoney(item.debit)}</Text> : null}
              {Number(item.credit) > 0 ? <Text style={styles.credit}>Credit {formatMoney(item.credit)}</Text> : null}
              <Text style={styles.balance}>Balance {formatMoney(item.balanceAfter)}</Text>
            </View>
          </View>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  type: { ...typography.captionStrong, color: colors.brand, textTransform: 'uppercase' },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  description: { ...typography.body, color: colors.textPrimary, marginVertical: spacing.xs },
  debit: { ...typography.captionStrong, color: colors.statusOverdue },
  credit: { ...typography.captionStrong, color: colors.statusPaid },
  balance: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
