import React, { useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, ErrorState, LoadingState, PrimaryButton } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { canManageCustomersAndLoans } from '@/rbac/uiPermissions';
import {
  useCustomer,
  useCustomerKyc,
  useCustomerLoans,
  useCustomerSummary,
  useDeleteCustomer,
  useRepaymentProfile,
  useSubmitKyc,
  useUploadFile,
  useVerifyKyc,
} from '@/hooks/useApi';
import { formatDate, formatMoney } from '@/utils/format';
import { RootStackParamList } from '@/navigation/types';
import { ApiError, KycDocumentType } from '@sptc/shared';

const KYC_DOC_TYPES = [
  KycDocumentType.AADHAAR,
  KycDocumentType.PAN,
  KycDocumentType.VOTER_ID,
  KycDocumentType.DRIVING_LICENSE,
  KycDocumentType.PASSPORT,
  KycDocumentType.OTHER,
];

const KYC_DOC_LABEL: Record<string, string> = {
  AADHAAR: 'Aadhaar',
  PAN: 'PAN',
  VOTER_ID: 'Voter ID',
  DRIVING_LICENSE: 'Driving License',
  PASSPORT: 'Passport',
  UTILITY_BILL: 'Utility Bill',
  OTHER: 'Other',
};

export function CustomerProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'CustomerProfile'>>();
  const { customerId } = route.params;
  const { identity } = useAuth();

  const { data: customer, isLoading, isError, error, refetch } = useCustomer(customerId);
  const { data: loans } = useCustomerLoans(customerId);
  const { data: repayment } = useRepaymentProfile(customerId);
  const { data: summary } = useCustomerSummary(customerId);
  const { data: kycRecords } = useCustomerKyc(customerId);

  const [addingKyc, setAddingKyc] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const verifyKyc = useVerifyKyc(customerId);

  const canManage = identity ? canManageCustomersAndLoans(identity.role) : false;

  if (isLoading) return <LoadingState label="Loading customer..." />;
  if (isError || !customer) {
    return <ErrorState message={error instanceof Error ? error.message : 'Could not load this customer.'} onRetry={refetch} />;
  }

  const overdue = summary ? Number(summary.totalOverdue) : 0;

  const onVerify = (recordId: string, decision: 'VERIFIED' | 'REJECTED') => {
    if (decision === 'REJECTED') {
      Alert.prompt?.('Reject document', 'Reason for rejection:', (reason) => {
        verifyKyc.mutate({ recordId, decision, rejectionReason: reason || undefined });
      }) ?? verifyKyc.mutate({ recordId, decision });
    } else {
      verifyKyc.mutate({ recordId, decision });
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <View style={styles.headerRow}>
          <View style={styles.photoWrap}>
            {customer.photoUrl ? (
              <Image source={{ uri: customer.photoUrl }} style={styles.photo} />
            ) : (
              <Text style={styles.photoInitials}>{customer.name.slice(0, 1).toUpperCase()}</Text>
            )}
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.name}>{customer.name}</Text>
            <Text style={styles.caption}>
              {customer.customerCode} · {customer.mobile}
            </Text>
          </View>
          <Pressable onPress={() => navigation.navigate('EditCustomer', { customerId })} style={styles.editButton}>
            <Ionicons name="pencil" size={16} color={colors.textPrimary} />
          </Pressable>
        </View>

        {customer.addressLine1 ? (
          <Text style={styles.caption}>
            {[customer.addressLine1, customer.addressLine2, customer.city, customer.state, customer.pincode].filter(Boolean).join(', ')}
          </Text>
        ) : null}

        <View style={styles.kycRow}>
          <Text style={styles.caption}>KYC Status</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{customer.kycStatus.replace('_', ' ')}</Text>
          </View>
        </View>

        {customer.referenceName ? (
          <View style={styles.referenceRow}>
            {customer.referencePhotoUrl ? <Image source={{ uri: customer.referencePhotoUrl }} style={styles.refPhoto} /> : null}
            <View>
              <Text style={styles.caption}>Reference Contact</Text>
              <Text style={styles.bodyStrong}>
                {customer.referenceName} · {customer.referenceMobile}
              </Text>
            </View>
          </View>
        ) : null}
      </Card>

      <Text style={styles.sectionTitle}>KYC Documents</Text>
      {!kycRecords?.length ? (
        <Text style={styles.caption}>No documents on file yet.</Text>
      ) : (
        kycRecords.map((record) => (
          <Card key={record.id} style={{ marginBottom: spacing.md }}>
            <View style={styles.row}>
              <Text style={styles.bodyStrong}>{KYC_DOC_LABEL[record.documentType] ?? record.documentType}</Text>
              <View style={[styles.badge, record.status === 'VERIFIED' && { backgroundColor: colors.statusPaidSoft }]}>
                <Text style={[styles.badgeText, record.status === 'VERIFIED' && { color: colors.statusPaid }]}>{record.status}</Text>
              </View>
            </View>
            <Text style={styles.caption}>{record.maskedIdentifier}</Text>
            {record.documentRef && /\.(png|jpe?g|webp|heic)$/i.test(record.documentRef) ? (
              <Image source={{ uri: record.documentRef }} style={styles.kycDocImage} resizeMode="cover" />
            ) : null}
            {record.rejectionReason ? <Text style={styles.rejectionCaption}>{record.rejectionReason}</Text> : null}
            {canManage && record.status === 'SUBMITTED' ? (
              <View style={styles.verifyRow}>
                <PrimaryButton label="Verify" onPress={() => onVerify(record.id, 'VERIFIED')} size="md" />
                <View style={{ width: spacing.sm }} />
                <PrimaryButton label="Reject" onPress={() => onVerify(record.id, 'REJECTED')} variant="danger" size="md" />
              </View>
            ) : null}
          </Card>
        ))
      )}
      {canManage ? (
        addingKyc ? (
          <AddKycDocumentForm customerId={customerId} onDone={() => setAddingKyc(false)} />
        ) : (
          <Pressable onPress={() => setAddingKyc(true)} style={styles.addDocButton}>
            <Ionicons name="add-circle-outline" size={18} color={colors.brand} />
            <Text style={styles.addDocLabel}>Add KYC Document (Aadhaar, PAN, etc.)</Text>
          </Pressable>
        )
      ) : null}

      {summary ? (
        <Card style={{ marginTop: spacing.lg }}>
          <Text style={styles.sectionTitleInline}>Payment Summary</Text>
          <View style={styles.summaryGrid}>
            <SummaryItem label="Total Paid" value={formatMoney(summary.totalPaid)} />
            <SummaryItem label="Outstanding" value={formatMoney(summary.totalOutstanding)} />
            <SummaryItem label="Overdue" value={formatMoney(summary.totalOverdue)} danger={overdue > 0} />
            {summary.nextDue ? (
              <SummaryItem label="Next EMI" value={`${formatMoney(summary.nextDue.amount)} · ${formatDate(summary.nextDue.dueDate)}`} />
            ) : null}
          </View>
        </Card>
      ) : null}

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

      <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
        <PrimaryButton label="+ New Loan" onPress={() => navigation.navigate('CreateLoan', { customerId })} />
        <PrimaryButton
          label="View Receipts"
          onPress={() => navigation.navigate('CustomerReceipts', { customerId })}
          variant="secondary"
          icon="receipt-outline"
        />
        <PrimaryButton
          label="Transaction Ledger"
          onPress={() => navigation.navigate('CustomerLedger', { customerId })}
          variant="secondary"
          icon="time-outline"
        />
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

      {canManage ? (
        <View style={{ marginTop: spacing.xxl }}>
          <PrimaryButton label="Delete Customer" onPress={() => setDeleteModalOpen(true)} variant="danger" />
        </View>
      ) : null}

      {deleteModalOpen ? (
        <DeleteCustomerModal customerId={customerId} onClose={() => setDeleteModalOpen(false)} onDeleted={() => navigation.goBack()} />
      ) : null}
    </ScrollView>
  );
}

