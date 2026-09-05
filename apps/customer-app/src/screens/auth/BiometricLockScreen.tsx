import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors, spacing, typography } from '@/theme/theme';
import { Screen, Card, PrimaryButton, LiquidMark } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { ApiError } from '@sptc/shared';

/**
 * App-lock gate shown whenever the app returns from the background while
 * already logged in (blueprint #4.1 biometric unlock, #40 device security).
 * This does NOT re-authenticate with the server by itself - Face/Touch ID
 * just unlocks the already-valid session locally. The PIN fallback DOES
 * call the server (the same pinLogin the cold-start flow uses), which both
 * unlocks the screen and refreshes the session tokens.
 */
export function BiometricLockScreen() {
  const { mobile, unlock, pinLogin, logout } = useAuth();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showPinFallback, setShowPinFallback] = useState(false);
  const [pin, setPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const available = hasHardware && isEnrolled;
      setBiometricAvailable(available);
      setChecking(false);
      if (available) attemptBiometric();
    })();
  }, []);

  const attemptBiometric = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock SPTC Finance',
      fallbackLabel: 'Use PIN instead',
      cancelLabel: 'Use PIN instead',
    });
    if (result.success) {
      unlock();
    } else {
      setShowPinFallback(true);
    }
  };

  const onPinSubmit = async () => {
    if (!mobile) return;
    setPinLoading(true);
    try {
      await pinLogin(mobile, pin);
    } catch (err) {
      Alert.alert('Incorrect PIN', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setPinLoading(false);
    }
  };

  return (
    <Screen style={styles.container}>
      <View style={styles.brandBlock}>
        <LiquidMark size={64} />
        <Text style={styles.subtitle}>App locked for your security</Text>
      </View>

      <View style={{ height: spacing.xxl }} />

      {checking ? null : biometricAvailable && !showPinFallback ? (
        <PrimaryButton label="Unlock with Biometrics" icon="finger-print" onPress={attemptBiometric} />
      ) : (
        <View style={styles.pinBlock}>
          <Text style={styles.label}>Enter your PIN</Text>
          <Card style={styles.inputCard}>
            <TextInput
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              style={styles.input}
              autoFocus
            />
          </Card>
          <View style={{ height: spacing.lg }} />
          <PrimaryButton label="Unlock" onPress={onPinSubmit} loading={pinLoading} disabled={pin.length < 4} />
        </View>
      )}

      <View style={{ height: spacing.xxl }} />
      <PrimaryButton label="Log Out" onPress={logout} variant="secondary" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center', padding: spacing.xl },
  brandBlock: { alignItems: 'center' },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md },
  pinBlock: { alignItems: 'stretch' },
  label: { ...typography.captionStrong, color: colors.textSecondary, marginBottom: spacing.sm, textAlign: 'center' },
  inputCard: { paddingVertical: spacing.md },
  input: {
    fontSize: 24,
    fontFamily: 'Manrope_800ExtraBold',
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.textPrimary,
  },
});
