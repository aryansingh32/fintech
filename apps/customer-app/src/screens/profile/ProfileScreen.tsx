import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, ErrorState, LoadingState, PrimaryButton } from '@/components/ui';
import { useMyProfile } from '@/hooks/useProfile';
import { useAuth } from '@/auth/AuthContext';
import { RootStackParamList } from '@/navigation/types';

function maskMobile(mobile: string): string {
  return mobile.length <= 4 ? '****' : `${'*'.repeat(mobile.length - 4)}${mobile.slice(-4)}`;
}

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data: profile, isLoading, isError, error, refetch } = useMyProfile();
  const { logout } = useAuth();

  if (isLoading) return <LoadingState label="Loading profile..." />;
  if (isError || !profile) {
    return <ErrorState message={error instanceof Error ? error.message : 'Could not load your profile.'} onRetry={refetch} />;
  }

  const onLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={styles.avatarCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>{profile.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.caption}>{maskMobile(profile.mobile)}</Text>
        <Text style={styles.customerCode}>{profile.customerCode}</Text>
      </Card>

      <MenuItem label="KYC / Document Status" badge={profile.kycStatus} onPress={() => navigation.navigate('KycStatus')} />
      <MenuItem label="Security & Devices" onPress={() => navigation.navigate('SecurityDevices')} />
      <MenuItem label="Notifications" onPress={() => navigation.navigate('Notifications')} />
      <MenuItem label="Terms, Privacy & Consents" onPress={() => navigation.navigate('Terms')} />

      <View style={{ marginTop: spacing.xl }}>
        <PrimaryButton label="Log Out" onPress={onLogout} variant="danger" />
      </View>
    </ScrollView>
  );
}

function MenuItem({ label, badge, onPress }: { label: string; badge?: string; onPress: () => void }) {
  return (
    <Card style={styles.menuItem}>
      <Text style={styles.menuLabel} onPress={onPress}>
        {label}
      </Text>
      <View style={styles.menuRight}>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge.replace('_', ' ')}</Text>
          </View>
        ) : null}
        <Text style={styles.chevron} onPress={onPress}>
          ›
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  avatarCard: { alignItems: 'center', paddingVertical: spacing.xl },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarInitial: { ...typography.h1, color: colors.brand },
  name: { ...typography.h2, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  customerCode: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  menuLabel: { ...typography.body, color: colors.textPrimary },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chevron: { ...typography.h2, color: colors.textSecondary },
  badge: { backgroundColor: colors.brandSoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { ...typography.captionStrong, color: colors.brand },
});
