import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/theme';
import { Screen, PrimaryButton } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { AuthStackParamList } from '@/navigation/types';
import { ApiError } from '@sptc/shared';

type Props = NativeStackScreenProps<AuthStackParamList, 'StaffLogin'>;

export function StaffLoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    try {
      const { devOtp } = await login(mobile.trim(), password);
      if (devOtp) {
        navigation.navigate('DeviceVerify', { mobile: mobile.trim() });
        Alert.alert('Dev mode', `Verification code: ${devOtp}`);
      }
      // If no devOtp/step-up was needed, AuthContext already flipped to 'authenticated' and RootNavigator re-renders.
    } catch (err) {
      Alert.alert('Login failed', err instanceof ApiError ? err.message : 'Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={styles.container}>
      <View style={styles.brandBlock}>
        <Text style={styles.brand}>SPTC Finance</Text>
        <Text style={styles.tagline}>Business</Text>
      </View>

      <View>
        <Text style={styles.label}>Mobile number</Text>
        <TextInput
          value={mobile}
          onChangeText={setMobile}
          keyboardType="phone-pad"
          style={styles.input}
          placeholder="98765 43210"
          placeholderTextColor={colors.textSecondary}
        />

        <View style={{ height: spacing.lg }} />
        <Text style={styles.label}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={colors.textSecondary}
        />

        <View style={{ height: spacing.xl }} />
        <PrimaryButton label="Log In" onPress={onSubmit} loading={loading} disabled={!mobile || !password} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center', padding: spacing.xl },
  brandBlock: { alignItems: 'center', marginBottom: spacing.xxl },
  brand: { ...typography.display, color: colors.brand },
  tagline: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  label: { ...typography.captionStrong, color: colors.textSecondary, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
});
