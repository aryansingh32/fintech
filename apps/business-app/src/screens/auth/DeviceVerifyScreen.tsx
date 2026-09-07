import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/theme';
import { Screen, Card, PrimaryButton } from '@/components/ui';
import { useOtpBanner } from '@/components/OtpIslandBanner';
import { useAuth } from '@/auth/AuthContext';
import { AuthStackParamList } from '@/navigation/types';
import { ApiError } from '@sptc/shared';

type Props = NativeStackScreenProps<AuthStackParamList, 'DeviceVerify'>;

export function DeviceVerifyScreen({ route }: Props) {
  const { mobile, devOtp } = route.params;
  const { verifyDevice } = useAuth();
  const { showOtp } = useOtpBanner();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const submit = async (code: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      await verifyDevice(mobile, code.trim());
    } catch (err) {
      Alert.alert('Incorrect code', err instanceof ApiError ? err.message : 'Please try again.');
      submittingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  // Shows on this screen (not the login screen before it), after the
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

  const onSubmit = () => submit(otp);

  return (
    <Screen style={styles.container}>
      <Text style={styles.h1}>Verify this device</Text>
      <Text style={styles.subtitle}>
        This is a new device for {mobile}. Enter the verification code to continue.
      </Text>

      <View style={{ height: spacing.xl }} />
      <Card>
        <TextInput
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
          maxLength={6}
          style={styles.otpInput}
          autoFocus
        />
      </Card>

      <View style={{ height: spacing.lg }} />
      <PrimaryButton label="Verify Device" onPress={onSubmit} loading={loading} disabled={otp.length !== 6} />
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
