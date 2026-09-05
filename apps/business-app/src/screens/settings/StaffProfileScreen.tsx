import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/theme';
import { Card, PrimaryButton, Screen } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { roleLabel } from '@/rbac/uiPermissions';

export function StaffProfileScreen() {
  const { identity, logout } = useAuth();

  const onLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <Screen style={styles.screen}>
      <Card>
        <Text style={styles.label}>Role</Text>
        <Text style={styles.value}>{identity ? roleLabel(identity.role) : '—'}</Text>

        <Text style={[styles.label, { marginTop: spacing.lg }]}>Branch Access</Text>
        <Text style={styles.value}>{identity?.isGlobal ? 'All Branches' : identity?.branchId ?? '—'}</Text>
      </Card>

      <View style={{ marginTop: spacing.xl }}>
        <PrimaryButton label="Log Out" onPress={onLogout} variant="danger" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { padding: spacing.lg },
  label: { ...typography.captionStrong, color: colors.textSecondary },
  value: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.xs },
});
