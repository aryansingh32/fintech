import React, { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, spacing, typography } from '@/theme/theme';
import { Card, ErrorState, LoadingState, PrimaryButton } from '@/components/ui';
import { useAcceptConsent, useActiveAgreementTemplate, useMyConsents } from '@/hooks/useApi';
import { AgreementTemplateKey, ApiError } from '@sptc/shared';

export function TermsScreen() {
  const { data: template, isLoading, isError, error, refetch } = useActiveAgreementTemplate(
    AgreementTemplateKey.TERMS_OF_SERVICE,
  );
  const { data: privacyPolicy, isLoading: privacyLoading } = useActiveAgreementTemplate(
    AgreementTemplateKey.PRIVACY_POLICY,
  );
  const { data: consents } = useMyConsents();
  const acceptConsent = useAcceptConsent();

  const alreadyAccepted = useMemo(
    () => Boolean(template) && consents?.some((c) => c.consentType === 'TERMS_OF_SERVICE' && c.version === String(template!.version)),
    [consents, template],
  );

  const onAccept = async () => {
    if (!template) return;
    try {
      await acceptConsent.mutateAsync({ consentType: 'TERMS_OF_SERVICE', version: String(template.version) });
    } catch (err) {
      Alert.alert('Could not record acceptance', err instanceof ApiError ? err.message : 'Please try again.');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {isLoading ? (
        <LoadingState label="Loading terms..." />
      ) : isError ? (
        <ErrorState message={error instanceof ApiError ? error.message : 'Terms are not published yet.'} onRetry={refetch} />
      ) : (
        <Card>
          <Text style={styles.h2}>{template?.title ?? 'Terms of Service'}</Text>
          <Text style={styles.body}>{template?.content}</Text>
          {template ? (
            <PrimaryButton
              label={alreadyAccepted ? 'Accepted' : 'Accept'}
              onPress={onAccept}
              disabled={alreadyAccepted}
              loading={acceptConsent.isPending}
              size="lg"
            />
          ) : null}
        </Card>
      )}
      <Card style={{ marginTop: spacing.lg }}>
        <Text style={styles.h2}>Loan Agreements</Text>
        <Text style={styles.body}>
          The specific agreement for each loan - including its EMI schedule and charges - is available from that
          loan&apos;s detail screen for you to review and accept.
        </Text>
      </Card>
      <Card style={{ marginTop: spacing.lg }}>
        <Text style={styles.h2}>{privacyPolicy?.title ?? 'Privacy Policy'}</Text>
        {privacyLoading ? (
          <Text style={styles.body}>Loading...</Text>
        ) : (
          <Text style={styles.body}>{privacyPolicy?.content ?? 'Privacy policy is not published yet.'}</Text>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  h2: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.sm },
  body: { ...typography.body, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.lg },
});
