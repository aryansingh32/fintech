import React, { useState } from 'react';
import { Alert, Modal, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, ErrorState, LoadingState, PrimaryButton } from '@/components/ui';
import { useReceipt, useReversePayment } from '@/hooks/useApi';
import { formatDate, formatMoney } from '@/utils/format';
import { RootStackParamList } from '@/navigation/types';
import { ApiError } from '@sptc/shared';

export function ReceiptDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ReceiptDetail'>>();
  const { data: receipt, isLoading, isError, error, refetch } = useReceipt(route.params.receiptId);
  const reversePayment = useReversePayment();
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [reversed, setReversed] = useState(false);

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
      {!reversed ? (
        <View style={{ marginTop: spacing.md }}>
          <PrimaryButton label="Reverse Payment" onPress={() => setShowReverseModal(true)} variant="danger" />
        </View>
      ) : (
        <Text style={styles.reversedNote}>This payment has been reversed.</Text>
      )}
      <View style={{ marginTop: spacing.md }}>
        <PrimaryButton label="Done" onPress={() => navigation.popToTop()} />
      </View>

      <Text style={styles.footnote}>This receipt is tamper-evident. Its verification ID can be used to confirm authenticity.</Text>

      {showReverseModal ? (
        <ReversePaymentModal
          onClose={() => setShowReverseModal(false)}
          onConfirm={async (reason) => {
            try {
              await reversePayment.mutateAsync({ paymentId: receipt.paymentId, reason });
              setReversed(true);
              setShowReverseModal(false);
              Alert.alert('Payment reversed', 'The customer has been notified.');
            } catch (err) {
              Alert.alert('Could not reverse payment', err instanceof ApiError ? err.message : 'Please try again.');
            }
          }}
          loading={reversePayment.isPending}
        />
      ) : null}
    </ScrollView>
  );
}

function ReversePaymentModal({
  onClose,
  onConfirm,
  loading,
}: {
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Reverse Payment</Text>
          <Text style={styles.caption}>
            This will undo the payment's allocation and notify the customer. This cannot be undone from the app.
          </Text>
          <Text style={[styles.caption, { marginTop: spacing.md, fontWeight: '700' }]}>Reason (required)</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. customer disputed the charge"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="Reverse"
                onPress={() => onConfirm(reason.trim())}
                loading={loading}
                disabled={!reason.trim()}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
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
  reversedNote: { ...typography.captionStrong, color: colors.statusOverdue, textAlign: 'center', marginTop: spacing.md },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  modalTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    marginTop: spacing.sm,
  },
});
