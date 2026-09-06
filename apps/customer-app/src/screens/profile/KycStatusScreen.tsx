import React from 'react';
import { Image, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useKycStatus } from '@/hooks/useApi';
import { formatDate } from '@/utils/format';
import { KycStatus } from '@sptc/shared';

const STATUS_COLOR: Record<KycStatus, { fg: string; bg: string }> = {
  [KycStatus.NOT_STARTED]: { fg: colors.textSecondary, bg: colors.surfaceMuted },
  [KycStatus.PENDING]: { fg: colors.statusPending, bg: colors.statusPendingSoft },
  [KycStatus.SUBMITTED]: { fg: colors.statusUpcoming, bg: colors.statusUpcomingSoft },
  [KycStatus.UNDER_REVIEW]: { fg: colors.statusDue, bg: colors.statusDueSoft },
  [KycStatus.VERIFIED]: { fg: colors.statusPaid, bg: colors.statusPaidSoft },
  [KycStatus.REJECTED]: { fg: colors.statusOverdue, bg: colors.statusOverdueSoft },
  [KycStatus.EXPIRED]: { fg: colors.statusOverdue, bg: colors.statusOverdueSoft },
};

export function KycStatusScreen() {
  const { data: records, isLoading, isError, error, refetch, isRefetching } = useKycStatus();

  if (isLoading) return <LoadingState label="Loading KYC status..." />;
  if (isError) return <ErrorState message={error instanceof Error ? error.message : 'Please try again.'} onRetry={refetch} />;
  if (!records?.length) {
    return <EmptyState title="No documents on file" subtitle="Visit your SPTC Finance store to complete KYC verification." />;
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.textPrimary} />}
    >
      {records.map((record) => {
        const color = STATUS_COLOR[record.status];
        const isImage = /\.(png|jpe?g|webp|heic)$/i.test(record.documentRef);
        return (
          <Card key={record.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.docType}>{record.documentType.replace('_', ' ')}</Text>
              <View style={[styles.badge, { backgroundColor: color.bg }]}>
                <Text style={[styles.badgeText, { color: color.fg }]}>{record.status.replace('_', ' ')}</Text>
              </View>
            </View>
            <Text style={styles.masked}>{record.maskedIdentifier}</Text>
            <Text style={styles.caption}>Submitted {formatDate(record.createdAt)}</Text>
            {record.status === KycStatus.VERIFIED && record.verifiedAt ? (
              <Text style={styles.caption}>Verified {formatDate(record.verifiedAt)}</Text>
            ) : null}
            {record.rejectionReason ? <Text style={styles.rejectionReason}>{record.rejectionReason}</Text> : null}
            {record.documentRef ? (
              isImage ? (
                <Image source={{ uri: record.documentRef }} style={styles.documentImage} resizeMode="cover" />
              ) : (
                <Text style={styles.docLink} onPress={() => Linking.openURL(record.documentRef)}>
                  View submitted document
                </Text>
              )
            ) : null}
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  docType: { ...typography.bodyStrong, color: colors.textPrimary },
  masked: { ...typography.body, color: colors.textPrimary, marginTop: spacing.sm, fontFamily: 'monospace' },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  rejectionReason: { ...typography.caption, color: colors.statusOverdue, marginTop: spacing.sm },
  documentImage: { width: '100%', height: 180, borderRadius: radius.md, marginTop: spacing.md, backgroundColor: colors.surfaceMuted },
  docLink: { ...typography.captionStrong, color: colors.accent, marginTop: spacing.md, textDecorationLine: 'underline' },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { ...typography.captionStrong },
});
