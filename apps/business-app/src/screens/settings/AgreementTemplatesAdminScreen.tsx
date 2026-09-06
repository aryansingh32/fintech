import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, PrimaryButton } from '@/components/ui';
import { useActiveAgreementTemplate, usePublishAgreementTemplate } from '@/hooks/useApi';
import { formatDate } from '@/utils/format';
import { AgreementTemplateKey, ApiError } from '@sptc/shared';

const SECTIONS: { key: AgreementTemplateKey; label: string; placeholderTitle: string }[] = [
  { key: AgreementTemplateKey.TERMS_OF_SERVICE, label: 'Terms of Service', placeholderTitle: 'Terms of Service' },
  { key: AgreementTemplateKey.LOAN_AGREEMENT_DEFAULT, label: 'Default Loan Agreement', placeholderTitle: 'Loan Agreement' },
];

export function AgreementTemplatesAdminScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Agreements</Text>
      <Text style={styles.hint}>
        Published here applies to all NEW loans / customers going forward. Loans already approved keep the wording
        that was active when they were approved - edit a specific loan's agreement from that loan's detail screen
        instead.
      </Text>
      {SECTIONS.map((section) => (
        <TemplateEditor key={section.key} sectionKey={section.key} label={section.label} placeholderTitle={section.placeholderTitle} />
      ))}
    </ScrollView>
  );
}

function TemplateEditor({
  sectionKey,
  label,
  placeholderTitle,
}: {
  sectionKey: AgreementTemplateKey;
  label: string;
  placeholderTitle: string;
}) {
  const { data: active, isLoading } = useActiveAgreementTemplate(sectionKey);
  const publish = usePublishAgreementTemplate(sectionKey);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const startEdit = () => {
    setTitle(active?.title ?? placeholderTitle);
    setContent(active?.content ?? '');
    setEditing(true);
  };

  const onPublish = async () => {
    if (!content.trim()) return;
    try {
      await publish.mutateAsync({ title: title.trim() || placeholderTitle, content: content.trim() });
      setEditing(false);
    } catch (err) {
      Alert.alert('Could not publish', err instanceof ApiError ? err.message : 'Please try again.');
    }
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.sectionTitle}>{label}</Text>
      {isLoading ? (
        <Text style={styles.caption}>Loading...</Text>
      ) : editing ? (
        <>
          <Text style={styles.label}>Title</Text>
          <TextInput value={title} onChangeText={setTitle} style={styles.input} />
          <Text style={[styles.label, { marginTop: spacing.md }]}>Content</Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={8}
            style={[styles.input, { minHeight: 160, textAlignVertical: 'top' }]}
            placeholder="Full terms text shown to the customer..."
            placeholderTextColor={colors.textSecondary}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Cancel" onPress={() => setEditing(false)} variant="secondary" />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Publish New Version" onPress={onPublish} loading={publish.isPending} disabled={!content.trim()} />
            </View>
          </View>
        </>
      ) : active ? (
        <>
          <Text style={styles.caption}>Version {active.version} · Published {formatDate(active.createdAt)}</Text>
          <Text style={styles.body} numberOfLines={4}>
            {active.content}
          </Text>
          <View style={{ marginTop: spacing.md }}>
            <PrimaryButton label="Edit / Publish New Version" onPress={startEdit} variant="secondary" />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.caption}>Nothing published yet.</Text>
          <View style={{ marginTop: spacing.md }}>
            <PrimaryButton label="Publish First Version" onPress={startEdit} variant="secondary" />
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.sm },
  hint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 18 },
  card: { marginBottom: spacing.lg },
  sectionTitle: { ...typography.bodyStrong, color: colors.textPrimary, marginBottom: spacing.sm },
  caption: { ...typography.caption, color: colors.textSecondary },
  body: { ...typography.body, color: colors.textPrimary, marginTop: spacing.sm },
  label: { ...typography.captionStrong, color: colors.textSecondary, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
});
