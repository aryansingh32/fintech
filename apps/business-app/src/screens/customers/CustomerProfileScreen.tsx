import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, ErrorState, LoadingState, PrimaryButton } from '@/components/ui';
import { useCustomer, useCustomerLoans, useRepaymentProfile } from '@/hooks/useApi';
import { apiClient } from '@/api/apiClient';
import { formatMoney } from '@/utils/format';
import { RootStackParamList } from '@/navigation/types';

export function CustomerProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'CustomerProfile'>>();
  const { customerId } = route.params;

  const { data: customer, isLoading, isError, error, refetch } = useCustomer(customerId);
  const { data: loans } = useCustomerLoans(customerId);
  const { data: repayment } = useRepaymentProfile(customerId);
  const { data: kycRecords } = useQuery({
    queryKey: ['kyc', customerId],
    queryFn: () => apiClient.kyc.listForCustomer(customerId),
  });

  if (isLoading) return <LoadingState label="Loading customer..." />;
  if (isError || !customer) {
    return <ErrorState message={error instanceof Error ? error.message : 'Could not load this customer.'} onRetry={refetch} />;
  }

  const latestKyc = kycRecords?.[0];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.name}>{customer.name}</Text>
        <Text style={styles.caption}>
          {customer.customerCode} · {customer.mobile}
        </Text>
        <View style={styles.kycRow}>
          <Text style={styles.caption}>KYC Status</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{customer.kycStatus.replace('_', ' ')}</Text>
          </View>
        </View>
        {latestKyc ? (
          <Text style={styles.caption}>Latest document: {latestKyc.documentType} ({latestKyc.maskedIdentifier})</Text>
        ) : null}
      </Card>

      {repayment ? (
        <Card style={{ marginTop: spacing.lg }}>
          <Text style={styles.sectionTitle}>Repayment Profile (Advisory)</Text>
          <Text style={styles.bigScore}>{repayment.score ?? '—'} / 100</Text>
          {repayment.reasons.map((reason, idx) => (
            <Text key={idx} style={styles.caption}>
              • {reason}
            </Text>
          ))}
        </Card>
      ) : null}

      <View style={{ marginTop: spacing.lg }}>
        <PrimaryButton label="+ New Loan" onPress={() => navigation.navigate('CreateLoan', { customerId })} />
      </View>

      <Text style={styles.sectionTitle}>Loans</Text>
      {!loans?.length ? (
        <Text style={styles.caption}>No loans yet.</Text>
      ) : (
        loans.map((loan) => (
          <Pressable key={loan.id} onPress={() => navigation.navigate('LoanDetail', { loanId: loan.id })}>
            <Card style={styles.loanCard}>
              <View style={styles.row}>
                <Text style={styles.bodyStrong}>{loan.loanNumber}</Text>
                <Text style={styles.caption}>{loan.status.replace('_', ' ')}</Text>
              </View>
              <Text style={styles.bodyStrong}>{formatMoney(loan.totalPayable)}</Text>
            </Card>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  name: { ...typography.h2, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  kycRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  badge: { backgroundColor: colors.brandSoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { ...typography.captionStrong, color: colors.brand },
  sectionTitle: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.xl, marginBottom: spacing.md },
  bigScore: { ...typography.display, color: colors.textPrimary, marginVertical: spacing.sm },
  bodyStrong: { ...typography.bodyStrong, color: colors.textPrimary },
  loanCard: { marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
});
