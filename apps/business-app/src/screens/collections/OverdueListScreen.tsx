import React from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { colors, spacing, typography } from '@/theme/theme';
import { Card, EmptyState, LoadingState } from '@/components/ui';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useOverdueAging } from '@/hooks/useApi';
import { formatMoney } from '@/utils/format';
import { MainTabParamList, RootStackParamList } from '@/navigation/types';
import { OverdueAgingRow } from '@sptc/shared';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Collections'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const BUCKET_LABELS: Record<string, string> = {
  '1-7': '1-7 days overdue',
  '8-30': '8-30 days overdue',
  '31-60': '31-60 days overdue',
  '60+': '60+ days overdue',
};

export function OverdueListScreen() {
  const navigation = useNavigation<Nav>();
  const { data, isLoading } = useOverdueAging();

  if (isLoading) return <LoadingState label="Loading overdue accounts..." />;

  const sections = Object.entries(data ?? {})
    .filter(([, rows]) => rows.length > 0)
    .map(([bucket, rows]) => ({ title: BUCKET_LABELS[bucket] ?? bucket, data: rows }));

  return (
    <View style={styles.screen}>
      <OfflineBanner />
      {sections.length === 0 ? (
        <EmptyState title="No overdue accounts" subtitle="Great! All EMIs are on track." />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, idx) => `${item.loanId}-${idx}`}
          contentContainerStyle={styles.content}
          renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
          renderItem={({ item }: { item: OverdueAgingRow }) => (
            <Pressable onPress={() => navigation.navigate('LoanDetail', { loanId: item.loanId })}>
              <Card style={styles.card}>
                <View style={styles.row}>
                  <View>
                    <Text style={styles.name}>{item.customerName}</Text>
                    <Text style={styles.caption}>{item.loanNumber} · {item.daysOverdue} days</Text>
                  </View>
                  <Text style={styles.amount}>{formatMoney(item.overdueAmount)}</Text>
                </View>
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
  content: { paddingBottom: 120 },
  sectionHeader: { ...typography.captionStrong, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm },
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { ...typography.bodyStrong, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  amount: { ...typography.h2, color: colors.statusOverdue },
});
