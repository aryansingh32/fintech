import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, ErrorState, LoadingState, PrimaryButton } from '@/components/ui';
import { useAllocationPreview, useInitiatePayment } from '@/hooks/useApi';
import { formatMoney } from '@/utils/format';
import { RootStackParamList } from '@/navigation/types';
import { ApiError, AllocationComponent } from '@sptc/shared';

const COMPONENT_LABEL: Record<AllocationComponent, string> = {
  [AllocationComponent.DOWN_PAYMENT]: 'Down Payment',
  [AllocationComponent.EMI_PRINCIPAL]: 'EMI Principal',
  [AllocationComponent.EMI_CHARGES]: 'EMI Charges',
  [AllocationComponent.OVERDUE_PENALTY]: 'Overdue Penalty',
  [AllocationComponent.FEE]: 'Fee',
  [AllocationComponent.OTHER]: 'Other',
};

export function PayEmiScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'PayEmi'>>();
  const { loanId, suggestedAmount } = route.params;
  const [amount, setAmount] = useState(suggestedAmount);
  const parsedAmount = Number(amount) || 0;

  const preview = useAllocationPreview(loanId, parsedAmount);
  const initiate = useInitiatePayment();

  if (initiate.isError) {
    const message =
      initiate.error instanceof ApiError
        ? initiate.error.message
        : "We couldn't complete your payment right now. Your account has not been charged.";
    return (
      <View style={styles.screen}>
        <ErrorState message={message} onRetry={() => initiate.reset()} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.label}>Amount to pay</Text>
        <View style={styles.amountRow}>
          <Text style={styles.rupee}>₹</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            style={styles.amountInput}
          />
        </View>
      </Card>

      <Text style={styles.sectionTitle}>This payment will be allocated as:</Text>
      <Card>
        {preview.isLoading ? (
          <LoadingState label="Calculating..." />
        ) : preview.data?.lines.length ? (
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
          label={`Pay ${formatMoney(parsedAmount)}`}
          onPress={() => initiate.mutate({ loanId, amount: parsedAmount })}
          loading={initiate.isPending}
          disabled={parsedAmount <= 0}
        />
      </View>
      <Text style={styles.disclaimer}>
        Your payment is processed securely. You'll only be charged after confirmation from the payment provider.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  label: { ...typography.captionStrong, color: colors.textSecondary },
  amountRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  rupee: { ...typography.display, color: colors.textPrimary, marginRight: spacing.xs },
  amountInput: {
    ...typography.display,
    color: colors.textPrimary,
    flex: 1,
    borderBottomWidth: 2,
    borderBottomColor: colors.brand,
    paddingVertical: spacing.xs,
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
  caption: { ...typography.caption, color: colors.textSecondary },
  disclaimer: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.lg },
});
