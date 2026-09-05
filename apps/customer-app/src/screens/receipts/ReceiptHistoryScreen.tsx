import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/theme';
import { Card, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useReceipts } from '@/hooks/useApi';
import { formatDate, formatMoney } from '@/utils/format';
import { RootStackParamList } from '@/navigation/types';

export function ReceiptHistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data: receipts, isLoading, isError, error, refetch } = useReceipts();

  if (isLoading) return <LoadingState label="Loading receipts..." />;
  if (isError) return <ErrorState message={error instanceof Error ? error.message : 'Please try again.'} onRetry={refetch} />;
  if (!receipts?.length) return <EmptyState title="No receipts yet" subtitle="Receipts appear here after each payment." />;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={receipts}
      keyExtractor={(r) => r.id}
      renderItem={({ item }) => (
        <Pressable onPress={() => navigation.navigate('ReceiptDetail', { receiptId: item.id })}>
          <Card style={styles.card}>
            <View style={styles.row}>
              <View>
                <Text style={styles.receiptNumber}>{item.receiptNumber}</Text>
                <Text style={styles.caption}>{formatDate(item.createdAt)} · {item.collectorLabel}</Text>
              </View>
              <Text style={styles.amount}>{formatMoney(item.amount)}</Text>
            </View>
          </Card>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 120 },
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  receiptNumber: { ...typography.bodyStrong, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  amount: { ...typography.h2, color: colors.statusPaid },
});
