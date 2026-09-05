import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/theme';
import { Card } from '@/components/ui';

export function StatTile({ label, value, accent }: { label: string; value: string; accent?: 'danger' | 'success' }) {
  return (
    <Card style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, accent === 'danger' && { color: colors.statusOverdue }, accent === 'success' && { color: colors.statusPaid }]}>
        {value}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: { width: '47%', marginBottom: spacing.md },
  label: { ...typography.caption, color: colors.textSecondary },
  value: { ...typography.h1, color: colors.textPrimary, marginTop: spacing.xs },
});
