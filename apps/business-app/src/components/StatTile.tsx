import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, spacing, typography } from '@/theme/theme';
import { Card } from '@/components/ui';

export function StatTile({
  label,
  value,
  accent,
  onPress,
}: {
  label: string;
  value: string;
  accent?: 'danger' | 'success';
  onPress?: () => void;
}) {
  const content = (
    <Card style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, accent === 'danger' && { color: colors.statusOverdue }, accent === 'success' && { color: colors.statusPaid }]}>
        {value}
      </Text>
    </Card>
  );
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}

const styles = StyleSheet.create({
  tile: { width: '47%', marginBottom: spacing.md },
  label: { ...typography.caption, color: colors.textSecondary },
  value: { ...typography.h1, color: colors.textPrimary, marginTop: spacing.xs },
});
