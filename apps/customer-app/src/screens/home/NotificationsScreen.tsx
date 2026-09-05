import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/theme';
import { Card, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useNotifications } from '@/hooks/useApi';
import { formatDate } from '@/utils/format';

export function NotificationsScreen() {
  const { data: notifications, isLoading, isError, error, refetch } = useNotifications();

  if (isLoading) return <LoadingState label="Loading notifications..." />;
  if (isError) return <ErrorState message={error instanceof Error ? error.message : 'Please try again.'} onRetry={refetch} />;
  if (!notifications?.length) return <EmptyState title="No notifications yet" />;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={notifications}
      keyExtractor={(n) => n.id}
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.title}>{eventLabel(item.event)}</Text>
            <Text style={styles.caption}>{formatDate(item.createdAt)}</Text>
          </View>
          {typeof item.payload?.title === 'string' ? <Text style={styles.body}>{item.payload.title as string}</Text> : null}
        </Card>
      )}
    />
  );
}

function eventLabel(event: string): string {
  return event
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  title: { ...typography.bodyStrong, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary },
  body: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
});
