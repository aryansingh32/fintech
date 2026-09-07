import React, { useState } from 'react';
import { Alert, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, RouteProp } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { ErrorState, LoadingState, PrimaryButton } from '@/components/ui';
import {
  useApproveTicket,
  useEscalateTicket,
  useStaffAddMessage,
  useStaffSupportTicket,
  useUpdateTicketStatus,
  useUploadSupportAttachment,
} from '@/hooks/useApi';
import { formatDate } from '@/utils/format';
import { RootStackParamList } from '@/navigation/types';
import { ApiError, SupportSenderType, SupportTicketStatus } from '@sptc/shared';

export function StaffSupportChatScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'SupportChat'>>();
  const { data: ticket, isLoading, isError, error, refetch } = useStaffSupportTicket(route.params.ticketId);
  const addMessage = useStaffAddMessage(route.params.ticketId);
  const uploadAttachment = useUploadSupportAttachment();
  const escalate = useEscalateTicket(route.params.ticketId);
  const updateStatus = useUpdateTicketStatus(route.params.ticketId);
  const approveTicket = useApproveTicket(route.params.ticketId);
  const [text, setText] = useState('');

  if (isLoading) return <LoadingState label="Loading conversation..." />;
  if (isError || !ticket) {
    return <ErrorState message={error instanceof Error ? error.message : 'Could not load this ticket.'} onRetry={refetch} />;
  }

  const onSend = () => {
    if (!text.trim()) return;
    addMessage.mutate({ message: text.trim() });
    setText('');
  };

  const onAttach = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to attach an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    try {
      const attachment = await uploadAttachment.mutateAsync({
        uri: asset.uri,
        contentType: asset.mimeType ?? 'image/jpeg',
      });
      addMessage.mutate({ message: text.trim(), attachment });
      setText('');
    } catch (err) {
      Alert.alert('Could not send photo', err instanceof ApiError ? err.message : 'Please try again.');
    }
  };

  const onEscalate = () => {
    Alert.alert('Escalate ticket', 'Escalate this ticket to a manager?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Escalate', onPress: () => escalate.mutate('Escalated by staff') },
    ]);
  };

  const onResolve = () => updateStatus.mutate(SupportTicketStatus.RESOLVED);

  const onApprove = () => approveTicket.mutate();

  const onEndChat = () => {
    Alert.alert('End chat', 'End this conversation? The customer will not be able to send further messages.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End Chat', style: 'destructive', onPress: () => updateStatus.mutate(SupportTicketStatus.CLOSED) },
    ]);
  };

  const isClosed = ticket.status === SupportTicketStatus.CLOSED || ticket.status === SupportTicketStatus.RESOLVED;
  const awaitingApproval = !ticket.chatApprovedAt;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.ticketNumber}>{ticket.ticketNumber}</Text>
        <Text style={styles.caption}>
          {ticket.customer?.name} · {ticket.category} · {ticket.status.replace('_', ' ')}
        </Text>
        {awaitingApproval ? (
          <View style={{ marginTop: spacing.md }}>
            <PrimaryButton label="Approve & Open Chat" onPress={onApprove} loading={approveTicket.isPending} />
          </View>
        ) : !isClosed ? (
          <View style={styles.actionsRow}>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Escalate" onPress={onEscalate} variant="secondary" loading={escalate.isPending} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Mark Resolved" onPress={onResolve} variant="secondary" loading={updateStatus.isPending} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="End Chat" onPress={onEndChat} variant="secondary" loading={updateStatus.isPending} />
            </View>
          </View>
        ) : null}
      </View>

      <FlatList
        data={ticket.messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.messages}
        renderItem={({ item }) => {
          const isMine = item.senderType === SupportSenderType.STAFF;
          return (
            <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
              <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                {item.attachments?.map((a) => (
                  <Image key={a.id} source={{ uri: a.url }} style={styles.attachmentImage} resizeMode="cover" />
                ))}
                {item.message ? (
                  <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.message}</Text>
                ) : null}
              </View>
              <Text style={styles.timestamp}>{formatDate(item.createdAt)}</Text>
            </View>
          );
        }}
      />

      {isClosed ? (
        <View style={styles.closedBanner}>
          <Text style={styles.closedBannerText}>This conversation has been closed.</Text>
        </View>
      ) : awaitingApproval ? (
        <View style={styles.closedBanner}>
          <Text style={styles.closedBannerText}>Approve this ticket above to start chatting with the customer.</Text>
        </View>
      ) : (
        <View style={styles.inputRow}>
          <Pressable onPress={onAttach} style={styles.attachButton} disabled={uploadAttachment.isPending}>
            <Ionicons name="camera-outline" size={22} color={colors.textSecondary} />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Reply to customer..."
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            multiline
          />
          <View style={{ width: 90 }}>
            <PrimaryButton
              label="Send"
              onPress={onSend}
              loading={addMessage.isPending || uploadAttachment.isPending}
              disabled={!text.trim()}
            />
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  ticketNumber: { ...typography.bodyStrong, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  messages: { padding: spacing.lg, gap: spacing.md },
  bubbleRow: { alignItems: 'flex-start' },
  bubbleRowMine: { alignItems: 'flex-end' },
  bubble: { maxWidth: '80%', borderRadius: radius.md, padding: spacing.md },
  bubbleTheirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  bubbleMine: { backgroundColor: colors.brand },
  bubbleText: { ...typography.body, color: colors.textPrimary },
  bubbleTextMine: { color: colors.textInverse },
  attachmentImage: { width: 200, height: 200, borderRadius: radius.sm, marginBottom: spacing.xs, backgroundColor: colors.surfaceMuted },
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
  attachButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, maxHeight: 100, color: colors.textPrimary },
  closedBanner: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceMuted },
  closedBannerText: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
});
