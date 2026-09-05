import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/theme';
import { Card, PrimaryButton } from '@/components/ui';
import { useCreateCustomer } from '@/hooks/useApi';
import { RootStackParamList } from '@/navigation/types';
import { ApiError } from '@sptc/shared';

export function CreateCustomerScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const createCustomer = useCreateCustomer();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [city, setCity] = useState('');

  const onSubmit = async () => {
    try {
      const customer = await createCustomer.mutateAsync({ name: name.trim(), mobile: mobile.trim(), city: city.trim() || undefined });
      navigation.replace('CustomerProfile', { customerId: customer.id });
    } catch (err) {
      Alert.alert('Could not create customer', err instanceof ApiError ? err.message : 'Please try again.');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Field label="Full Name" value={name} onChangeText={setName} placeholder="Rahul Sharma" />
        <Field label="Mobile Number" value={mobile} onChangeText={setMobile} placeholder="98765 43210" keyboardType="phone-pad" />
        <Field label="City (optional)" value={city} onChangeText={setCity} placeholder="Mumbai" />
      </Card>

      <View style={{ marginTop: spacing.xl }}>
        <PrimaryButton
          label="Create Customer"
          onPress={onSubmit}
          loading={createCustomer.isPending}
          disabled={!name.trim() || mobile.trim().length < 10}
        />
      </View>
    </ScrollView>
  );
}

function Field(props: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; keyboardType?: 'phone-pad' }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={props.keyboardType}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  label: { ...typography.captionStrong, color: colors.textSecondary, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
});
