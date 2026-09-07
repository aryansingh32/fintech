import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Easing, Platform, StatusBar, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow } from '@/theme/theme';

/**
 * Simulates a "Dynamic Island" style in-app banner for OTP delivery. We
 * don't have a real SMS gateway wired up yet, so instead of silently
 * trusting the user typed the right code, the backend returns the OTP in
 * the API response (dev-mode only) and this shows it the way a real
 * notification would - after a realistic network/SMS delivery delay, the
 * island grows out of the top-center "sensor housing" pill first (shape
 * only), then its content cross-fades in half a beat later, matching the
 * real iOS Dynamic Island's two-stage compact -> expanded transition -
 * rather than an instant plain Alert dialog.
 */
type ShowOtpOptions = { label?: string; onDelivered?: () => void };
type OtpBannerContextValue = { showOtp: (otp: string, options?: ShowOtpOptions) => void };
const OtpBannerContext = createContext<OtpBannerContextValue>({ showOtp: () => {} });
export const useOtpBanner = () => useContext(OtpBannerContext);

const TOP_OFFSET = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 54;
const VISIBLE_MS = 6000;
const COLLAPSED_WIDTH = 126;
const COLLAPSED_HEIGHT = 37;
const EXPANDED_WIDTH = 272;
const EXPANDED_HEIGHT = 64;
const randomDelayMs = () => 2000 + Math.random() * 3000;

export function OtpIslandBannerProvider({ children }: { children: React.ReactNode }) {
  const [otp, setOtp] = useState<string | null>(null);
  const [label, setLabel] = useState('SPTC Finance');
  const [mounted, setMounted] = useState(false);
  const shape = useRef(new Animated.Value(0)).current;
  const content = useRef(new Animated.Value(0)).current;
  const pendingTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    pendingTimers.current.forEach(clearTimeout);
    pendingTimers.current = [];
  };

  const showOtp = useCallback(
    (code: string, options?: ShowOtpOptions) => {
      clearTimers();
      shape.setValue(0);
      content.setValue(0);
      setMounted(false);

      const arriveTimer = setTimeout(() => {
        setOtp(code);
        setLabel(options?.label ?? 'SPTC Finance · OTP');
        setMounted(true);
        options?.onDelivered?.();
        // Shape expands first (the island "growing"); content only starts
        // fading in once the capsule is mostly open, never both at once.
        Animated.sequence([
          Animated.spring(shape, { toValue: 1, useNativeDriver: false, speed: 15, bounciness: 10 }),
          Animated.timing(content, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        ]).start();

        const hideTimer = setTimeout(() => {
          Animated.sequence([
            Animated.timing(content, { toValue: 0, duration: 140, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
            Animated.spring(shape, { toValue: 0, useNativeDriver: false, speed: 18, bounciness: 4 }),
          ]).start(() => {
            setMounted(false);
            setOtp(null);
          });
        }, VISIBLE_MS);
        pendingTimers.current.push(hideTimer);
      }, randomDelayMs());
      pendingTimers.current.push(arriveTimer);
    },
    [shape, content],
  );

  const width = shape.interpolate({ inputRange: [0, 1], outputRange: [COLLAPSED_WIDTH, EXPANDED_WIDTH] });
  const height = shape.interpolate({ inputRange: [0, 1], outputRange: [COLLAPSED_HEIGHT, EXPANDED_HEIGHT] });
  const borderRadius = shape.interpolate({ inputRange: [0, 1], outputRange: [COLLAPSED_HEIGHT / 2, radius.pill] });

  return (
    <OtpBannerContext.Provider value={{ showOtp }}>
      {children}
      {mounted && otp ? (
        <View style={styles.overlay} pointerEvents="none">
          <Animated.View style={[styles.island, { width, height, borderRadius }]}>
            <Animated.View style={[styles.contentRow, { opacity: content }]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarGlyph}>S</Text>
              </View>
              <View style={styles.textBlock}>
                <Text style={styles.label} numberOfLines={1}>
                  {label}
                </Text>
                <Text style={styles.otp}>{otp.split('').join(' ')}</Text>
              </View>
            </Animated.View>
          </Animated.View>
        </View>
      ) : null}
    </OtpBannerContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
    elevation: 999,
  },
  island: {
    marginTop: TOP_OFFSET,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadow.raised,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    width: EXPANDED_WIDTH,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarGlyph: { color: colors.ink, fontSize: 16, fontFamily: 'Manrope_800ExtraBold' },
  textBlock: { flexShrink: 1 },
  label: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: 'Manrope_600SemiBold' },
  otp: { color: '#FFFFFF', fontSize: 21, fontFamily: 'Manrope_800ExtraBold', letterSpacing: 4, marginTop: 2 },
});
