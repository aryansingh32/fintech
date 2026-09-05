import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, EmptyState, LoadingState, PrimaryButton } from '@/components/ui';
import { useCustomerSearch } from '@/hooks/useApi';
import { formatMoney } from '@/utils/format';
import { MainTabParamList, RootStackParamList } from '@/navigation/types';
import { CustomerLoanBadges } from '@sptc/shared';

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
                <View style={styles.badgeRow}>
                  <LoanBadges summary={item.loanSummary} />
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function LoanBadges({ summary }: { summary: CustomerLoanBadges }) {
  if (summary.hasNoLoans) {
    return (
      <View style={[styles.badge, styles.badgeNeutral]}>
        <Text style={[styles.badgeText, styles.badgeTextNeutral]}>No loans yet</Text>
      </View>
    );
  }
  return (
    <>
      {summary.hasOverdueLoan ? (
        <View style={[styles.badge, styles.badgeOverdue]}>
          <Text style={[styles.badgeText, styles.badgeTextOverdue]}>Overdue</Text>
        </View>
      ) : null}
      {summary.hasActiveLoan ? (
        <View style={[styles.badge, styles.badgeActive]}>
          <Text style={[styles.badgeText, styles.badgeTextActive]}>Ongoing</Text>
        </View>
      ) : null}
      {summary.hasCompletedLoan ? (
        <View style={[styles.badge, styles.badgeCompleted]}>
          <Text style={[styles.badgeText, styles.badgeTextCompleted]}>Past loan</Text>
        </View>
      ) : null}
      {Number(summary.outstanding) > 0 ? (
        <View style={[styles.badge, styles.badgeNeutral]}>
          <Text style={[styles.badgeText, styles.badgeTextNeutral]}>{formatMoney(summary.outstanding)} left</Text>
        </View>
      ) : null}
    </>
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
  content: { paddingBottom: 120 },
  card: { marginBottom: spacing.md },
  name: { ...typography.bodyStrong, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { ...typography.captionStrong },
  badgeOverdue: { backgroundColor: colors.statusOverdueSoft },
  badgeTextOverdue: { color: colors.statusOverdue },
  badgeActive: { backgroundColor: colors.statusUpcomingSoft },
  badgeTextActive: { color: colors.statusUpcoming },
  badgeCompleted: { backgroundColor: colors.statusPaidSoft },
  badgeTextCompleted: { color: colors.statusPaid },
  badgeNeutral: { backgroundColor: colors.surfaceMuted },
  badgeTextNeutral: { color: colors.textSecondary },
});
