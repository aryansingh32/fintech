import React, { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { ErrorState, LoadingState, PrimaryButton } from '@/components/ui';
import { useAddSupportMessage, useSupportTicket } from '@/hooks/useApi';
import { formatDate } from '@/utils/format';
import { RootStackParamList } from '@/navigation/types';
import { SupportSenderType } from '@sptc/shared';

export function SupportChatScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'SupportChat'>>();
  const { data: ticket, isLoading, isError, error, refetch } = useSupportTicket(route.params.ticketId);
  const addMessage = useAddSupportMessage(route.params.ticketId);
  const [text, setText] = useState('');

  if (isLoading) return <LoadingState label="Loading conversation..." />;
  if (isError || !ticket) {
    return <ErrorState message={error instanceof Error ? error.message : 'Could not load this ticket.'} onRetry={refetch} />;
  }

  const onSend = () => {
    if (!text.trim()) return;
    addMessage.mutate(text.trim());
    setText('');
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.ticketNumber}>{ticket.ticketNumber}</Text>
        <Text style={styles.caption}>{ticket.category} · {ticket.status.replace('_', ' ')}</Text>
      </View>

      <FlatList
        data={ticket.messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.messages}
        renderItem={({ item }) => {
          const isMine = item.senderType === SupportSenderType.CUSTOMER;
          return (
            <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
              <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.message}</Text>
              </View>
              <Text style={styles.timestamp}>{formatDate(item.createdAt)}</Text>
            </View>
          );
        }}
      />

      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          multiline
        />
        <View style={{ width: 90 }}>
          <PrimaryButton label="Send" onPress={onSend} loading={addMessage.isPending} disabled={!text.trim()} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  ticketNumber: { ...typography.bodyStrong, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary },
  messages: { padding: spacing.lg, gap: spacing.md },
  bubbleRow: { alignItems: 'flex-start' },
  bubbleRowMine: { alignItems: 'flex-end' },
  bubble: { maxWidth: '80%', borderRadius: radius.md, padding: spacing.md },
  bubbleTheirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  bubbleMine: { backgroundColor: colors.brand },
  bubbleText: { ...typography.body, color: colors.textPrimary },
  bubbleTextMine: { color: colors.textInverse },
  timestamp: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  inputRow: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    maxHeight: 100,
    color: colors.textPrimary,
  },
});
