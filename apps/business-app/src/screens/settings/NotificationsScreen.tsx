import React, { useEffect } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useMarkAllNotificationsRead, useNotifications } from '@/hooks/useApi';
import { formatDate } from '@/utils/format';

export function NotificationsScreen() {
  const { data: notifications, isLoading, isError, error, refetch } = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();

  // Opening this screen is what "seeing" a notification means - clears the
  // unread dot on the bell icon back on the Dashboard.
  useEffect(() => {
    markAllRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            <View style={styles.titleRow}>
              {!item.readAt ? <View style={styles.unreadDot} /> : null}
              <Text style={styles.title}>{eventLabel(item.event)}</Text>
            </View>
            <Text style={styles.caption}>{formatDate(item.createdAt)}</Text>
          </View>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unreadDot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.statusOverdue },
  title: { ...typography.bodyStrong, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary },
});
