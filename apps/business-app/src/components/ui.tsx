import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '@/theme/theme';
import { InstallmentStatus } from '@sptc/shared';
import { INSTALLMENT_STATUS_LABEL } from '@/utils/format';

type IconName = keyof typeof Ionicons.glyphMap;

/** Shared press-scale interaction used by every tappable primitive below. */
function usePressScale(disabled?: boolean) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => {
    if (disabled) return;
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  };
  return { scale, onPressIn, onPressOut };
}

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** The black, VISA-style elevated card used for balance/summary hero content. */
export function BalanceCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.balanceCard, style]}>{children}</View>;
}

export function IconTile({
  icon,
  size = 44,
  iconSize = 20,
  bg = colors.ink,
  iconColor = colors.textInverse,
  style,
}: {
  icon: IconName;
  size?: number;
  iconSize?: number;
  bg?: string;
  iconColor?: string;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size * 0.32,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={iconSize} color={iconColor} />
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  icon,
  size = 'md',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'dark' | 'outline' | 'secondary' | 'danger';
  icon?: IconName;
  size?: 'md' | 'lg';
}) {
  const isDisabled = disabled || loading;
  const { scale, onPressIn, onPressOut } = usePressScale(isDisabled);

  const labelColor =
    variant === 'primary'
      ? colors.accentText
      : variant === 'outline'
        ? colors.ink
        : variant === 'secondary'
          ? colors.textPrimary
          : colors.textInverse;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isDisabled}
        style={[
          styles.button,
          size === 'lg' && styles.buttonLg,
          variant === 'primary' && styles.buttonPrimary,
          variant === 'dark' && styles.buttonDark,
          variant === 'outline' && styles.buttonOutline,
          variant === 'secondary' && styles.buttonSecondary,
          variant === 'danger' && styles.buttonDanger,
          isDisabled && styles.buttonDisabled,
        ]}
      >
        {loading ? (
          <ActivityIndicatorTint color={labelColor} />
        ) : (
          <View style={styles.buttonContent}>
            {icon ? <Ionicons name={icon} size={18} color={labelColor} style={{ marginRight: spacing.sm }} /> : null}
            <Text style={[styles.buttonLabel, { color: labelColor }]}>{label}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function ActivityIndicatorTint({ color }: { color: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View
      style={{
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: color,
        borderTopColor: 'transparent',
        transform: [{ rotate }],
      }}
    />
  );
}

export function Chip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  const { scale, onPressIn, onPressOut } = usePressScale();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.chip, active && styles.chipActive]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={14}
            color={active ? colors.textInverse : colors.textSecondary}
            style={{ marginRight: spacing.xs }}
          />
        ) : null}
        <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmentRow}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable key={opt.value} onPress={() => onChange(opt.value)} style={styles.segmentItem}>
            <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{opt.label}</Text>
            <View style={[styles.segmentUnderline, active && styles.segmentUnderlineActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function TransactionRow({
  icon,
  title,
  subtitle,
  amount,
  positive,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  amount: string;
  positive?: boolean;
  onPress?: () => void;
}) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper onPress={onPress} style={styles.txRow}>
      <IconTile icon={icon} />
      <View style={styles.txMeta}>
        <Text style={styles.txTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.txSubtitle}>{subtitle}</Text>
      </View>
      <Text style={[styles.txAmount, positive && { color: colors.statusPaid }]}>{amount}</Text>
    </Wrapper>
  );
}

