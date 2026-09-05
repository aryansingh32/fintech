import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/theme';
import { Screen, Card, PrimaryButton } from '@/components/ui';
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
        <View style={styles.markOrb}>
          <Text style={styles.markGlyph}>S</Text>
        </View>
        <Text style={styles.brand}>SPTC Finance</Text>
        <Text style={styles.tagline}>Business</Text>
      </View>

      <Card>
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
      </Card>

      <View style={{ height: spacing.xl }} />
      <PrimaryButton label="Log In" icon="arrow-forward" onPress={onSubmit} loading={loading} disabled={!mobile || !password} size="lg" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center', padding: spacing.xl },
  brandBlock: { alignItems: 'center', marginBottom: spacing.xxl },
  markOrb: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  markGlyph: { fontSize: 30, fontFamily: 'Manrope_800ExtraBold', color: colors.accent },
  brand: { ...typography.display, color: colors.textPrimary },
  tagline: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  label: { ...typography.captionStrong, color: colors.textSecondary, marginBottom: spacing.sm },
  input: {
    fontSize: 17,
    fontFamily: 'Manrope_700Bold',
    color: colors.textPrimary,
    paddingVertical: spacing.xs,
  },
});
