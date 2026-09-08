import React, { useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import Decimal from 'decimal.js';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, ErrorState, LoadingState, PrimaryButton } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { canManageAgreements, canManageCustomersAndLoans } from '@/rbac/uiPermissions';
import {
  useApplyPenalty,
  useDecideLoan,
  useLoan,
  useNotifyOverdue,
  useRescheduleInstallment,
  useRevokePenalty,
  useUpdateLoanAgreement,
} from '@/hooks/useApi';
import { formatDate, formatMoney } from '@/utils/format';
import { RootStackParamList } from '@/navigation/types';
import { ApiError, Installment } from '@sptc/shared';

// `status` gets stuck on PARTIALLY_PAID once any money lands on an EMI, even
// if its due date has since passed - so it alone can't tell us whether an
// EMI is overdue. Checking the due date directly catches a partially-paid
// EMI that's also overdue, which `status === 'OVERDUE'` alone would miss.
function isPastDue(installment: Installment): boolean {
  if (installment.status === 'PAID' || installment.status === 'CANCELLED') return false;
  return new Date(installment.dueDate).getTime() < Date.now();
}

export function LoanDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'LoanDetail'>>();
  const { data: loan, isLoading, isError, error, refetch } = useLoan(route.params.loanId);
  const decideLoan = useDecideLoan(route.params.loanId);
  const rescheduleInstallment = useRescheduleInstallment(route.params.loanId);
  const updateAgreement = useUpdateLoanAgreement(route.params.loanId);
  const applyPenalty = useApplyPenalty(route.params.loanId);
  const revokePenalty = useRevokePenalty(route.params.loanId);
  const notifyOverdue = useNotifyOverdue(route.params.loanId);
  const { identity } = useAuth();
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineInput, setShowDeclineInput] = useState(false);
  const [reschedulingInstallment, setReschedulingInstallment] = useState<Installment | null>(null);
  const [penalizingInstallment, setPenalizingInstallment] = useState<Installment | null>(null);
  const [revokingInstallment, setRevokingInstallment] = useState<Installment | null>(null);
  const [editingAgreement, setEditingAgreement] = useState(false);
  const [agreementDraft, setAgreementDraft] = useState('');

  const summary = useMemo(() => {
    if (!loan) return null;
    let paid = new Decimal(0);
    let outstanding = new Decimal(0);
    let overdue = new Decimal(0);
    for (const installment of loan.installments) {
      paid = paid.plus(installment.paidAmount);
      const remaining = new Decimal(installment.totalAmount).minus(installment.paidAmount);
      if (remaining.gt(0)) outstanding = outstanding.plus(remaining);
      if (isPastDue(installment)) overdue = overdue.plus(remaining);
    }
    return { paid: paid.toFixed(2), outstanding: outstanding.toFixed(2), overdue: overdue.toFixed(2) };
  }, [loan]);

  if (isLoading) return <LoadingState label="Loading loan..." />;
  if (isError || !loan) {
    return <ErrorState message={error instanceof Error ? error.message : 'Could not load this loan.'} onRetry={refetch} />;
  }

  const riskProfile = loan.riskScoreSnapshot;
  const canReschedule = identity ? canManageCustomersAndLoans(identity.role) : false;
  const canEditAgreement = identity ? canManageAgreements(identity.role) : false;

  const agreementContent =
    typeof loan.agreement?.termsSnapshot?.agreementTemplateContent === 'string'
      ? (loan.agreement.termsSnapshot.agreementTemplateContent as string)
      : '';

  const onStartEditAgreement = () => {
    setAgreementDraft(agreementContent);
    setEditingAgreement(true);
  };

  const onSaveAgreement = async () => {
    try {
      await updateAgreement.mutateAsync({
        termsSnapshot: { ...(loan.agreement?.termsSnapshot ?? {}), agreementTemplateContent: agreementDraft },
      });
      setEditingAgreement(false);
    } catch (err) {
      Alert.alert('Could not update agreement', err instanceof ApiError ? err.message : 'Please try again.');
    }
  };

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
          <GridItem label="Interest Amount" value={formatMoney(loan.financeCharges)} />
          <GridItem label="Total Payable (incl. interest)" value={formatMoney(loan.totalPayable)} />
          <GridItem label="Installment" value={`${formatMoney(loan.installmentAmount)} / ${loan.installmentFrequency.toLowerCase()}`} />
        </View>
      </Card>

      {summary ? (
        <Card style={{ marginTop: spacing.lg }}>
          <Text style={styles.sectionTitleInline}>Payment Summary</Text>
          <View style={styles.summaryGrid}>
            <GridItem label="Paid" value={formatMoney(summary.paid)} />
            <GridItem label="Outstanding" value={formatMoney(summary.outstanding)} />
            <GridItem label="Overdue" value={formatMoney(summary.overdue)} danger={Number(summary.overdue) > 0} />
          </View>
        </Card>
      ) : null}

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

      {loan.agreement ? (
        <Card style={{ marginTop: spacing.lg }}>
          <View style={styles.row}>
            <Text style={styles.sectionTitleInline}>Agreement (v{loan.agreement.version})</Text>
            {loan.agreement.acceptedByCustomerAt ? (
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>Accepted by customer</Text>
              </View>
            ) : null}
          </View>
          {editingAgreement ? (
            <>
              <TextInput
                value={agreementDraft}
                onChangeText={setAgreementDraft}
                multiline
                numberOfLines={6}
                style={[styles.input, { marginTop: spacing.sm, minHeight: 120, textAlignVertical: 'top' }]}
              />
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton label="Cancel" onPress={() => setEditingAgreement(false)} variant="secondary" />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton label="Save" onPress={onSaveAgreement} loading={updateAgreement.isPending} />
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.caption}>{agreementContent || 'No wording published yet - using default terms.'}</Text>
              {canEditAgreement && !loan.agreement.acceptedByCustomerAt ? (
                <View style={{ marginTop: spacing.md }}>
                  <PrimaryButton label="Edit for this loan" onPress={onStartEditAgreement} variant="secondary" />
                </View>
              ) : null}
            </>
          )}
        </Card>
      ) : null}

      <Text style={styles.sectionTitle}>EMI Schedule</Text>
      {canReschedule && loan.status === 'PENDING_APPROVAL' ? (
        <Text style={styles.hint}>
          Auto-generated from the plan. Tap the pencil on any EMI below to adjust its due date before approving this loan.
        </Text>
      ) : null}
      <Card style={{ padding: 0 }}>
        {[...loan.installments]
          .sort((a, b) => a.sequence - b.sequence)
          .map((installment, index) => {
            const overdue = isPastDue(installment);
            const hasPenalty = Number(installment.penaltyAmount ?? 0) > 0;
            const canAct = canReschedule && installment.status !== 'CANCELLED';
            const showActions = canAct && (installment.status !== 'PAID' || hasPenalty);
            return (
              <View key={installment.id} style={[styles.installmentRow, index > 0 && styles.installmentRowBorder]}>
                <View style={styles.installmentTopRow}>
                  <View>
                    <Text style={styles.bodyStrong}>EMI {installment.sequence}</Text>
                    <Text style={styles.caption}>Due: {formatDate(installment.dueDate)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.bodyStrong}>{formatMoney(installment.totalAmount)}</Text>
                    <Text style={[styles.caption, overdue && styles.penaltyCaption]}>
                      {installment.status}
                      {installment.status !== 'OVERDUE' && overdue ? ' · Overdue' : ''}
                      {Number(installment.paidAmount) > 0 ? ` · Paid ${formatMoney(installment.paidAmount)}` : ''}
                    </Text>
                    {hasPenalty ? <Text style={styles.penaltyCaption}>Penalty {formatMoney(installment.penaltyAmount!)}</Text> : null}
                  </View>
                </View>
                {showActions ? (
                  <View style={styles.installmentActionsRow}>
                    {installment.status !== 'PAID' ? (
                      <Pressable
                        onPress={() => setReschedulingInstallment(installment)}
                        style={styles.actionButton}
                        hitSlop={6}
                      >
                        <Ionicons name="pencil" size={16} color={colors.textSecondary} />
                        <Text style={styles.actionLabel}>Reschedule</Text>
                      </Pressable>
                    ) : null}
                    {overdue ? (
                      <Pressable
                        onPress={() => {
                          notifyOverdue.mutate(installment.id, {
                            onSuccess: () => Alert.alert('Notified', 'A push reminder was sent to the customer.'),
                            onError: (err) =>
                              Alert.alert('Could not notify', err instanceof ApiError ? err.message : 'Please try again.'),
                          });
                        }}
                        style={styles.actionButton}
                        hitSlop={6}
                      >
                        <Ionicons name="notifications-outline" size={16} color={colors.textSecondary} />
                        <Text style={styles.actionLabel}>Notify</Text>
                      </Pressable>
                    ) : null}
                    {overdue ? (
                      <Pressable onPress={() => setPenalizingInstallment(installment)} style={styles.actionButton} hitSlop={6}>
                        <Ionicons name="add-circle-outline" size={16} color={colors.statusOverdue} />
                        <Text style={[styles.actionLabel, styles.penaltyCaption]}>Add Penalty</Text>
                      </Pressable>
                    ) : null}
                    {hasPenalty ? (
                      <Pressable onPress={() => setRevokingInstallment(installment)} style={styles.actionButton} hitSlop={6}>
                        <Ionicons name="close-circle-outline" size={16} color={colors.statusOverdue} />
                        <Text style={[styles.actionLabel, styles.penaltyCaption]}>Remove Penalty</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
      </Card>

      {reschedulingInstallment ? (
        <RescheduleModal
          installment={reschedulingInstallment}
          onClose={() => setReschedulingInstallment(null)}
          onConfirm={async (newDueDate, reason) => {
            try {
              await rescheduleInstallment.mutateAsync({ installmentId: reschedulingInstallment.id, newDueDate, reason });
              setReschedulingInstallment(null);
            } catch (err) {
              Alert.alert('Could not reschedule EMI', err instanceof ApiError ? err.message : 'Please try again.');
            }
          }}
          loading={rescheduleInstallment.isPending}
        />
      ) : null}

      {penalizingInstallment ? (
        <PenaltyModal
          installment={penalizingInstallment}
          onClose={() => setPenalizingInstallment(null)}
          onConfirm={async (amount, reason) => {
            try {
              await applyPenalty.mutateAsync({ installmentId: penalizingInstallment.id, amount, reason });
              setPenalizingInstallment(null);
            } catch (err) {
              Alert.alert('Could not add penalty', err instanceof ApiError ? err.message : 'Please try again.');
            }
          }}
          loading={applyPenalty.isPending}
        />
      ) : null}

      {revokingInstallment ? (
        <RevokePenaltyModal
          installment={revokingInstallment}
          onClose={() => setRevokingInstallment(null)}
          onConfirm={async (reason) => {
            try {
              await revokePenalty.mutateAsync({ installmentId: revokingInstallment.id, reason });
              setRevokingInstallment(null);
            } catch (err) {
              Alert.alert('Could not remove penalty', err instanceof ApiError ? err.message : 'Please try again.');
            }
          }}
          loading={revokePenalty.isPending}
        />
      ) : null}
    </ScrollView>
  );
}

function PenaltyModal({
  installment,
  onClose,
  onConfirm,
  loading,
}: {
  installment: Installment;
  onClose: () => void;
  onConfirm: (amount: number, reason: string) => void;
  loading: boolean;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const parsedAmount = Number(amount);

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Add Penalty · EMI {installment.sequence}</Text>
          <Text style={styles.caption}>
            Currently overdue: {formatMoney(new Decimal(installment.totalAmount).minus(installment.paidAmount).toFixed(2))}
          </Text>

          <Text style={[styles.label, { marginTop: spacing.md }]}>Penalty Amount</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            style={styles.input}
            placeholder="e.g. 100"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={[styles.label, { marginTop: spacing.md }]}>Reason</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            style={styles.input}
            placeholder="e.g. 10 days late payment"
            placeholderTextColor={colors.textSecondary}
          />

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="Add Penalty"
                onPress={() => onConfirm(parsedAmount, reason.trim())}
                loading={loading}
                disabled={!(parsedAmount > 0) || !reason.trim()}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function RevokePenaltyModal({
  installment,
  onClose,
  onConfirm,
  loading,
}: {
  installment: Installment;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Remove Penalty · EMI {installment.sequence}</Text>
          <Text style={styles.caption}>
            Current penalty on this EMI: {formatMoney(installment.penaltyAmount ?? 0)}. This removes the charge
            entirely. If the customer already paid some or all of it, that money is credited toward this EMI (or the
            next one) instead of being refunded.
          </Text>

          <Text style={[styles.label, { marginTop: spacing.md }]}>Reason (required)</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            style={styles.input}
            placeholder="e.g. customer had a valid reason for the delay"
            placeholderTextColor={colors.textSecondary}
          />

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="Remove Penalty"
                onPress={() => onConfirm(reason.trim())}
                variant="danger"
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

function RescheduleModal({
  installment,
  onClose,
  onConfirm,
  loading,
}: {
  installment: Installment;
  onClose: () => void;
  onConfirm: (newDueDate: string, reason: string) => void;
  loading: boolean;
}) {
  const [date, setDate] = useState(new Date(installment.dueDate));
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');
  const [reason, setReason] = useState('');

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Reschedule EMI {installment.sequence}</Text>
          <Text style={styles.caption}>Current due date: {formatDate(installment.dueDate)}</Text>

          {Platform.OS === 'android' && !showPicker ? (
            <Pressable style={styles.dateButton} onPress={() => setShowPicker(true)}>
              <Text style={styles.bodyStrong}>{date.toDateString()}</Text>
            </Pressable>
          ) : null}

          {showPicker ? (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_event, selected) => {
                if (Platform.OS === 'android') setShowPicker(false);
                if (selected) setDate(selected);
              }}
            />
          ) : null}

          <Text style={[styles.label, { marginTop: spacing.md }]}>Reason (required)</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. customer requested extension"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />

          <View style={{ height: spacing.md }} />
          <PrimaryButton
            label="Confirm New Date"
            onPress={() => onConfirm(date.toISOString(), reason.trim())}
            disabled={!reason.trim()}
            loading={loading}
          />
          <View style={{ height: spacing.sm }} />
          <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
        </View>
      </View>
    </Modal>
  );
}

function GridItem({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={styles.gridItem}>
      <Text style={styles.caption}>{label}</Text>
      <Text style={[styles.bodyStrong, danger && { color: colors.statusOverdue }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loanNumber: { ...typography.h2, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  penaltyCaption: { ...typography.caption, color: colors.statusOverdue, marginTop: 2 },
  bodyStrong: { ...typography.bodyStrong, color: colors.textPrimary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.lg, gap: spacing.lg },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  gridItem: { width: '42%' },
  statusPill: { backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusText: { ...typography.captionStrong, color: colors.textPrimary },
  sectionTitleInline: { ...typography.bodyStrong, color: colors.textPrimary, marginBottom: spacing.sm },
  bigScore: { ...typography.display, color: colors.textPrimary, marginVertical: spacing.sm },
  decisionBlock: { marginTop: spacing.lg },
  sectionTitle: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.xl, marginBottom: spacing.md },
  hint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  installmentRow: { padding: spacing.lg },
  installmentRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  installmentTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  installmentActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  actionLabel: { ...typography.caption, color: colors.textSecondary },
  label: { ...typography.captionStrong, color: colors.textSecondary, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  modalTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  dateButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.md,
    alignItems: 'center',
  },
});
