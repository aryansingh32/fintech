import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import RazorpayCheckout from 'react-native-razorpay';
import { colors, spacing, typography } from '@/theme/theme';
import { Card, ErrorState, LoadingState, PrimaryButton } from '@/components/ui';
import { useAllocationPreview } from '@/hooks/useApi';
import { useMyProfile } from '@/hooks/useProfile';
import { apiClient } from '@/api/apiClient';
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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'PayEmi'>>();
  const { loanId, suggestedAmount } = route.params;
  const [amount, setAmount] = useState(suggestedAmount);
  const parsedAmount = Number(amount) || 0;

  const preview = useAllocationPreview(loanId, parsedAmount);
  const { data: profile } = useMyProfile();
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPay = async () => {
    setError(null);
    setIsPaying(true);
    try {
      // Step 1: open a checkout session. No local record is created yet -
      // the gateway's order IS the pending state until it's confirmed.
      const order = await apiClient.payments.customerInitiate(loanId, parsedAmount);

      // Step 2: the native checkout SDK handles card/UPI/wallet entry.
      // A rejected promise here means the customer cancelled or the
      // checkout itself failed - never treated as a successful payment.
      const checkoutResult = await RazorpayCheckout.open({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: 'SPTC Finance',
        description: 'EMI Payment',
        prefill: { name: profile?.name, contact: profile?.mobile },
        theme: { color: colors.ink },
      });

      // Step 3: verify the SDK's signed callback and post the payment.
      // The signature can only have been produced by Razorpay (it's an
      // HMAC keyed with our secret, which never leaves the server) - so
      // this is authoritative confirmation, not a bare client claim.
      await apiClient.payments.customerConfirm({
        loanId,
        razorpayOrderId: checkoutResult.razorpay_order_id,
        razorpayPaymentId: checkoutResult.razorpay_payment_id,
        razorpaySignature: checkoutResult.razorpay_signature,
        amount: parsedAmount,
      });

      Alert.alert('Payment successful', 'Your receipt is now available.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (isRazorpayCancellation(err)) {
        // Customer closed the checkout sheet - not an error worth alarming them with.
      } else {
        setError("We couldn't complete your payment right now. Your account has not been charged.");
      }
    } finally {
      setIsPaying(false);
    }
  };

  if (error) {
    return (
      <View style={styles.screen}>
        <ErrorState message={error} onRetry={() => setError(null)} />
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
          onPress={onPay}
          loading={isPaying}
          disabled={parsedAmount <= 0}
        />
      </View>
      <Text style={styles.disclaimer}>
        Your payment is processed securely by Razorpay. You'll only be charged after confirmation from the payment
        provider.
      </Text>
    </ScrollView>
  );
}

function isRazorpayCancellation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err;
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
