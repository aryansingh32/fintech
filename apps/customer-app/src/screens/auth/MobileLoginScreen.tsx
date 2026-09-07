import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/theme';
import { Screen, Card, PrimaryButton, LiquidMark } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { signInWithGoogle } from '@/auth/googleAuth';
import { AuthStackParamList } from '@/navigation/types';
import { ApiError } from '@sptc/shared';

type Props = NativeStackScreenProps<AuthStackParamList, 'MobileLogin'>;

export function MobileLoginScreen({ navigation }: Props) {
  const { requestOtp, loginWithGoogle } = useAuth();
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const onSubmit = async () => {
    if (mobile.trim().length < 10) {
      Alert.alert('Enter a valid mobile number');
      return;
    }
    setLoading(true);
    try {
      const { devOtp } = await requestOtp(mobile.trim());
      navigation.navigate('OtpVerify', { mobile: mobile.trim(), devOtp });
    } catch (err) {
      Alert.alert('Could not send code', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const idToken = await signInWithGoogle();
      if (!idToken) return;
      await loginWithGoogle(idToken);
    } catch (err) {
      Alert.alert(
        'Could not sign in with Google',
        err instanceof ApiError ? err.message : 'Please try again or sign in with your mobile number.',
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <Screen style={styles.container}>
      <View style={styles.brandBlock}>
        <LiquidMark size={64} />
        <Text style={styles.tagline}>Your EMIs, clear and simple.</Text>
      </View>

      <Card style={styles.form}>
        <Text style={styles.label}>Mobile number</Text>
        <TextInput
          value={mobile}
          onChangeText={setMobile}
          keyboardType="phone-pad"
          maxLength={15}
          placeholder="98765 43210"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          autoFocus
        />
      </Card>
      <View style={{ height: spacing.lg }} />
      <PrimaryButton label="Send OTP" icon="arrow-forward" onPress={onSubmit} loading={loading} disabled={mobile.trim().length < 10} />

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>
      <PrimaryButton label="Sign in with Google" icon="logo-google" variant="outline" onPress={onGoogleSignIn} loading={googleLoading} />

      <Text style={styles.footnote}>
        By continuing, you agree to SPTC Finance's Terms of Service and Privacy Policy.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'space-between', padding: spacing.xl, paddingTop: spacing.xxl * 2 },
  brandBlock: { alignItems: 'center', marginBottom: spacing.xxl },
  tagline: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  form: { flexGrow: 0 },
  label: { ...typography.captionStrong, color: colors.textSecondary, marginBottom: spacing.sm },
  input: {
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
    color: colors.textPrimary,
  },
  footnote: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.caption, color: colors.textSecondary, marginHorizontal: spacing.sm },
});
