import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, PrimaryButton } from '@/components/ui';
import { useLoanProducts } from '@/hooks/useApi';
import { apiClient } from '@/api/apiClient';
import { ApiError } from '@sptc/shared';
import type { LoanProduct, LoanProductVersion } from '@sptc/shared';

const INTEREST_TYPES = ['ZERO_COST', 'FLAT', 'REDUCING'] as const;
const FREQUENCIES = ['MONTHLY', 'BIWEEKLY', 'WEEKLY'] as const;
const INTEREST_BASES = ['FINANCED_PRINCIPAL', 'TOTAL_CASH_PRICE'] as const;
const INTEREST_BASIS_LABEL: Record<(typeof INTEREST_BASES)[number], string> = {
  FINANCED_PRINCIPAL: 'Financed amount (cash price minus down payment)',
  TOTAL_CASH_PRICE: 'Total product value (including down payment)',
};

export function LoanProductsAdminScreen() {
  const { data: loanProducts, refetch } = useLoanProducts();
  const [name, setName] = useState('');
  const [interestType, setInterestType] = useState<(typeof INTEREST_TYPES)[number]>('ZERO_COST');
  const [frequency, setFrequency] = useState<(typeof FREQUENCIES)[number]>('MONTHLY');
  const [interestRate, setInterestRate] = useState('0');
  const [interestBasis, setInterestBasis] = useState<(typeof INTEREST_BASES)[number]>('FINANCED_PRINCIPAL');
  const [minInstallments, setMinInstallments] = useState('1');
  const [maxInstallments, setMaxInstallments] = useState('12');

  const createPlan = useMutation({
    mutationFn: async () => {
      const product = await apiClient.loanProducts.create({ name: name.trim() });
      await apiClient.loanProducts.createVersion(product.id, {
        interestType,
        interestRateAnnual: interestType === 'ZERO_COST' ? undefined : Number(interestRate),
        interestBasis,
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
        <LoanProductCard key={product.id} product={product} onChanged={refetch} />
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
            <Text style={styles.label}>
              {interestType === 'FLAT'
                ? 'Flat Interest Rate (%) - charged once on the total loan amount'
                : 'Annual Interest Rate (%) - reducing balance'}
            </Text>
            <TextInput value={interestRate} onChangeText={setInterestRate} keyboardType="decimal-pad" style={styles.input} />

            <Text style={styles.label}>Apply interest to</Text>
            <View style={styles.chipRow}>
              {INTEREST_BASES.map((b) => (
                <Pressable
                  key={b}
                  onPress={() => setInterestBasis(b)}
                  style={[styles.chip, interestBasis === b && styles.chipActive]}
                >
                  <Text style={[styles.chipText, interestBasis === b && styles.chipTextActive]}>
                    {INTEREST_BASIS_LABEL[b]}
                  </Text>
                </Pressable>
              ))}
            </View>
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

function LoanProductCard({ product, onChanged }: { product: LoanProduct; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(product.name);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      onChanged();
    } catch (err) {
      Alert.alert('Action failed', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const saveName = () => {
    if (!draftName.trim() || draftName.trim() === product.name) {
      setEditing(false);
      return;
    }
    run(() => apiClient.loanProducts.update(product.id, { name: draftName.trim() })).then(() => setEditing(false));
  };

  const toggleActive = () => run(() => apiClient.loanProducts.update(product.id, { isActive: !product.isActive }));

  const confirmDelete = () => {
    Alert.alert(
      'Delete plan?',
      `"${product.name}" will stop being offered for new loans. Loans already issued on it are unaffected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => run(() => apiClient.loanProducts.remove(product.id)) },
      ],
    );
  };

  const toggleVersionActive = (version: LoanProductVersion) =>
    run(() => apiClient.loanProducts.updateVersion(product.id, version.id, { isActive: !version.isActive }));

  return (
    <Card style={{ ...styles.card, ...(product.isActive ? null : styles.cardInactive) }}>
      <View style={styles.cardHeaderRow}>
        {editing ? (
          <TextInput
            value={draftName}
            onChangeText={setDraftName}
            style={[styles.input, { flex: 1, marginRight: spacing.sm }]}
            autoFocus
            onSubmitEditing={saveName}
          />
        ) : (
          <Text style={styles.name}>
            {product.name}
            {!product.isActive ? ' (inactive)' : ''}
          </Text>
        )}

        <View style={styles.cardActions}>
          {editing ? (
            <Pressable onPress={saveName} style={styles.iconButton} disabled={busy}>
              <Ionicons name="checkmark" size={18} color={colors.textPrimary} />
            </Pressable>
          ) : (
            <Pressable onPress={() => setEditing(true)} style={styles.iconButton} disabled={busy}>
              <Ionicons name="pencil" size={16} color={colors.textPrimary} />
            </Pressable>
          )}
          <Pressable onPress={toggleActive} style={styles.iconButton} disabled={busy}>
            <Ionicons name={product.isActive ? 'pause' : 'play'} size={16} color={colors.textPrimary} />
          </Pressable>
          <Pressable onPress={confirmDelete} style={styles.iconButton} disabled={busy}>
            <Ionicons name="trash" size={16} color={colors.statusOverdue} />
          </Pressable>
        </View>
      </View>

      {(product.versions ?? []).map((v) => (
        <View key={v.id} style={styles.versionRow}>
          <Text style={[styles.caption, !v.isActive && styles.captionInactive]}>
            v{v.versionNumber} · {v.interestType}
            {v.interestType !== 'ZERO_COST' ? ` on ${v.interestBasis === 'TOTAL_CASH_PRICE' ? 'total value' : 'financed amount'}` : ''} ·{' '}
            {v.installmentFrequency} · {v.minInstallments}-{v.maxInstallments} installments
            {!v.isActive ? ' · inactive' : ''}
          </Text>
          <Pressable onPress={() => toggleVersionActive(v)} disabled={busy}>
            <Text style={styles.versionToggle}>{v.isActive ? 'Deactivate' : 'Activate'}</Text>
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.lg },
  card: { marginBottom: spacing.md },
  cardInactive: { opacity: 0.6 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardActions: { flexDirection: 'row', gap: spacing.xs },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  name: { ...typography.bodyStrong, color: colors.textPrimary, flex: 1 },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2, flex: 1 },
  captionInactive: { textDecorationLine: 'line-through' },
  versionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  versionToggle: { ...typography.caption, color: colors.accent, fontWeight: '600' as const },
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
