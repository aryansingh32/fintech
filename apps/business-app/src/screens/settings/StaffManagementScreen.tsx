import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, PrimaryButton } from '@/components/ui';
import { useApproveStaffAccount, useCreateStaffAccount, useRejectStaffAccount, useStaffAccounts } from '@/hooks/useApi';
import { formatDate } from '@/utils/format';
import { roleLabel } from '@/rbac/uiPermissions';
import { ApiError, StaffAccount, StaffRole } from '@sptc/shared';

const CREATABLE_ROLES: StaffRole[] = [
  StaffRole.ADMIN,
  StaffRole.MANAGER,
  StaffRole.SHOPKEEPER,
  StaffRole.COLLECTION_AGENT,
  StaffRole.SUPPORT_AGENT,
];

/**
 * SUPER_ADMIN-only screen: create new staff/admin accounts and approve or
 * reject pending ones. A newly created account cannot log in to the app
 * until approved here (see StaffAuthService.login on the backend).
 */
export function StaffManagementScreen() {
  const { data: staff, isLoading, refetch } = useStaffAccounts();
  const createStaff = useCreateStaffAccount();
  const approve = useApproveStaffAccount();
  const reject = useRejectStaffAccount();

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole>(StaffRole.SHOPKEEPER);

  const pending = staff?.filter((s) => !s.isApproved) ?? [];
  const approved = staff?.filter((s) => s.isApproved) ?? [];

  const onCreate = async () => {
    try {
      await createStaff.mutateAsync({
        name: name.trim(),
        mobile: mobile.trim(),
        email: email.trim() || undefined,
        password,
        role,
      });
      setName('');
      setMobile('');
      setEmail('');
      setPassword('');
      Alert.alert('Account created', 'The account is pending your approval below before it can log in.');
      refetch();
    } catch (err) {
      Alert.alert('Could not create account', err instanceof ApiError ? err.message : 'Please try again.');
    }
  };

  const onApprove = (id: string) => {
    approve.mutate(id, {
      onError: (err) => Alert.alert('Could not approve', err instanceof ApiError ? err.message : 'Please try again.'),
    });
  };

  const onReject = (id: string) => {
    Alert.alert('Reject account?', 'This account will be blocked from logging in.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: () =>
          reject.mutate(
            { id },
            {
              onError: (err) => Alert.alert('Could not reject', err instanceof ApiError ? err.message : 'Please try again.'),
            },
          ),
      },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Staff & Approvals</Text>
      <Text style={styles.hint}>
        New staff accounts are blocked from logging in until you approve them here.
      </Text>

      {pending.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Pending Approval ({pending.length})</Text>
          {pending.map((s) => (
            <StaffRow key={s.id} staff={s} onApprove={() => onApprove(s.id)} onReject={() => onReject(s.id)} pending />
          ))}
        </>
      ) : null}

      <Text style={styles.sectionTitle}>All Staff</Text>
      {isLoading ? <Text style={styles.caption}>Loading...</Text> : null}
      {approved.map((s) => (
        <StaffRow key={s.id} staff={s} />
      ))}

      <Text style={styles.sectionTitle}>Create Staff Account</Text>
      <Card>
        <TextInput value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.textSecondary} style={styles.input} />
        <TextInput
          value={mobile}
          onChangeText={setMobile}
          placeholder="Mobile number"
          keyboardType="phone-pad"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { marginTop: spacing.md }]}
        />
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email (optional, for Google Sign-In)"
          autoCapitalize="none"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { marginTop: spacing.md }]}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Temporary password"
          secureTextEntry
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { marginTop: spacing.md }]}
        />

        <Text style={[styles.label, { marginTop: spacing.md }]}>Role</Text>
        <View style={styles.chipRow}>
          {CREATABLE_ROLES.map((r) => (
            <Pressable key={r} onPress={() => setRole(r)} style={[styles.chip, role === r && styles.chipActive]}>
              <Text style={[styles.chipText, role === r && styles.chipTextActive]}>{roleLabel(r)}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <PrimaryButton
            label="Create Account"
            onPress={onCreate}
            loading={createStaff.isPending}
            disabled={!name.trim() || mobile.trim().length < 10 || password.length < 8}
          />
        </View>
      </Card>
    </ScrollView>
  );
}

function StaffRow({
  staff,
  pending,
  onApprove,
  onReject,
}: {
  staff: StaffAccount;
  pending?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.name}>{staff.name}</Text>
        {!staff.isActive ? (
          <View style={[styles.statusPill, styles.statusInactive]}>
            <Text style={styles.statusText}>INACTIVE</Text>
          </View>
        ) : pending ? (
          <View style={[styles.statusPill, styles.statusPending]}>
            <Text style={styles.statusText}>PENDING</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.caption}>
        {roleLabel(staff.role)} · {staff.mobile} · Joined {formatDate(staff.createdAt)}
      </Text>
      {pending ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton label="Approve" onPress={onApprove ?? (() => {})} />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton label="Reject" onPress={onReject ?? (() => {})} variant="secondary" />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.sm },
  hint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 18 },
  sectionTitle: { ...typography.bodyStrong, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { ...typography.bodyStrong, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  statusPill: { backgroundColor: colors.brandSoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusPending: { backgroundColor: colors.statusOverdueSoft },
  statusInactive: { backgroundColor: colors.surfaceMuted },
  statusText: { ...typography.captionStrong, color: colors.textPrimary },
  label: { ...typography.captionStrong, color: colors.textSecondary, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { ...typography.caption, color: colors.textPrimary },
  chipTextActive: { color: colors.textInverse },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
});
