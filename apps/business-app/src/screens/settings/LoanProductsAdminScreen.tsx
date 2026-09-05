import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, PrimaryButton } from '@/components/ui';
import { useLoanProducts } from '@/hooks/useApi';
import { apiClient } from '@/api/apiClient';
import { ApiError } from '@sptc/shared';

const INTEREST_TYPES = ['ZERO_COST', 'FLAT', 'REDUCING'] as const;
const FREQUENCIES = ['MONTHLY', 'BIWEEKLY', 'WEEKLY'] as const;

export function LoanProductsAdminScreen() {
  const { data: loanProducts, refetch } = useLoanProducts();
  const [name, setName] = useState('');
  const [interestType, setInterestType] = useState<(typeof INTEREST_TYPES)[number]>('ZERO_COST');
  const [frequency, setFrequency] = useState<(typeof FREQUENCIES)[number]>('MONTHLY');
  const [interestRate, setInterestRate] = useState('0');
  const [minInstallments, setMinInstallments] = useState('1');
  const [maxInstallments, setMaxInstallments] = useState('12');

  const createPlan = useMutation({
    mutationFn: async () => {
      const product = await apiClient.loanProducts.create({ name: name.trim() });
      await apiClient.loanProducts.createVersion(product.id, {
        interestType,
        interestRateAnnual: interestType === 'ZERO_COST' ? undefined : Number(interestRate),
        minInstallments: Number(minInstallments),
        maxInstallments: Number(maxInstallments),
        installmentFrequency: frequency,
        feeRules: [],
        gracePeriodDays: 3,
        latePaymentRules: { penaltyType: 'FLAT', amount: 100 },
        partialPaymentRules: { allowed: true },
        prepaymentRules: { allowed: true },
        earlyClosureRules: { allowed: true },
        settlementRules: {},
        waiverRules: {},
        reversalRules: {},
      });
    },
    onSuccess: () => {
      setName('');
      refetch();
    },
  });

  const onCreate = async () => {
    try {
      await createPlan.mutateAsync();
    } catch (err) {
      Alert.alert('Could not create plan', err instanceof ApiError ? err.message : 'Please try again.');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Loan Products</Text>

      {loanProducts?.map((product) => (
        <Card key={product.id} style={styles.card}>
          <Text style={styles.name}>{product.name}</Text>
          {(product.versions ?? []).map((v) => (
            <Text key={v.id} style={styles.caption}>
              v{v.versionNumber} · {v.interestType} · {v.installmentFrequency} · {v.minInstallments}-{v.maxInstallments} installments
            </Text>
          ))}
        </Card>
      ))}

      <Text style={styles.sectionTitle}>New Plan</Text>
      <Card>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Plan name (e.g. 6-Month EMI)"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        <Text style={styles.label}>Interest Type</Text>
        <View style={styles.chipRow}>
          {INTEREST_TYPES.map((t) => (
            <Pressable key={t} onPress={() => setInterestType(t)} style={[styles.chip, interestType === t && styles.chipActive]}>
              <Text style={[styles.chipText, interestType === t && styles.chipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        {interestType !== 'ZERO_COST' ? (
          <>
            <Text style={styles.label}>Annual Interest Rate (%)</Text>
            <TextInput value={interestRate} onChangeText={setInterestRate} keyboardType="decimal-pad" style={styles.input} />
          </>
        ) : null}

        <Text style={styles.label}>Installment Frequency</Text>
        <View style={styles.chipRow}>
          {FREQUENCIES.map((f) => (
            <Pressable key={f} onPress={() => setFrequency(f)} style={[styles.chip, frequency === f && styles.chipActive]}>
              <Text style={[styles.chipText, frequency === f && styles.chipTextActive]}>{f}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <Text style={styles.label}>Min Installments</Text>
            <TextInput value={minInstallments} onChangeText={setMinInstallments} keyboardType="number-pad" style={styles.input} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Max Installments</Text>
            <TextInput value={maxInstallments} onChangeText={setMaxInstallments} keyboardType="number-pad" style={styles.input} />
          </View>
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <PrimaryButton label="Create Plan" onPress={onCreate} loading={createPlan.isPending} disabled={!name.trim()} />
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.lg },
  card: { marginBottom: spacing.md },
  name: { ...typography.bodyStrong, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  sectionTitle: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.xl, marginBottom: spacing.md },
  label: { ...typography.captionStrong, color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { ...typography.caption, color: colors.textPrimary },
  chipTextActive: { color: colors.textInverse },
  row: { flexDirection: 'row', marginTop: spacing.md },
});
