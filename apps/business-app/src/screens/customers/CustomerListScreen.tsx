import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { colors, spacing, typography } from '@/theme/theme';
import { Card, EmptyState, LoadingState, PrimaryButton } from '@/components/ui';
import { useCustomerSearch } from '@/hooks/useApi';
import { MainTabParamList, RootStackParamList } from '@/navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Customers'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function CustomerListScreen() {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState('');
  const { data: customers, isLoading } = useCustomerSearch(query);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search customers..."
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
      </View>

      <View style={styles.newButtonWrap}>
        <PrimaryButton label="+ New Customer" onPress={() => navigation.navigate('CreateCustomer')} />
      </View>

      {isLoading ? (
        <LoadingState label="Loading customers..." />
      ) : !customers?.length ? (
        <EmptyState title="No customers found" />
      ) : (
        <FlatList
          contentContainerStyle={styles.content}
          data={customers}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate('CustomerProfile', { customerId: item.id })}>
              <Card style={styles.card}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.caption}>
                  {item.customerCode} · {item.mobile}
                </Text>
                <Text style={styles.caption}>KYC: {item.kycStatus.replace('_', ' ')}</Text>
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  header: { marginBottom: spacing.md },
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
  newButtonWrap: { marginBottom: spacing.md },
  content: { paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.md },
  name: { ...typography.bodyStrong, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
