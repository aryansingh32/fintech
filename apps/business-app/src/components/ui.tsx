import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { InstallmentStatus } from '@sptc/shared';
import { INSTALLMENT_STATUS_LABEL } from '@/utils/format';

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.brand : colors.textInverse} />
      ) : (
        <Text
          style={[
            styles.buttonLabel,
            variant === 'secondary' && { color: colors.brand },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const STATUS_COLOR: Record<InstallmentStatus, { fg: string; bg: string }> = {
  [InstallmentStatus.PAID]: { fg: colors.statusPaid, bg: colors.statusPaidSoft },
  [InstallmentStatus.UPCOMING]: { fg: colors.statusUpcoming, bg: colors.statusUpcomingSoft },
  [InstallmentStatus.DUE]: { fg: colors.statusDue, bg: colors.statusDueSoft },
  [InstallmentStatus.OVERDUE]: { fg: colors.statusOverdue, bg: colors.statusOverdueSoft },
  [InstallmentStatus.PARTIALLY_PAID]: { fg: colors.statusPending, bg: colors.statusPendingSoft },
  [InstallmentStatus.CANCELLED]: { fg: colors.textSecondary, bg: colors.surfaceMuted },
  [InstallmentStatus.ADJUSTED]: { fg: colors.textSecondary, bg: colors.surfaceMuted },
};

export function StatusBadge({ status }: { status: InstallmentStatus }) {
  const c = STATUS_COLOR[status];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{INSTALLMENT_STATUS_LABEL[status]}</Text>
    </View>
  );
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.brand} size="large" />
      <Text style={[styles.caption, { marginTop: spacing.md }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.h2}>{title}</Text>
      {subtitle ? <Text style={[styles.caption, { marginTop: spacing.xs, textAlign: 'center' }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.centered}>
      <Text style={[styles.h2, { color: colors.statusFailed }]}>Something went wrong</Text>
      <Text style={[styles.caption, { marginTop: spacing.xs, textAlign: 'center' }]}>{message}</Text>
      {onRetry ? (
        <View style={{ marginTop: spacing.lg, width: 160 }}>
          <PrimaryButton label="Try again" onPress={onRetry} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonSecondary: { backgroundColor: colors.brandSoft },
  buttonDanger: { backgroundColor: colors.statusFailed },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.85 },
  buttonLabel: { color: colors.textInverse, ...typography.bodyStrong },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { ...typography.captionStrong },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  h2: { ...typography.h2, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary },
});
