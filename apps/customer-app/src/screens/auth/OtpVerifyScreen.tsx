import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/theme';
import { Screen, Card, PrimaryButton } from '@/components/ui';
import { useOtpBanner } from '@/components/OtpIslandBanner';
import { useAuth } from '@/auth/AuthContext';
import { AuthStackParamList } from '@/navigation/types';
import { ApiError } from '@sptc/shared';

type Props = NativeStackScreenProps<AuthStackParamList, 'OtpVerify'>;

export function OtpVerifyScreen({ route }: Props) {
  const { mobile } = route.params;
  const { verifyOtp, requestOtp } = useAuth();
  const { showOtp } = useOtpBanner();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    try {
      await verifyOtp(mobile, otp.trim());
      // Navigation happens automatically: RootNavigator watches auth status.
    } catch (err) {
      Alert.alert('Incorrect code', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setResending(true);
    try {
      const { devOtp } = await requestOtp(mobile);
      if (devOtp) showOtp(devOtp);
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
      <PrimaryButton label="Resend code" onPress={onResend} loading={resending} variant="secondary" />
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
