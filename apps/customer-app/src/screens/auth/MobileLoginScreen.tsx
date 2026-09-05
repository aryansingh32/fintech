import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/theme';
import { Screen, PrimaryButton } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { AuthStackParamList } from '@/navigation/types';
import { ApiError } from '@sptc/shared';

type Props = NativeStackScreenProps<AuthStackParamList, 'MobileLogin'>;

export function MobileLoginScreen({ navigation }: Props) {
  const { requestOtp } = useAuth();
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (mobile.trim().length < 10) {
      Alert.alert('Enter a valid mobile number');
      return;
    }
    setLoading(true);
    try {
      await requestOtp(mobile.trim());
      navigation.navigate('OtpVerify', { mobile: mobile.trim() });
    } catch (err) {
      Alert.alert('Could not send code', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={styles.container}>
      <View style={styles.brandBlock}>
        <Text style={styles.brand}>SPTC Finance</Text>
        <Text style={styles.tagline}>Your EMIs, clear and simple.</Text>
      </View>

      <View style={styles.form}>
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
        <View style={{ height: spacing.lg }} />
        <PrimaryButton label="Send OTP" onPress={onSubmit} loading={loading} disabled={mobile.trim().length < 10} />
      </View>

      <Text style={styles.footnote}>
        By continuing, you agree to SPTC Finance's Terms of Service and Privacy Policy.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'space-between', padding: spacing.xl, paddingTop: spacing.xxl * 2 },
  brandBlock: { alignItems: 'center', marginBottom: spacing.xxl },
  brand: { ...typography.display, color: colors.brand },
  tagline: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  form: { flexGrow: 0 },
  label: { ...typography.captionStrong, color: colors.textSecondary, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 18,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  footnote: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
});
