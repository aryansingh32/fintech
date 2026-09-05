import React from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/theme';
import { Card, ErrorState, LoadingState, PrimaryButton } from '@/components/ui';
import { useReceipt } from '@/hooks/useApi';
import { formatDate, formatMoney } from '@/utils/format';
import { RootStackParamList } from '@/navigation/types';

export function ReceiptDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ReceiptDetail'>>();
  const { data: receipt, isLoading, isError, error, refetch } = useReceipt(route.params.receiptId);

  if (isLoading) return <LoadingState label="Loading receipt..." />;
  if (isError || !receipt) {
    return <ErrorState message={error instanceof Error ? error.message : 'Could not load this receipt.'} onRetry={refetch} />;
  }

  const onShare = () => {
    Share.share({
      message: `SPTC Finance Receipt ${receipt.receiptNumber}\nAmount: ${formatMoney(receipt.amount)}\nCollected by: ${receipt.collectorLabel}\nDate: ${formatDate(receipt.createdAt)}\nVerification ID: ${receipt.verificationId}`,
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <View style={styles.center}>
          <Text style={styles.checkmark}>✓</Text>
          <Text style={styles.amount}>{formatMoney(receipt.amount)}</Text>
          <Text style={styles.caption}>collected on {formatDate(receipt.createdAt)}</Text>
        </View>

        <View style={styles.divider} />

        <Row label="Receipt Number" value={receipt.receiptNumber} />
        <Row label="Collected By" value={receipt.collectorLabel} />
        <Row label="Previous Balance" value={formatMoney(receipt.previousBalance)} />
        <Row label="New Balance" value={formatMoney(receipt.newBalance)} />
        <Row label="Verification ID" value={receipt.verificationId} mono />
      </Card>

      <View style={{ marginTop: spacing.lg }}>
        <PrimaryButton label="Share Receipt" onPress={onShare} icon="share-outline" variant="secondary" />
      </View>
      <View style={{ marginTop: spacing.md }}>
        <PrimaryButton label="Done" onPress={() => navigation.popToTop()} />
      </View>

      <Text style={styles.footnote}>This receipt is tamper-evident. Its verification ID can be used to confirm authenticity.</Text>
    </ScrollView>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.caption}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  center: { alignItems: 'center', paddingVertical: spacing.md },
  checkmark: { fontSize: 40, color: colors.statusPaid, marginBottom: spacing.sm },
  amount: { ...typography.display, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  rowValue: { ...typography.bodyStrong, color: colors.textPrimary },
  mono: { fontFamily: 'monospace' },
  footnote: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.lg },
});
