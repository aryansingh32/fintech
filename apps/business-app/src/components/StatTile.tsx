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
  // The 47% width has to live on the direct child of the Dashboard's
  // flex-wrap row (this Pressable) - putting it on the Card instead (a
  // child of THIS wrapper) resolves the percentage against the wrapper's
  // own shrink-to-fit size instead of the row's, collapsing the tile to
  // the wrong dimensions. `disabled` keeps it inert (no ripple/opacity
  // feedback) when there's nothing to tap.
  return (
    <Pressable style={styles.tile} onPress={onPress} disabled={!onPress}>
      <Card>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, accent === 'danger' && { color: colors.statusOverdue }, accent === 'success' && { color: colors.statusPaid }]}>
          {value}
        </Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { width: '47%', marginBottom: spacing.md },
  label: { ...typography.caption, color: colors.textSecondary },
  value: { ...typography.h1, color: colors.textPrimary, marginTop: spacing.xs },
});
