import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, ErrorState, LoadingState, PrimaryButton } from '@/components/ui';
import { useDecideLoan, useLoan } from '@/hooks/useApi';
import { formatDate, formatMoney } from '@/utils/format';
import { RootStackParamList } from '@/navigation/types';
import { ApiError } from '@sptc/shared';

export function LoanDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'LoanDetail'>>();
  const { data: loan, isLoading, isError, error, refetch } = useLoan(route.params.loanId);
  const decideLoan = useDecideLoan(route.params.loanId);
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineInput, setShowDeclineInput] = useState(false);

  if (isLoading) return <LoadingState label="Loading loan..." />;
  if (isError || !loan) {
    return <ErrorState message={error instanceof Error ? error.message : 'Could not load this loan.'} onRetry={refetch} />;
  }

  const riskProfile = loan.riskScoreSnapshot;

  const onApprove = () => {
    Alert.alert('Approve loan', `Approve ${loan.loanNumber} for ${formatMoney(loan.totalPayable)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          try {
            await decideLoan.mutateAsync({ decision: 'APPROVED' });
          } catch (err) {
            Alert.alert('Could not approve loan', err instanceof ApiError ? err.message : 'Please try again.');
          }
        },
      },
    ]);
  };

  const onDecline = async () => {
    if (!declineReason.trim()) {
      Alert.alert('A reason is required to decline.');
      return;
    }
    try {
      await decideLoan.mutateAsync({ decision: 'DECLINED', reason: declineReason.trim() });
    } catch (err) {
      Alert.alert('Could not decline loan', err instanceof ApiError ? err.message : 'Please try again.');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <View style={styles.row}>
          <Text style={styles.loanNumber}>{loan.loanNumber}</Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{loan.status.replace('_', ' ')}</Text>
          </View>
        </View>
        <Text style={styles.caption}>{loan.customer?.name}</Text>

        <View style={styles.grid}>
          <GridItem label="Cash Price" value={formatMoney(loan.cashPrice)} />
          <GridItem label="Down Payment" value={formatMoney(loan.downPaymentAmount)} />
          <GridItem label="Financed Principal" value={formatMoney(loan.financedPrincipal)} />
          <GridItem label="Finance Charges" value={formatMoney(loan.financeCharges)} />
          <GridItem label="Total Payable" value={formatMoney(loan.totalPayable)} />
          <GridItem label="Installment" value={`${formatMoney(loan.installmentAmount)} / ${loan.installmentFrequency.toLowerCase()}`} />
        </View>
      </Card>

      {loan.status === 'PENDING_APPROVAL' && riskProfile ? (
        <Card style={{ marginTop: spacing.lg, backgroundColor: colors.statusPendingSoft }}>
          <Text style={styles.sectionTitleInline}>Repayment Profile (Advisory Only)</Text>
          <Text style={styles.bigScore}>{riskProfile.score ?? '—'} / 100</Text>
          {riskProfile.reasons?.map((reason: string, idx: number) => (
            <Text key={idx} style={styles.caption}>
              • {reason}
            </Text>
          ))}
          <Text style={[styles.caption, { marginTop: spacing.sm, fontStyle: 'italic' }]}>
            This score never decides the outcome - you make the final call.
          </Text>
        </Card>
      ) : null}

      {loan.status === 'PENDING_APPROVAL' ? (
        <View style={styles.decisionBlock}>
          <PrimaryButton label="✓ Approve Loan" onPress={onApprove} loading={decideLoan.isPending} />
          <View style={{ height: spacing.md }} />
          {showDeclineInput ? (
            <>
              <TextInput
                value={declineReason}
                onChangeText={setDeclineReason}
                placeholder="Reason for declining..."
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />
              <View style={{ height: spacing.md }} />
              <PrimaryButton label="Confirm Decline" onPress={onDecline} variant="danger" loading={decideLoan.isPending} />
            </>
          ) : (
            <PrimaryButton label="✕ Decline Loan" onPress={() => setShowDeclineInput(true)} variant="secondary" />
          )}
        </View>
      ) : loan.status === 'ACTIVE' ? (
        <View style={{ marginTop: spacing.lg }}>
          <PrimaryButton
            label="Collect Payment"
            onPress={() => navigation.navigate('CollectPayment', { loanId: loan.id, suggestedAmount: loan.installmentAmount })}
          />
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>EMI Schedule</Text>
      <Card style={{ padding: 0 }}>
        {[...loan.installments]
          .sort((a, b) => a.sequence - b.sequence)
          .map((installment, index) => (
            <View key={installment.id} style={[styles.installmentRow, index > 0 && styles.installmentRowBorder]}>
              <View>
                <Text style={styles.bodyStrong}>EMI {installment.sequence}</Text>
                <Text style={styles.caption}>Due: {formatDate(installment.dueDate)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.bodyStrong}>{formatMoney(installment.totalAmount)}</Text>
                <Text style={styles.caption}>
                  {installment.status} {Number(installment.paidAmount) > 0 ? `· Paid ${formatMoney(installment.paidAmount)}` : ''}
                </Text>
              </View>
            </View>
          ))}
      </Card>
    </ScrollView>
  );
}

function GridItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.gridItem}>
      <Text style={styles.caption}>{label}</Text>
      <Text style={styles.bodyStrong}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loanNumber: { ...typography.h2, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  bodyStrong: { ...typography.bodyStrong, color: colors.textPrimary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.lg, gap: spacing.lg },
  gridItem: { width: '42%' },
  statusPill: { backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusText: { ...typography.captionStrong, color: colors.textPrimary },
  sectionTitleInline: { ...typography.bodyStrong, color: colors.textPrimary },
  bigScore: { ...typography.display, color: colors.textPrimary, marginVertical: spacing.sm },
  decisionBlock: { marginTop: spacing.lg },
  sectionTitle: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.xl, marginBottom: spacing.md },
  installmentRow: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.lg },
  installmentRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
});
