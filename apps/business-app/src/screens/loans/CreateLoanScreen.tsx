import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, PrimaryButton } from '@/components/ui';
import { useCreateLoan, useIdentifierSearch, useLoanPreview, useLoanProducts } from '@/hooks/useApi';
import { formatDate, formatMoney } from '@/utils/format';
import { RootStackParamList } from '@/navigation/types';
import { ApiError } from '@sptc/shared';

/**
 * Loan creation wizard, condensed to one screen (blueprint #25 steps 1-10):
 * select plan, capture price/IMEI/down payment/installments, then submit.
 * The loan is created in PENDING_APPROVAL - nothing is financially active
 * and no device is marked FINANCED until a human explicitly approves it on
 * the following screen, where the full computed schedule is shown before
 * that final decision (blueprint #25 step 11, #27).
 */
export function CreateLoanScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'CreateLoan'>>();
  const { customerId } = route.params;

  const { data: loanProducts } = useLoanProducts();
  const createLoan = useCreateLoan();

  const [versionId, setVersionId] = useState<string | undefined>();
  const [imeiQuery, setImeiQuery] = useState('');
  const [productIdentifierId, setProductIdentifierId] = useState<string | undefined>();
  const identifiers = useIdentifierSearch(imeiQuery);

  const [cashPrice, setCashPrice] = useState('');
  const [downPayment, setDownPayment] = useState('0');
  const [installments, setInstallments] = useState('6');

  const selectedVersion = loanProducts?.flatMap((p) => p.versions ?? []).find((v) => v.id === versionId);

  const preview = useLoanPreview({
    loanProductVersionId: versionId,
    cashPrice: Number(cashPrice) || 0,
    downPaymentAmount: Number(downPayment) || 0,
    numberOfInstallments: Number(installments) || 0,
  });

  const onSubmit = async () => {
    if (!versionId) {
      Alert.alert('Select a finance plan first.');
      return;
    }
    try {
      const loan = await createLoan.mutateAsync({
        customerId,
        loanProductVersionId: versionId,
        productIdentifierId,
        cashPrice: Number(cashPrice),
        downPaymentAmount: Number(downPayment),
        numberOfInstallments: Number(installments),
      });
      navigation.replace('LoanDetail', { loanId: loan.id });
    } catch (err) {
      Alert.alert('Could not create loan', err instanceof ApiError ? err.message : 'Please check the details and try again.');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.label}>Finance Plan</Text>
        <View style={styles.chipRow}>
          {loanProducts?.flatMap((product) =>
            (product.versions ?? []).map((version) => (
              <Pressable
                key={version.id}
                onPress={() => setVersionId(version.id)}
                style={[styles.chip, versionId === version.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, versionId === version.id && styles.chipTextActive]}>
                  {product.name} · {version.installmentFrequency}
                </Text>
              </Pressable>
            )),
          )}
        </View>
        {selectedVersion ? (
          <Text style={styles.caption}>
            {selectedVersion.minInstallments}-{selectedVersion.maxInstallments} installments · {selectedVersion.interestType}
          </Text>
        ) : null}
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={styles.label}>Product Device (IMEI/Serial) - optional</Text>
        <TextInput
          value={imeiQuery}
          onChangeText={setImeiQuery}
          placeholder="Search IMEI or serial..."
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        {identifiers.data?.map((identifier) => (
          <Pressable
            key={identifier.id}
            onPress={() => setProductIdentifierId(identifier.id)}
            style={[styles.identifierRow, productIdentifierId === identifier.id && styles.identifierRowSelected]}
          >
            <Text style={styles.body}>
              {identifier.product?.brand} {identifier.product?.model} · {identifier.imei1 ?? identifier.serialNumber}
            </Text>
            <Text style={styles.caption}>{identifier.status}</Text>
          </Pressable>
        ))}
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <NumberField label="Cash Price" value={cashPrice} onChangeText={setCashPrice} />
        <NumberField label="Down Payment" value={downPayment} onChangeText={setDownPayment} />
        <NumberField label="Number of Installments" value={installments} onChangeText={setInstallments} />
      </Card>

      {preview.data ? (
        <Card style={{ marginTop: spacing.lg, backgroundColor: colors.brandSoft }}>
          <Text style={styles.previewTitle}>Repayment Preview</Text>
          <View style={styles.previewGrid}>
            <PreviewItem label="Principal" value={formatMoney(preview.data.financedPrincipal)} />
            <PreviewItem label="Interest Amount" value={formatMoney(preview.data.financeCharges)} />
            <PreviewItem label="Fees" value={formatMoney(preview.data.feesTotal)} />
            <PreviewItem label="Total Payable" value={formatMoney(preview.data.totalPayable)} emphasize />
            <PreviewItem
              label="Per EMI"
              value={`${formatMoney(preview.data.installmentAmount)} · ${preview.data.numberOfInstallments}x`}
            />
            <PreviewItem label="Maturity" value={formatDate(preview.data.maturityDate)} />
          </View>
          <Text style={styles.previewNote}>
            Interest is already included in Total Payable and every EMI above. You can adjust individual EMI due dates on the
            next screen before approving this loan.
          </Text>
        </Card>
      ) : versionId && cashPrice ? (
        <Text style={[styles.caption, { marginTop: spacing.lg }]}>Calculating repayment preview...</Text>
      ) : null}

      <View style={{ marginTop: spacing.xl }}>
        <PrimaryButton
          label="Continue to Repayment Summary"
          onPress={onSubmit}
          loading={createLoan.isPending}
          disabled={!versionId || !cashPrice || !installments}
        />
      </View>
    </ScrollView>
  );
}

function PreviewItem({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <View style={styles.previewItem}>
      <Text style={styles.caption}>{label}</Text>
      <Text style={emphasize ? styles.previewValueEmphasis : styles.previewValue}>{value}</Text>
    </View>
  );
}

function NumberField({ label, value, onChangeText }: { label: string; value: string; onChangeText: (v: string) => void }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} keyboardType="decimal-pad" style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  label: { ...typography.captionStrong, color: colors.textSecondary, marginBottom: spacing.sm },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  body: { ...typography.body, color: colors.textPrimary },
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
  identifierRow: { padding: spacing.sm, borderRadius: radius.sm, marginTop: spacing.sm },
  identifierRowSelected: { backgroundColor: colors.brandSoft },
  previewTitle: { ...typography.bodyStrong, color: colors.textPrimary, marginBottom: spacing.sm },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  previewItem: { width: '42%' },
  previewValue: { ...typography.bodyStrong, color: colors.textPrimary },
  previewValueEmphasis: { ...typography.h2, color: colors.brand },
  previewNote: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.md },
});
