import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { colors, spacing, typography } from '@/theme/theme';
import { Card } from '@/components/ui';

export function TermsScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.h2}>Terms of Service</Text>
        <Text style={styles.body}>
          SPTC Finance provides technology to support retail financing offered through your store and its financing
          partners. Full terms are provided at the time of loan agreement and are available from your store.
        </Text>
      </Card>
      <Card style={{ marginTop: spacing.lg }}>
        <Text style={styles.h2}>Privacy Policy</Text>
        <Text style={styles.body}>
          Your personal and KYC information is encrypted and only accessible to authorized staff for the purpose of
          processing your financing. We never share your data with unauthorized third parties.
        </Text>
      </Card>
      <Card style={{ marginTop: spacing.lg }}>
        <Text style={styles.h2}>Consents</Text>
        <Text style={styles.body}>
          By using SPTC Finance, you consent to receive account and payment notifications via push, SMS, and in-app
          messages related to your loan.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  h2: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.sm },
  body: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
});