/** Big digit readout used above a NumericKeypad. Confirmed digits are bold ink; the unfilled remainder reads muted. */
export function AmountDisplay({ value, currency = '₹' }: { value: string; currency?: string }) {
  const display = value.length ? value : '0';
  const [whole, frac] = display.split('.');
  return (
    <View style={styles.amountRow}>
      <Text style={styles.amountCurrency}>{currency}</Text>
      <Text style={styles.amountWhole}>{whole}</Text>
      <Text style={styles.amountFrac}>{frac !== undefined ? `.${frac}` : '.00'}</Text>
    </View>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

export function NumericKeypad({
  onKeyPress,
  onBackspace,
}: {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
}) {
  return (
    <View style={styles.keypad}>
      {KEYS.map((key) => (
        <KeypadKey key={key} value={key} onPress={() => (key === '⌫' ? onBackspace() : onKeyPress(key))} />
      ))}
    </View>
  );
}

function KeypadKey({ value, onPress }: { value: string; onPress: () => void }) {
  const { scale, onPressIn, onPressOut } = usePressScale();
  const opacity = useRef(new Animated.Value(0)).current;
  const handlePressIn = () => {
    onPressIn();
    Animated.timing(opacity, { toValue: 1, duration: 80, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    onPressOut();
    Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
  };
  return (
    <Animated.View style={[styles.keypadKeyWrap, { transform: [{ scale }] }]}>
      <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={styles.keypadKey}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.keypadKeyFlash, { opacity }]} />
        {value === '⌫' ? (
          <Ionicons name="backspace-outline" size={24} color={colors.textPrimary} />
        ) : (
          <Text style={styles.keypadDigit}>{value}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

/** Animated shimmer sweep placeholder for loading lists/cards. */
export function Skeleton({ width = '100%', height = 16, radius: r = radius.sm, style }: { width?: number | `${number}%`; height?: number; radius?: number; style?: ViewStyle }) {
  const translate = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(translate, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [translate]);
  const translateX = translate.interpolate({ inputRange: [0, 1], outputRange: [-140, 140] });
  return (
    <View style={[{ width, height, borderRadius: r, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }, style]}>
      <Animated.View
        style={{
          width: 80,
          height: '100%',
          backgroundColor: 'rgba(255,255,255,0.7)',
          transform: [{ translateX }, { skewX: '-20deg' }],
        }}
      />
    </View>
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
      <View style={{ width: '70%', gap: spacing.sm }}>
        <Skeleton height={64} radius={radius.md} />
        <Skeleton height={16} width="60%" />
      </View>
      <Text style={[styles.caption, { marginTop: spacing.lg }]}>{label}</Text>
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
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  balanceCard: {
    backgroundColor: colors.ink,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadow.raised,
  },
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    backgroundColor: colors.surfaceMuted,
  },
  buttonLg: { minHeight: 64, borderRadius: radius.lg },
  buttonContent: { flexDirection: 'row', alignItems: 'center' },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonDark: { backgroundColor: colors.ink },
  buttonOutline: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.accent },
  buttonSecondary: { backgroundColor: colors.surfaceMuted },
  buttonDanger: { backgroundColor: colors.statusFailed },
  buttonDisabled: { opacity: 0.45 },
  buttonLabel: { ...typography.button },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  chipActive: { backgroundColor: colors.ink },
  chipLabel: { ...typography.captionStrong, color: colors.textSecondary },
  chipLabelActive: { color: colors.textInverse },
  segmentRow: { flexDirection: 'row', gap: spacing.xl },
  segmentItem: { alignItems: 'center' },
  segmentLabel: { ...typography.bodyStrong, color: colors.textSecondary, paddingBottom: spacing.sm },
  segmentLabelActive: { color: colors.textPrimary },
  segmentUnderline: { height: 3, width: '100%', borderRadius: 2, backgroundColor: 'transparent' },
  segmentUnderlineActive: { backgroundColor: colors.ink },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  txMeta: { flex: 1, marginLeft: spacing.md },
  txTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  txSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  txAmount: { ...typography.bodyStrong, color: colors.textPrimary },
  amountRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  amountCurrency: { ...typography.h1, color: colors.textPrimary, marginRight: 4, marginBottom: 6 },
  amountWhole: { fontSize: 56, fontFamily: 'Manrope_800ExtraBold', color: colors.textPrimary, letterSpacing: -1 },
  amountFrac: { fontSize: 56, fontFamily: 'Manrope_800ExtraBold', color: colors.textSecondary, letterSpacing: -1 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  keypadKeyWrap: { width: '31%', marginBottom: spacing.md },
  keypadKey: {
    height: 68,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  keypadKeyFlash: { backgroundColor: colors.surfaceMuted, borderRadius: radius.lg },
  keypadDigit: { fontSize: 28, fontFamily: 'Manrope_700Bold', color: colors.textPrimary },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { ...typography.captionStrong },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  h2: { ...typography.h2, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary },
});
