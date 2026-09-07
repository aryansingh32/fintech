import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { colors, spacing, typography } from '@/theme/theme';
import { Card } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { canManageAgreements, canManageBranchesAndStaff, roleLabel } from '@/rbac/uiPermissions';
import { MainTabParamList, RootStackParamList } from '@/navigation/types';

type Nav = CompositeNavigationProp<BottomTabNavigationProp<MainTabParamList, 'More'>, NativeStackNavigationProp<RootStackParamList>>;

export function MoreScreen() {
  const navigation = useNavigation<Nav>();
  const { identity } = useAuth();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {identity ? (
        <Card style={styles.identityCard}>
          <Text style={styles.role}>{roleLabel(identity.role)}</Text>
          <Text style={styles.caption}>{identity.isGlobal ? 'All branches' : `Branch: ${identity.branchId}`}</Text>
        </Card>
      ) : null}

      <MenuRow label="Activity Log" onPress={() => navigation.navigate('AuditLog')} />
      {identity?.isGlobal ? <MenuRow label="Manage Loan Products" onPress={() => navigation.navigate('LoanProductsAdmin')} /> : null}
      {identity && canManageAgreements(identity.role) ? (
        <MenuRow label="Manage Agreements" onPress={() => navigation.navigate('AgreementTemplatesAdmin')} />
      ) : null}
      {identity && canManageBranchesAndStaff(identity.role) ? (
        <MenuRow label="Manage Staff & Approvals" onPress={() => navigation.navigate('StaffManagement')} />
      ) : null}
      <MenuRow label="Profile & Logout" onPress={() => navigation.navigate('Profile')} />
    </ScrollView>
  );
}

function MenuRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Card style={styles.menuItem}>
      <Text style={styles.menuLabel} onPress={onPress}>
        {label}
      </Text>
      <Text style={styles.chevron} onPress={onPress}>
        ›
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  identityCard: { marginBottom: spacing.md },
  role: { ...typography.h2, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  menuLabel: { ...typography.body, color: colors.textPrimary },
  chevron: { ...typography.h2, color: colors.textSecondary },
  noteCard: { marginTop: spacing.lg, backgroundColor: colors.surfaceMuted },
});
