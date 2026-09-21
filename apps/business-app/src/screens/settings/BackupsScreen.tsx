import React, { useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, EmptyState, ErrorState, LoadingState, PrimaryButton } from '@/components/ui';
import { useBackupDownloadUrl, useBackups, useRunBackup, useSendBackupToDrive } from '@/hooks/useApi';
import { formatDateTime } from '@/utils/format';
import { ApiError, BackupRun } from '@sptc/shared';

const STATUS_LABEL: Record<BackupRun['status'], string> = {
  SUCCEEDED: 'Succeeded',
  FAILED: 'Failed',
  RUNNING: 'Running',
};

const STATUS_COLOR: Record<BackupRun['status'], { text: string; bg: string }> = {
  SUCCEEDED: { text: colors.statusSuccess, bg: colors.statusPaidSoft },
  FAILED: { text: colors.statusFailed, bg: colors.statusOverdueSoft },
  RUNNING: { text: colors.statusDue, bg: colors.statusDueSoft },
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

// Local (device) calendar date, NOT date.toISOString() - that converts to
// UTC first, which silently shifts the date back a day for any timezone
// ahead of UTC (IST included) when the picked time is near local midnight.
function toIsoDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * SUPER_ADMIN-only (see MoreScreen's isSuperAdmin gate and the backend's
 * @Roles(SUPER_ADMIN) on BackupController - this screen has no real access
 * without that). Three things live here: browse backups by date range,
 * download one to the device, and manually export one to Google Drive.
 */
export function BackupsScreen() {
  const [from, setFrom] = useState<Date | undefined>(undefined);
  const [to, setTo] = useState<Date | undefined>(undefined);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const range = { from: from ? toIsoDateOnly(from) : undefined, to: to ? toIsoDateOnly(to) : undefined };
  const { data: backups, isLoading, error, refetch } = useBackups(range);
  const runBackup = useRunBackup();
  const downloadUrl = useBackupDownloadUrl();
  const sendToDrive = useSendBackupToDrive();

  const onRunNow = () => {
    runBackup.mutate(undefined, {
      onSuccess: () => Alert.alert('Backup started', 'This can take a minute for a large database - pull down to refresh.'),
      onError: (err) => Alert.alert('Could not start backup', err instanceof ApiError ? err.message : 'Please try again.'),
    });
  };

  const onDownload = async (backup: BackupRun) => {
    setPendingId(backup.id);
    try {
      const { url } = await downloadUrl.mutateAsync(backup.id);
      // A direct R2 link with Content-Disposition: attachment - the device's
      // browser handles the actual save-to-Downloads prompt from here.
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert('Could not download backup', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setPendingId(null);
    }
  };

  const onSendToDrive = (backup: BackupRun) => {
    setPendingId(backup.id);
    sendToDrive.mutate(backup.id, {
      onSuccess: () => Alert.alert('Sent to Google Drive', 'A copy of this backup was uploaded to your connected Google Drive.'),
      onError: (err) =>
        Alert.alert('Could not send to Google Drive', err instanceof ApiError ? err.message : 'Please try again.'),
      onSettled: () => setPendingId(null),
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Database Backups</Text>
      <Text style={styles.hint}>
        Every night the whole database (customers, loans, EMIs, payments - everything, paid and unpaid) is dumped, encrypted, and
        stored automatically. Use this screen to browse past backups, download one to this device, or send one to your Google Drive
        as an extra copy.
      </Text>

      <Card style={styles.filterCard}>
        <Text style={styles.label}>Date range</Text>
        <View style={styles.filterRow}>
          <Pressable style={styles.dateChip} onPress={() => setShowFromPicker(true)}>
            <Text style={styles.dateChipText}>{from ? toIsoDateOnly(from) : 'From: Any'}</Text>
          </Pressable>
          <Pressable style={styles.dateChip} onPress={() => setShowToPicker(true)}>
            <Text style={styles.dateChipText}>{to ? toIsoDateOnly(to) : 'To: Any'}</Text>
          </Pressable>
          {from || to ? (
            <Pressable
              style={styles.clearChip}
              onPress={() => {
                setFrom(undefined);
                setTo(undefined);
              }}
            >
              <Text style={styles.clearChipText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        {showFromPicker ? (
          <DateTimePicker
            value={from ?? new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_event, selected) => {
              if (Platform.OS === 'android') setShowFromPicker(false);
              if (selected) setFrom(selected);
            }}
          />
        ) : null}
        {showToPicker ? (
          <DateTimePicker
            value={to ?? new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_event, selected) => {
              if (Platform.OS === 'android') setShowToPicker(false);
              if (selected) setTo(selected);
            }}
          />
        ) : null}
      </Card>

      <View style={{ marginBottom: spacing.lg }}>
        <PrimaryButton label="Run Backup Now" onPress={onRunNow} loading={runBackup.isPending} variant="outline" />
      </View>

      {isLoading ? <LoadingState label="Loading backups..." /> : null}
      {error ? <ErrorState message="Could not load backups." onRetry={() => refetch()} /> : null}
      {!isLoading && !error && (!backups || backups.length === 0) ? (
        <EmptyState title="No backups yet" subtitle="They start appearing here after the first nightly run, or tap Run Backup Now." />
      ) : null}

      {backups?.map((backup) => {
        const statusStyle = STATUS_COLOR[backup.status];
        const isBusy = pendingId === backup.id;
        return (
          <Card key={backup.id} style={styles.backupCard}>
            <View style={styles.row}>
              <Text style={styles.date}>{formatDateTime(backup.startedAt)}</Text>
              <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
                <Text style={[styles.statusText, { color: statusStyle.text }]}>{STATUS_LABEL[backup.status]}</Text>
              </View>
            </View>
            <Text style={styles.caption}>
              {backup.trigger === 'MANUAL' ? 'Manual' : 'Scheduled'} · {formatBytes(backup.sizeBytes)}
              {backup.sentToDriveAt ? ` · Sent to Drive ${formatDateTime(backup.sentToDriveAt)}` : ''}
            </Text>
            {backup.status === 'FAILED' && backup.errorMessage ? (
              <Text style={styles.errorText}>{backup.errorMessage}</Text>
            ) : null}

            {backup.status === 'SUCCEEDED' ? (
              <View style={styles.actionRow}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton label="Download" onPress={() => onDownload(backup)} loading={isBusy && downloadUrl.isPending} size="md" variant="secondary" />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label={backup.sentToDriveAt ? 'Send Again' : 'Send to Drive'}
                    onPress={() => onSendToDrive(backup)}
                    loading={isBusy && sendToDrive.isPending}
                    size="md"
                    variant="outline"
                  />
                </View>
              </View>
            ) : null}
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.sm },
  hint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 18 },
  label: { ...typography.captionStrong, color: colors.textSecondary, marginBottom: spacing.sm },
  filterCard: { marginBottom: spacing.md },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dateChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  dateChipText: { ...typography.caption, color: colors.textPrimary },
  clearChip: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.surfaceMuted },
  clearChipText: { ...typography.caption, color: colors.textSecondary },
  backupCard: { marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { ...typography.bodyStrong, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  errorText: { ...typography.caption, color: colors.statusFailed, marginTop: spacing.xs },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusText: { ...typography.captionStrong },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
