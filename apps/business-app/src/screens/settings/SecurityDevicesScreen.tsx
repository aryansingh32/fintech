import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/theme';
import { Card, EmptyState, ErrorState, LoadingState, PrimaryButton } from '@/components/ui';
import { useLogoutOtherDevices, useStaffDevices } from '@/hooks/useApi';
import { formatDate } from '@/utils/format';
import { ApiError } from '@sptc/shared';

export function SecurityDevicesScreen() {
  const { data: devices, isLoading, isError, error, refetch } = useStaffDevices();
  const logoutOtherDevices = useLogoutOtherDevices();
  const [confirming, setConfirming] = useState(false);

  const onLogoutOtherDevices = () => {
    Alert.alert('Log out other devices', 'This will end all your sessions except this one.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out others',
        style: 'destructive',
        onPress: async () => {
          setConfirming(true);
          try {
            const res = await logoutOtherDevices.mutateAsync();
            Alert.alert('Done', `${res.revokedSessions} other session(s) logged out.`);
          } catch (err) {
            Alert.alert('Could not log out other devices', err instanceof ApiError ? err.message : 'Please try again.');
          } finally {
            setConfirming(false);
          }
        },
      },
    ]);
  };

  if (isLoading) return <LoadingState label="Loading sessions..." />;
  if (isError) return <ErrorState message={error instanceof Error ? error.message : 'Please try again.'} onRetry={refetch} />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!devices?.length ? (
        <EmptyState title="No active sessions" />
      ) : (
        devices.map((session) => (
          <Card key={session.id} style={styles.card}>
            <Text style={styles.deviceName}>{session.device?.platform ?? 'Unknown device'}</Text>
            <Text style={styles.caption}>Last active {formatDate(session.lastUsedAt)}</Text>
            <Text style={styles.caption}>Session expires {formatDate(session.expiresAt)}</Text>
          </Card>
        ))
      )}

      <View style={{ marginTop: spacing.xl }}>
        <PrimaryButton label="Log Out Other Devices" onPress={onLogoutOtherDevices} loading={confirming} variant="secondary" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  card: { marginBottom: spacing.md },
  deviceName: { ...typography.bodyStrong, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
