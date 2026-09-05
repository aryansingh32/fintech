import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/theme';
import { Screen, Card, PrimaryButton } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { ApiError } from '@sptc/shared';

export function CreatePinScreen() {
  const { setPin } = useAuth();
  const [pin, setPinValue] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = pin.length >= 4 && pin === confirmPin;

  const onSubmit = async () => {
    if (pin !== confirmPin) {
      Alert.alert('PINs do not match');
      return;
    }
    setLoading(true);
    try {
      await setPin(pin);
    } catch (err) {
      Alert.alert('Could not set PIN', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={styles.container}>
      <Text style={styles.h1}>Create your PIN</Text>
      <Text style={styles.subtitle}>You'll use this to quickly unlock the app next time.</Text>

      <View style={{ height: spacing.xl }} />
      <Text style={styles.label}>New PIN (4-6 digits)</Text>
      <Card style={styles.inputCard}>
        <TextInput
          value={pin}
          onChangeText={setPinValue}
          keyboardType="number-pad"
          maxLength={6}
          secureTextEntry
          style={styles.input}
          autoFocus
        />
      </Card>

      <View style={{ height: spacing.lg }} />
      <Text style={styles.label}>Confirm PIN</Text>
      <Card style={styles.inputCard}>
        <TextInput
          value={confirmPin}
          onChangeText={setConfirmPin}
          keyboardType="number-pad"
          maxLength={6}
          secureTextEntry
          style={styles.input}
        />
      </Card>

      <View style={{ height: spacing.xl }} />
      <PrimaryButton label="Create PIN" onPress={onSubmit} loading={loading} disabled={!canSubmit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingTop: spacing.xxl * 2 },
  h1: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  label: { ...typography.captionStrong, color: colors.textSecondary, marginBottom: spacing.sm },
  inputCard: { paddingVertical: spacing.md },
  input: {
    fontSize: 22,
    fontFamily: 'Manrope_800ExtraBold',
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.textPrimary,
  },
});
