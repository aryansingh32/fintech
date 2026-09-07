import React, { useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, EmptyState, ErrorState, LoadingState, PrimaryButton } from '@/components/ui';
import { useCreateSupportTicket, useSupportTickets } from '@/hooks/useApi';
import { formatDate } from '@/utils/format';
import { RootStackParamList } from '@/navigation/types';
import { TAB_BAR_CLEARANCE } from '@/navigation/MainTabsNavigator';
import { SupportCategory, ApiError } from '@sptc/shared';

const CATEGORIES: SupportCategory[] = [
  SupportCategory.PAYMENT,
  SupportCategory.EMI,
  SupportCategory.RECEIPT,
  SupportCategory.LOAN,
  SupportCategory.KYC,
  SupportCategory.TECHNICAL_ISSUE,
  SupportCategory.OTHER,
];

export function SupportListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data: tickets, isLoading, isError, error, refetch } = useSupportTickets();
  const createTicket = useCreateSupportTicket();
  const [modalVisible, setModalVisible] = useState(false);
  const [category, setCategory] = useState<SupportCategory>(SupportCategory.PAYMENT);
  const [message, setMessage] = useState('');

  const onCreate = async () => {
    if (!message.trim()) return;
    try {
      const ticket = await createTicket.mutateAsync({ category, message: message.trim() });
      setModalVisible(false);
      setMessage('');
      navigation.navigate('SupportChat', { ticketId: ticket.id });
    } catch (err) {
      Alert.alert('Could not create ticket', err instanceof ApiError ? err.message : 'Please try again.');
    }
  };

  return (
    <View style={styles.screen}>
      {isLoading ? (
        <LoadingState label="Loading tickets..." />
      ) : isError ? (
        <ErrorState message={error instanceof Error ? error.message : 'Please try again.'} onRetry={refetch} />
      ) : !tickets?.length ? (
        <EmptyState title="No support tickets" subtitle="Need help? Raise a ticket below and our team will get back to you." />
      ) : (
        <FlatList
          contentContainerStyle={styles.content}
          data={tickets}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate('SupportChat', { ticketId: item.id })}>
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.ticketNumber}>{item.ticketNumber}</Text>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusText}>
                      {!item.chatApprovedAt ? 'Awaiting approval' : item.status.replace('_', ' ')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.caption}>{item.category} · {formatDate(item.updatedAt)}</Text>
                {item.messages[item.messages.length - 1] ? (
                  <Text numberOfLines={1} style={styles.lastMessage}>
                    {item.messages[item.messages.length - 1].message ||
                      (item.messages[item.messages.length - 1].attachments?.length ? '📷 Photo' : '')}
                  </Text>
                ) : null}
              </Card>
            </Pressable>
          )}
        />
      )}

      <View style={styles.fabWrap}>
        <PrimaryButton label="Raise a Ticket" onPress={() => setModalVisible(true)} />
      </View>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Raise a Support Ticket</Text>

            <Text style={styles.caption}>Category</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[styles.categoryChip, category === c && styles.categoryChipActive]}
                >
                  <Text style={[styles.categoryChipText, category === c && styles.categoryChipTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.caption, { marginTop: spacing.md }]}>How can we help?</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              style={styles.textArea}
              placeholder="Describe your issue..."
              placeholderTextColor={colors.textSecondary}
            />

            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton label="Cancel" onPress={() => setModalVisible(false)} variant="secondary" />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton label="Submit" onPress={onCreate} loading={createTicket.isPending} disabled={!message.trim()} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 120 },
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketNumber: { ...typography.bodyStrong, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary },
  lastMessage: { ...typography.body, color: colors.textPrimary, marginTop: spacing.xs },
  statusPill: { backgroundColor: colors.brandSoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusText: { ...typography.captionStrong, color: colors.brand },
  fabWrap: { position: 'absolute', bottom: TAB_BAR_CLEARANCE, left: spacing.lg, right: spacing.lg },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl },
  modalTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.md },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  categoryChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  categoryChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  categoryChipText: { ...typography.caption, color: colors.textPrimary },
  categoryChipTextActive: { color: colors.textInverse },
  textArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    minHeight: 100,
    textAlignVertical: 'top',
    color: colors.textPrimary,
  },
});
