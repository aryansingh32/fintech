import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Easing, Platform, StatusBar, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow } from '@/theme/theme';

/**
 * Simulates a "Dynamic Island" style in-app banner for OTP delivery. We don't
 * have a real SMS gateway wired up yet, so instead of silently trusting the
 * user typed the right code, the backend returns the OTP in the API response
 * (dev-mode only) and this shows it the way a real push notification banner
 * would - expanding from the top of the screen for a few seconds - rather
 * than a plain Alert dialog.
 */
type OtpBannerContextValue = { showOtp: (otp: string, label?: string) => void };
const OtpBannerContext = createContext<OtpBannerContextValue>({ showOtp: () => {} });
export const useOtpBanner = () => useContext(OtpBannerContext);

const TOP_OFFSET = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 54;
const VISIBLE_MS = 6000;

export function OtpIslandBannerProvider({ children }: { children: React.ReactNode }) {
  const [otp, setOtp] = useState<string | null>(null);
  const [label, setLabel] = useState('SPTC Finance');
  const progress = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showOtp = useCallback(
    (code: string, bannerLabel = 'SPTC Finance · OTP') => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setOtp(code);
      setLabel(bannerLabel);
      progress.setValue(0);
      Animated.spring(progress, { toValue: 1, useNativeDriver: false, speed: 14, bounciness: 9 }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(progress, {
          toValue: 0,
          duration: 260,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        }).start(() => setOtp(null));
      }, VISIBLE_MS);
    },
    [progress],
  );

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: [130, 260] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-50, 0] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });

  return (
    <OtpBannerContext.Provider value={{ showOtp }}>
      {children}
      {otp ? (
        <View style={styles.overlay} pointerEvents="none">
          <Animated.View style={[styles.island, { width, opacity: progress, transform: [{ translateY }, { scale }] }]}>
            <View style={styles.dot} />
            <View style={styles.textBlock}>
              <Text style={styles.label} numberOfLines={1}>
                {label}
              </Text>
              <Text style={styles.otp}>{otp.split('').join(' ')}</Text>
            </View>
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
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    ...shadow.raised,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent ?? '#34D399', marginRight: 10 },
  textBlock: { flexShrink: 1 },
  label: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: 'Manrope_600SemiBold' },
  otp: { color: '#FFFFFF', fontSize: 20, fontFamily: 'Manrope_800ExtraBold', letterSpacing: 4, marginTop: 2 },
});
