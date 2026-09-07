import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/theme';
import { Card, ErrorState, LoadingState, PrimaryButton, StatusBadge } from '@/components/ui';
import { useAcceptLoanAgreement, useLoanDetail } from '@/hooks/useApi';
import { formatDate, formatMoney } from '@/utils/format';
import { summarizeLoan } from '@/utils/loanMath';
import { RootStackParamList } from '@/navigation/types';
import { ApiError } from '@sptc/shared';

export function LoanDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'LoanDetail'>>();
  const { data: loan, isLoading, isError, error, refetch } = useLoanDetail(route.params.loanId);
  const acceptAgreement = useAcceptLoanAgreement(route.params.loanId);

  if (isLoading) return <LoadingState label="Loading loan..." />;
  if (isError || !loan) {
    return <ErrorState message={error instanceof Error ? error.message : 'Could not load this loan.'} onRetry={refetch} />;
  }

  const onAcceptAgreement = async () => {
    try {
      await acceptAgreement.mutateAsync();
    } catch (err) {
      Alert.alert('Could not accept agreement', err instanceof ApiError ? err.message : 'Please try again.');
    }
  };

  const summary = summarizeLoan(loan);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.loanNumber}>{loan.loanNumber}</Text>
        <Text style={styles.caption}>{loan.status.replace('_', ' ')}</Text>

        <View style={styles.grid}>
          <GridItem label="Cash Price" value={formatMoney(loan.cashPrice)} />
          <GridItem label="Down Payment" value={formatMoney(loan.downPaymentAmount)} />
          <GridItem label="Financed Principal" value={formatMoney(loan.financedPrincipal)} />
          <GridItem label="Finance Charges" value={formatMoney(loan.financeCharges)} />
          <GridItem label="Total Payable" value={formatMoney(loan.totalPayable)} />
          <GridItem label="Installment" value={`${formatMoney(loan.installmentAmount)} / ${loan.installmentFrequency.toLowerCase()}`} />
          <GridItem label="Start Date" value={formatDate(loan.startDate)} />
          <GridItem label="Maturity Date" value={formatDate(loan.maturityDate)} />
        </View>

        <View style={styles.outstandingBlock}>
          <Text style={styles.caption}>Current Outstanding</Text>
          <Text style={styles.bigAmount}>{formatMoney(summary.outstanding)}</Text>
        </View>

        {loan.status === 'ACTIVE' ? (
          <View style={{ marginTop: spacing.lg }}>
            <PrimaryButton
              label="Pay EMI"
              onPress={() => navigation.navigate('PayEmi', { loanId: loan.id, suggestedAmount: loan.installmentAmount })}
            />
          </View>
        ) : null}
      </Card>

      <Text style={styles.sectionTitle}>EMI Schedule</Text>
      <Card style={{ padding: 0 }}>
        {[...loan.installments]
          .sort((a, b) => a.sequence - b.sequence)
          .map((installment, index) => (
            <View
              key={installment.id}
              style={[styles.installmentRow, index > 0 && styles.installmentRowBorder]}
            >
              <View>
                <Text style={styles.installmentTitle}>EMI {installment.sequence}</Text>
                <Text style={styles.caption}>Due: {formatDate(installment.dueDate)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.installmentAmount}>{formatMoney(installment.totalAmount)}</Text>
                <StatusBadge status={installment.status} />
                {Number(installment.penaltyAmount ?? 0) > 0 ? (
                  <Text style={styles.penaltyCaption}>Includes penalty {formatMoney(installment.penaltyAmount!)}</Text>
                ) : null}
              </View>
            </View>
          ))}
      </Card>

      {loan.agreement ? (
        <Card style={{ marginTop: spacing.lg }}>
          <Text style={styles.sectionTitleInline}>Agreement</Text>
          <Text style={styles.caption}>Version {loan.agreement.version} · {formatDate(loan.agreement.createdAt)}</Text>
          {typeof loan.agreement.termsSnapshot?.agreementTemplateContent === 'string' ? (
            <Text style={styles.agreementBody}>{loan.agreement.termsSnapshot.agreementTemplateContent as string}</Text>
          ) : null}
          {loan.agreement.acceptedByCustomerAt ? (
            <Text style={styles.acceptedNote}>Accepted on {formatDate(loan.agreement.acceptedByCustomerAt)}</Text>
          ) : (
            <View style={{ marginTop: spacing.md }}>
              <PrimaryButton label="Accept Agreement" onPress={onAcceptAgreement} loading={acceptAgreement.isPending} />
            </View>
          )}
        </Card>
      ) : null}
    </ScrollView>
  );
}

function GridItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.gridItem}>
      <Text style={styles.caption}>{label}</Text>
      <Text style={styles.gridValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  loanNumber: { ...typography.h2, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary },
  penaltyCaption: { ...typography.caption, color: colors.statusOverdue, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.lg, gap: spacing.lg },
  gridItem: { width: '42%' },
  gridValue: { ...typography.bodyStrong, color: colors.textPrimary, marginTop: 2 },
  outstandingBlock: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  bigAmount: { ...typography.display, color: colors.textPrimary },
  sectionTitle: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitleInline: { ...typography.bodyStrong, color: colors.textPrimary },
  agreementBody: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 20 },
  acceptedNote: { ...typography.captionStrong, color: colors.statusPaid, marginTop: spacing.sm },
  installmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
  },
  installmentRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  installmentTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  installmentAmount: { ...typography.bodyStrong, color: colors.textPrimary, marginBottom: spacing.xs },
});
