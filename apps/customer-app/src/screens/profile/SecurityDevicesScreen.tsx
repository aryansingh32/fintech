import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/theme';
import { Card, EmptyState, ErrorState, LoadingState, PrimaryButton } from '@/components/ui';
import { useMyDevices } from '@/hooks/useApi';
import { apiClient } from '@/api/apiClient';
import { formatDate } from '@/utils/format';
import { ApiError } from '@sptc/shared';

export function SecurityDevicesScreen() {
  const { data: devices, isLoading, isError, error, refetch } = useMyDevices();
  const [loggingOutOthers, setLoggingOutOthers] = useState(false);

  const onLogoutOtherDevices = () => {
    Alert.alert('Log out other devices', 'This will end all your sessions except this one.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out others',
        style: 'destructive',
        onPress: async () => {
          setLoggingOutOthers(true);
          try {
            const res = await apiClient.customerAuth.logoutOtherDevices();
            Alert.alert('Done', `${res.revokedSessions} other session(s) logged out.`);
            refetch();
          } catch (err) {
            Alert.alert('Could not log out other devices', err instanceof ApiError ? err.message : 'Please try again.');
          } finally {
            setLoggingOutOthers(false);
          }
        },
      },
    ]);
  };

  if (isLoading) return <LoadingState label="Loading devices..." />;
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
        <PrimaryButton label="Log Out Other Devices" onPress={onLogoutOtherDevices} loading={loggingOutOthers} variant="secondary" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  card: { marginBottom: spacing.md },
  deviceName: { ...typography.bodyStrong, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
