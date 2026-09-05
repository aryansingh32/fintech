import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, LoadingState, PrimaryButton } from '@/components/ui';
import { useAllocationPreview, useCollectPayment, useLoan } from '@/hooks/useApi';
import { enqueueOfflinePayment } from '@/offline/offlineQueue';
import { formatMoney } from '@/utils/format';
import { generateIdempotencyKey, AllocationComponent, ApiError, PaymentMethod } from '@sptc/shared';
import { RootStackParamList } from '@/navigation/types';

const METHODS: PaymentMethod[] = [PaymentMethod.CASH, PaymentMethod.UPI, PaymentMethod.BANK, PaymentMethod.OTHER];

const COMPONENT_LABEL: Record<AllocationComponent, string> = {
  [AllocationComponent.DOWN_PAYMENT]: 'Down Payment',
  [AllocationComponent.EMI_PRINCIPAL]: 'EMI Principal',
  [AllocationComponent.EMI_CHARGES]: 'EMI Charges',
  [AllocationComponent.OVERDUE_PENALTY]: 'Overdue Penalty',
  [AllocationComponent.FEE]: 'Fee',
  [AllocationComponent.OTHER]: 'Other',
};

export function CollectPaymentScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'CollectPayment'>>();
  const { loanId, suggestedAmount } = route.params;

  const { data: loan } = useLoan(loanId);
  const [amount, setAmount] = useState(suggestedAmount ?? '');
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [referenceId, setReferenceId] = useState('');
  const parsedAmount = Number(amount) || 0;

  const preview = useAllocationPreview(loanId, parsedAmount);
  const collectPayment = useCollectPayment();
  const [submitting, setSubmitting] = useState(false);

  const onConfirm = async () => {
    if (!loan) return;
    setSubmitting(true);
    try {
      const result = await collectPayment.mutateAsync({
        loanId,
        amount: parsedAmount,
        method,
        referenceId: referenceId.trim() || undefined,
        idempotencyKey: generateIdempotencyKey(),
      });
      Alert.alert('Payment recorded', `Receipt ${result.receipt.receiptNumber} generated.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      const isNetworkError = !(err instanceof ApiError);
      if (isNetworkError) {
        // No connectivity - queue locally rather than losing the collection.
        // The sync engine (useOfflineSync) will post it once online, keyed
        // by its own clientTransactionId so it can never double-post.
        await enqueueOfflinePayment({
          loanId,
          loanNumber: loan.loanNumber,
          customerName: loan.customer?.name ?? '',
          amount: parsedAmount,
          method,
          referenceId: referenceId.trim() || undefined,
        });
        Alert.alert('Saved offline', 'No connection right now - this payment will sync automatically once you are back online.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Could not record payment', err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!loan) return <LoadingState label="Loading loan..." />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.caption}>{loan.customer?.name} · {loan.loanNumber}</Text>
        <Text style={styles.label}>Amount Collected</Text>
        <View style={styles.amountRow}>
          <Text style={styles.rupee}>₹</Text>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={styles.amountInput} />
        </View>

        <Text style={styles.label}>Payment Method</Text>
        <View style={styles.chipRow}>
          {METHODS.map((m) => (
            <Pressable key={m} onPress={() => setMethod(m)} style={[styles.chip, method === m && styles.chipActive]}>
              <Text style={[styles.chipText, method === m && styles.chipTextActive]}>{m}</Text>
            </Pressable>
          ))}
        </View>

        {method !== 'CASH' ? (
          <>
            <Text style={styles.label}>Reference ID</Text>
            <TextInput
              value={referenceId}
              onChangeText={setReferenceId}
              placeholder="Transaction reference"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
          </>
        ) : null}
      </Card>

      <Text style={styles.sectionTitle}>This payment will be allocated as:</Text>
      <Card>
        {preview.data?.lines.length ? (
          preview.data.lines.map((line, idx) => (
            <View key={idx} style={styles.allocationRow}>
              <Text style={styles.body}>{COMPONENT_LABEL[line.component]}</Text>
              <Text style={styles.bodyStrong}>{formatMoney(line.amount)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.caption}>Enter an amount to see the allocation.</Text>
        )}
      </Card>

      <View style={{ marginTop: spacing.xl }}>
        <PrimaryButton
          label={`Confirm ${formatMoney(parsedAmount)} Payment`}
          onPress={onConfirm}
          loading={submitting}
          disabled={parsedAmount <= 0}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  caption: { ...typography.caption, color: colors.textSecondary },
  label: { ...typography.captionStrong, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  rupee: { ...typography.h1, color: colors.textPrimary, marginRight: spacing.xs },
  amountInput: { ...typography.h1, color: colors.textPrimary, flex: 1, borderBottomWidth: 2, borderBottomColor: colors.brand },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { ...typography.caption, color: colors.textPrimary },
  chipTextActive: { color: colors.textInverse },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  sectionTitle: { ...typography.bodyStrong, color: colors.textPrimary, marginTop: spacing.xl, marginBottom: spacing.md },
  allocationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  body: { ...typography.body, color: colors.textPrimary },
  bodyStrong: { ...typography.bodyStrong, color: colors.textPrimary },
});
