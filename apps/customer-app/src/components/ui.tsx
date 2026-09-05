import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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
  return (
    <View style={[styles.screen, style]}>
      <LiquidBackdrop />
      {children}
    </View>
  );
}

/**
 * Frosted glass panel - the base surface for nearly everything in this app.
 * Deliberately a single BlurView layer (border for definition, no drop shadow):
 * on Android, a separate shadow-casting wrapper around a BlurView desyncs its
 * elevation silhouette from the blur's own rounded/clipped bounds, producing a
 * visible mismatched "ghost box". A thin border reads as glass edge without
 * that failure mode, and matches real Liquid Glass UIs more closely anyway.
 */
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <BlurView intensity={46} tint="light" style={[styles.card, style]}>
      {children}
    </BlurView>
  );
}

/** Dark frosted hero card with a faint iridescent tint - the balance/summary surface. */
export function BalanceCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <BlurView intensity={75} tint="dark" style={[styles.balanceCard, style]}>
      <LinearGradient
        colors={[colors.accentStart + '33', colors.accentEnd + '22']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </BlurView>
  );
}

/** Full-screen near-white ground + faint soft-gray blobs, mounted once behind the navigator - monochrome iOS glass. */
export function LiquidBackdrop() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[colors.background, '#F3F3F4', colors.background]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.blob, { top: -60, left: -40, backgroundColor: colors.blobBlue }]} />
      <View style={[styles.blob, { top: 220, right: -80, backgroundColor: colors.blobViolet }]} />
      <View style={[styles.blob, { bottom: -100, left: -60, backgroundColor: colors.blobMint }]} />
    </View>
  );
}

/** New in-app logo mark: a gradient glass orb with a highlight crescent + wordmark. */
export function LiquidMark({ size = 56, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  return (
    <View style={styles.markRow}>
      <View style={[styles.markOrbShadow, { width: size, height: size, borderRadius: size / 2 }]}>
        <LinearGradient
          colors={[colors.accentStart, colors.accentEnd]}
          start={{ x: 0.15, y: 0.1 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.markOrb, { width: size, height: size, borderRadius: size / 2 }]}
        >
          <View
            style={{
              position: 'absolute',
              top: size * 0.14,
              left: size * 0.18,
              width: size * 0.42,
              height: size * 0.24,
              borderRadius: size * 0.2,
              backgroundColor: 'rgba(255,255,255,0.55)',
              transform: [{ rotate: '-18deg' }],
            }}
          />
        </LinearGradient>
      </View>
      {withWordmark ? <Text style={styles.markWordmark}>SPTC</Text> : null}
    </View>
  );
}

export function IconTile({
  icon,
  size = 44,
  iconSize = 20,
  iconColor = colors.accentEnd,
  style,
}: {
  icon: IconName;
  size?: number;
  iconSize?: number;
  iconColor?: string;
  style?: ViewStyle;
}) {
  return (
    <LinearGradient
      colors={[colors.accentStart + '2E', colors.accentEnd + '2E']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size * 0.32,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={iconSize} color={iconColor} />
    </LinearGradient>
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
    variant === 'primary' || variant === 'dark' || variant === 'danger'
      ? colors.textInverse
      : variant === 'outline'
        ? colors.accentEnd
        : colors.textPrimary;

  const content = (
    <View style={styles.buttonContent}>
      {loading ? (
        <SpinnerTint color={labelColor} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={labelColor} style={{ marginRight: spacing.sm }} /> : null}
          <Text style={[styles.buttonLabel, { color: labelColor }]}>{label}</Text>
        </>
      )}
    </View>
  );

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} disabled={isDisabled}>
        {variant === 'primary' ? (
          <LinearGradient
            colors={[colors.accentStart, colors.accentEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.button, size === 'lg' && styles.buttonLg, isDisabled && styles.buttonDisabled, shadow.card]}
          >
            {content}
          </LinearGradient>
        ) : (
          <View
            style={[
              styles.button,
              size === 'lg' && styles.buttonLg,
              variant === 'dark' && styles.buttonDark,
              variant === 'outline' && styles.buttonOutline,
              variant === 'secondary' && styles.buttonSecondary,
              variant === 'danger' && styles.buttonDanger,
              isDisabled && styles.buttonDisabled,
            ]}
          >
            {content}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function SpinnerTint({ color }: { color: string }) {
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
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        {active ? (
          <LinearGradient
            colors={[colors.accentStart, colors.accentEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.chip}
          >
            {icon ? <Ionicons name={icon} size={14} color={colors.textInverse} style={{ marginRight: spacing.xs }} /> : null}
            <Text style={[styles.chipLabel, { color: colors.textInverse }]}>{label}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.chip, styles.chipInactive]}>
            {icon ? <Ionicons name={icon} size={14} color={colors.textSecondary} style={{ marginRight: spacing.xs }} /> : null}
            <Text style={styles.chipLabel}>{label}</Text>
          </View>
        )}
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
          backgroundColor: 'rgba(255,255,255,0.8)',
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
  screen: { flex: 1, backgroundColor: 'transparent' },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  balanceCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  blob: { position: 'absolute', width: 260, height: 260, borderRadius: 130 },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  markOrbShadow: { shadowColor: colors.accentEnd, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  markOrb: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  markWordmark: { fontSize: 20, fontFamily: 'Manrope_800ExtraBold', color: colors.textPrimary, letterSpacing: 1 },
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
  buttonDark: { backgroundColor: colors.ink },
  buttonOutline: { backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 2, borderColor: colors.accentEnd },
  buttonSecondary: { backgroundColor: 'rgba(255,255,255,0.55)' },
  buttonDanger: { backgroundColor: colors.statusFailed },
  buttonDisabled: { opacity: 0.45 },
  buttonLabel: { ...typography.button },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
  },
  chipInactive: { backgroundColor: 'rgba(255,255,255,0.5)' },
  chipLabel: { ...typography.captionStrong, color: colors.textSecondary },
  segmentRow: { flexDirection: 'row', gap: spacing.xl },
  segmentItem: { alignItems: 'center' },
  segmentLabel: { ...typography.bodyStrong, color: colors.textSecondary, paddingBottom: spacing.sm },
  segmentLabelActive: { color: colors.textPrimary },
  segmentUnderline: { height: 3, width: '100%', borderRadius: 2, backgroundColor: 'transparent' },
  segmentUnderlineActive: { backgroundColor: colors.accentEnd },
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
  keypadKeyFlash: { backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: radius.lg },
  keypadDigit: { fontSize: 28, fontFamily: 'Manrope_700Bold', color: colors.textPrimary },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { ...typography.captionStrong },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  h2: { ...typography.h2, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary },
});