function AddKycDocumentForm({ customerId, onDone }: { customerId: string; onDone: () => void }) {
  const [type, setType] = useState<KycDocumentType>(KycDocumentType.PAN);
  const [maskedIdentifier, setMaskedIdentifier] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const uploadFile = useUploadFile();
  const submitKyc = useSubmitKyc(customerId);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to attach an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
  };

  const onSubmit = async () => {
    if (!photo || !maskedIdentifier.trim()) return;
    try {
      const documentRef = await uploadFile.mutateAsync({ uri: photo.uri, contentType: photo.mimeType ?? 'image/jpeg', purpose: 'kyc-document' });
      await submitKyc.mutateAsync({ documentType: type, maskedIdentifier: maskedIdentifier.trim(), documentRef });
      onDone();
    } catch (err) {
      Alert.alert('Could not add document', err instanceof ApiError ? err.message : 'Please try again.');
    }
  };

  return (
    <Card style={{ marginBottom: spacing.lg }}>
      <View style={styles.chipRow}>
        {KYC_DOC_TYPES.map((t) => (
          <Pressable key={t} onPress={() => setType(t)} style={[styles.chip, type === t && styles.chipActive]}>
            <Text style={[styles.chipText, type === t && styles.chipTextActive]}>{KYC_DOC_LABEL[t]}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={maskedIdentifier}
        onChangeText={setMaskedIdentifier}
        placeholder="Masked identifier, e.g. XXXX XXXX 1234"
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
      />
      <Pressable onPress={pickImage} style={styles.photoRow}>
        <View style={styles.photoThumb}>
          {photo ? <Image source={{ uri: photo.uri }} style={styles.photoImg} /> : <Ionicons name="camera-outline" size={20} color={colors.textSecondary} />}
        </View>
        <Text style={styles.body}>{photo ? 'Change photo' : 'Document Photo'}</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <PrimaryButton
            label="Save"
            onPress={onSubmit}
            loading={uploadFile.isPending || submitKyc.isPending}
            disabled={!photo || !maskedIdentifier.trim()}
          />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton label="Cancel" onPress={onDone} variant="secondary" />
        </View>
      </View>
    </Card>
  );
}

function DeleteCustomerModal({ customerId, onClose, onDeleted }: { customerId: string; onClose: () => void; onDeleted: () => void }) {
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const deleteCustomer = useDeleteCustomer(customerId);

  const onConfirm = async () => {
    try {
      const res = await deleteCustomer.mutateAsync({ currentPassword: password, reason: reason.trim() || undefined });
      Alert.alert(res.mode === 'deleted' ? 'Customer deleted' : 'Customer deactivated', undefined, [{ text: 'OK', onPress: onDeleted }]);
    } catch (err) {
      Alert.alert('Could not delete customer', err instanceof ApiError ? err.message : 'Please try again.');
    }
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Delete Customer</Text>
          <Text style={styles.caption}>
            This cannot be undone for a customer with no loan history. A customer with any open loan (active, pending, overdue) cannot be
            deleted. Enter your password to confirm.
          </Text>
          <Text style={[styles.label, { marginTop: spacing.md }]}>Your Password</Text>
          <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
          <Text style={styles.label}>Reason (optional)</Text>
          <TextInput value={reason} onChangeText={setReason} style={styles.input} />
          <View style={{ height: spacing.md }} />
          <PrimaryButton label="Confirm Delete" onPress={onConfirm} variant="danger" loading={deleteCustomer.isPending} disabled={!password} />
          <View style={{ height: spacing.sm }} />
          <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
        </View>
      </View>
    </Modal>
  );
}

function SummaryItem({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.caption}>{label}</Text>
      <Text style={[styles.bodyStrong, danger && { color: colors.statusOverdue }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  photoWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: { width: 56, height: 56 },
  photoInitials: { ...typography.h1, color: colors.textSecondary },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...typography.h2, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  kycDocImage: { width: '100%', height: 160, borderRadius: radius.md, marginTop: spacing.sm, backgroundColor: colors.surfaceMuted },
  rejectionCaption: { ...typography.caption, color: colors.statusOverdue, marginTop: spacing.xs },
  body: { ...typography.body, color: colors.textPrimary },
  kycRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  badge: { backgroundColor: colors.brandSoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { ...typography.captionStrong, color: colors.brand },
  referenceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  refPhoto: { width: 40, height: 40, borderRadius: 20 },
  sectionTitle: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitleInline: { ...typography.bodyStrong, color: colors.textPrimary, marginBottom: spacing.sm },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  summaryItem: { width: '42%' },
  bigScore: { ...typography.display, color: colors.textPrimary, marginVertical: spacing.sm },
  bodyStrong: { ...typography.bodyStrong, color: colors.textPrimary },
  loanCard: { marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  verifyRow: { flexDirection: 'row', marginTop: spacing.md },
  addDocButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  addDocLabel: { ...typography.bodyStrong, color: colors.brand },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
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
    marginBottom: spacing.md,
  },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  photoThumb: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImg: { width: 48, height: 48 },
  label: { ...typography.captionStrong, color: colors.textSecondary, marginBottom: spacing.sm },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  modalTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
});
