import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { useOfflineSync } from '@/offline/useOfflineSync';

/** Always-visible connectivity/sync indicator (blueprint #39: "Clear online/offline status indicator"). */
export function OfflineBanner() {
  const { isOnline, queueLength, syncState } = useOfflineSync();

  if (isOnline && queueLength === 0) return null;

  return (
    <View style={[styles.banner, !isOnline ? styles.offline : styles.syncing]}>
      <Text style={styles.text}>
        {!isOnline
          ? `OFFLINE MODE${queueLength > 0 ? ` · ${queueLength} payment(s) queued` : ''}`
          : syncState === 'SYNCING'
            ? `Syncing ${queueLength} queued payment(s)...`
            : `${queueLength} payment(s) waiting to sync`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.md },
  offline: { backgroundColor: colors.statusOverdueSoft },
  syncing: { backgroundColor: colors.statusPendingSoft },
  text: { ...typography.captionStrong, color: colors.textPrimary, textAlign: 'center' },
});
