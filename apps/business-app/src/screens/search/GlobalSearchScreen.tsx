import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/theme';
import { Card, EmptyState, LoadingState, Screen } from '@/components/ui';
import { useCustomerSearch, useIdentifierSearch } from '@/hooks/useApi';
import { RootStackParamList } from '@/navigation/types';

export function GlobalSearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [query, setQuery] = useState('');
  const customers = useCustomerSearch(query);
  const identifiers = useIdentifierSearch(query);

  return (
    <Screen style={styles.screen}>
      <View style={styles.searchBar}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name, mobile, customer ID, IMEI..."
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          autoFocus
        />
      </View>

      {query.trim().length === 0 ? (
        <EmptyState title="Search everything" subtitle="Customer name, mobile number, customer ID, loan ID, or IMEI/serial." />
      ) : customers.isLoading || identifiers.isLoading ? (
        <LoadingState label="Searching..." />
      ) : (
        <FlatList
          contentContainerStyle={styles.content}
          data={customers.data ?? []}
          keyExtractor={(c) => c.id}
          ListHeaderComponent={
            identifiers.data?.length ? (
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={styles.sectionTitle}>Devices (IMEI/Serial)</Text>
                {identifiers.data.map((identifier) => (
                  <Card key={identifier.id} style={styles.card}>
                    <Text style={styles.name}>
                      {identifier.product?.brand} {identifier.product?.model}
                    </Text>
                    <Text style={styles.caption}>
                      {identifier.imei1 ?? identifier.serialNumber} · {identifier.status}
                    </Text>
                  </Card>
                ))}
                <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Customers</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={<EmptyState title="No results" />}
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate('CustomerProfile', { customerId: item.id })}>
              <Card style={styles.card}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.caption}>
                  {item.customerCode} · {item.mobile}
                </Text>
              </Card>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { padding: spacing.lg },
  searchBar: { marginBottom: spacing.lg },
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
  content: { paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.md },
  name: { ...typography.bodyStrong, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  sectionTitle: { ...typography.captionStrong, color: colors.textSecondary },
});
