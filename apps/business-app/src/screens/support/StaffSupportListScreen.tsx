import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useStaffSupportTickets } from '@/hooks/useApi';
import { formatDate } from '@/utils/format';
import { RootStackParamList } from '@/navigation/types';

export function StaffSupportListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data: tickets, isLoading, isError, error, refetch } = useStaffSupportTickets();

  if (isLoading) return <LoadingState label="Loading tickets..." />;
  if (isError) return <ErrorState message={error instanceof Error ? error.message : 'Please try again.'} onRetry={refetch} />;
  if (!tickets?.length) return <EmptyState title="No support tickets" />;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={tickets}
      keyExtractor={(t) => t.id}
      renderItem={({ item }) => (
        <Pressable onPress={() => navigation.navigate('SupportChat', { ticketId: item.id })}>
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.ticketNumber}>{item.ticketNumber}</Text>
              <View style={[styles.statusPill, item.status === 'ESCALATED' && styles.statusEscalated]}>
                <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
              </View>
            </View>
            <Text style={styles.caption}>
              {item.customer?.name} · {item.category} · {formatDate(item.updatedAt)}
            </Text>
            {item.messages?.length ? (
              <Text numberOfLines={1} style={styles.lastMessage}>
                {item.messages[item.messages.length - 1].message ||
                  (item.messages[item.messages.length - 1].attachments?.length ? '📷 Photo' : '')}
              </Text>
            ) : null}
          </Card>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketNumber: { ...typography.bodyStrong, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  lastMessage: { ...typography.body, color: colors.textPrimary, marginTop: spacing.xs },
  statusPill: { backgroundColor: colors.brandSoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusEscalated: { backgroundColor: colors.statusOverdueSoft },
  statusText: { ...typography.captionStrong, color: colors.textPrimary },
});
