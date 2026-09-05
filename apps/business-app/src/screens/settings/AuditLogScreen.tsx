import React, { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, EmptyState, ErrorState, LoadingState, PrimaryButton } from '@/components/ui';
import { useAuditLog } from '@/hooks/useApi';
import { formatDateTime } from '@/utils/format';
import { AuditEvent } from '@sptc/shared';

export function AuditLogScreen() {
  const { data, isLoading, isError, error, refetch } = useAuditLog();
  const [selected, setSelected] = useState<AuditEvent | null>(null);

  if (isLoading) return <LoadingState label="Loading activity log..." />;
  if (isError) return <ErrorState message={error instanceof Error ? error.message : 'Please try again.'} onRetry={refetch} />;

  if (!Array.isArray(data)) {
    return <EmptyState title="Restricted" subtitle="Only the account owner can view the full activity log." />;
  }
  if (!data.length) return <EmptyState title="No activity yet" subtitle="Every sensitive action across the platform will appear here." />;

  return (
    <>
      <FlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={data}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => setSelected(item)}>
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.action}>{item.action.replace(/_/g, ' ')}</Text>
                <Text style={styles.caption}>{formatDateTime(item.createdAt)}</Text>
              </View>
              <Text style={styles.caption}>
                {item.entityType} · {item.actorType}
                {item.role ? ` (${item.role})` : ''}
              </Text>
              {item.reason ? <Text style={styles.reason}>{item.reason}</Text> : null}
            </Card>
          </Pressable>
        )}
      />
      {selected ? <AuditDetailModal event={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}

function AuditDetailModal({ event, onClose }: { event: AuditEvent; onClose: () => void }) {
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <ScrollView>
            <Text style={styles.modalTitle}>{event.action.replace(/_/g, ' ')}</Text>
            <DetailRow label="When" value={formatDateTime(event.createdAt)} />
            <DetailRow label="Entity" value={`${event.entityType} · ${event.entityId}`} />
            <DetailRow label="Actor" value={`${event.actorType}${event.role ? ` (${event.role})` : ''} · ${event.actorId ?? '—'}`} />
            {event.reason ? <DetailRow label="Reason" value={event.reason} /> : null}
            {event.beforeState ? <DetailRow label="Before" value={JSON.stringify(event.beforeState, null, 2)} mono /> : null}
            {event.afterState ? <DetailRow label="After" value={JSON.stringify(event.afterState, null, 2)} mono /> : null}
            {event.ipAddress ? <DetailRow label="IP Address" value={event.ipAddress} /> : null}
          </ScrollView>
          <View style={{ height: spacing.md }} />
          <PrimaryButton label="Close" onPress={onClose} variant="secondary" />
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  action: { ...typography.bodyStrong, color: colors.textPrimary, textTransform: 'capitalize' },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  reason: { ...typography.caption, color: colors.textPrimary, marginTop: spacing.xs, fontStyle: 'italic' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', maxHeight: '80%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  modalTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.md, textTransform: 'capitalize' },
  detailLabel: { ...typography.captionStrong, color: colors.textSecondary, marginBottom: spacing.xs },
  detailValue: { ...typography.body, color: colors.textPrimary },
  mono: { fontFamily: 'monospace', fontSize: 12 },
});
