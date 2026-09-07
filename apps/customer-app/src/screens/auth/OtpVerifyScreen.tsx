import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/theme';
import { Screen, Card, PrimaryButton } from '@/components/ui';
import { useOtpBanner } from '@/components/OtpIslandBanner';
import { useAuth } from '@/auth/AuthContext';
import { AuthStackParamList } from '@/navigation/types';
import { ApiError } from '@sptc/shared';

const RESEND_COOLDOWN_SECONDS = 30;

type Props = NativeStackScreenProps<AuthStackParamList, 'OtpVerify'>;

export function OtpVerifyScreen({ route }: Props) {
  const { mobile, devOtp } = route.params;
  const { verifyOtp, requestOtp } = useAuth();
  const { showOtp } = useOtpBanner();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const submittingRef = useRef(false);

  const submit = async (code: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      await verifyOtp(mobile, code.trim());
      // Navigation happens automatically: RootNavigator watches auth status.
    } catch (err) {
      Alert.alert('Incorrect code', err instanceof ApiError ? err.message : 'Please try again.');
      submittingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  // Shows on this screen (not the number-entry screen before it), after the
  // island's own simulated delivery delay - then auto-fills and submits the
  // code itself, the way iOS auto-fills an OTP from a Messages suggestion.
  useEffect(() => {
    if (devOtp) {
      showOtp(devOtp, {
        onDelivered: () => {
          setOtp(devOtp);
          setTimeout(() => submit(devOtp), 500);
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const onSubmit = () => submit(otp);

  const onResend = async () => {
    setResending(true);
    try {
      const { devOtp: newDevOtp } = await requestOtp(mobile);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setOtp('');
      submittingRef.current = false;
      if (newDevOtp) {
        showOtp(newDevOtp, {
          onDelivered: () => {
            setOtp(newDevOtp);
            setTimeout(() => submit(newDevOtp), 500);
          },
        });
      }
    } catch (err) {
      Alert.alert('Could not resend code', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen style={styles.container}>
      <Text style={styles.h1}>Enter verification code</Text>
      <Text style={styles.subtitle}>We sent a 6-digit code to {mobile}</Text>

      <View style={{ height: spacing.xl }} />
      <Card>
        <TextInput
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="••••••"
          placeholderTextColor={colors.textSecondary}
          style={styles.otpInput}
          autoFocus
        />
      </Card>

      <View style={{ height: spacing.lg }} />
      <PrimaryButton label="Verify" onPress={onSubmit} loading={loading} disabled={otp.trim().length !== 6} />

      <View style={{ height: spacing.lg }} />
      <PrimaryButton
        label={cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        onPress={onResend}
        loading={resending}
        disabled={cooldown > 0}
        variant="secondary"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingTop: spacing.xxl * 2 },
  h1: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  otpInput: {
    fontSize: 30,
    fontFamily: 'Manrope_800ExtraBold',
    letterSpacing: 10,
    textAlign: 'center',
    color: colors.textPrimary,
  },
});
