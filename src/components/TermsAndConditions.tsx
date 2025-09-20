import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { theme } from '../styles/theme';

export const TermsAndConditions: React.FC = () => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={true}>
      <Text style={styles.title}>CampusLife Terms & Conditions</Text>
      <Text style={styles.lastUpdated}>Effective Date: 20 September 2025</Text>
      <Text style={styles.website}>Website: https://www.campuslifeapp.com</Text>

      <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
      <Text style={styles.text}>
        By using CampusLife, you agree to these Terms & Conditions and our Privacy Policy.
      </Text>

      <Text style={styles.sectionTitle}>2. App Purpose</Text>
      <Text style={styles.text}>
        CampusLife provides structured wellness tracking and parent-student communication. The app also allows families to facilitate financial support via external payment systems (e.g., PayPal).
      </Text>

      <Text style={styles.sectionTitle}>3. Payment Disclaimer</Text>
      <Text style={styles.bulletPoint}>External Payments: All payments occur outside the app. CampusLife does not process, store, or manage any funds.</Text>
      <Text style={styles.bulletPoint}>Attestation Model: Payment confirmation depends on parent and student attestation. The app assumes that both parties provide truthful information.</Text>
      <Text style={styles.bulletPoint}>No Liability: CampusLife is not responsible for any payment discrepancies, disputes, or errors. Users acknowledge this when confirming payments.</Text>

      <Text style={styles.sectionTitle}>4. User Obligations</Text>
      <Text style={styles.bulletPoint}>Users must provide accurate information in accounts and wellness entries.</Text>
      <Text style={styles.bulletPoint}>Parents and students must only use the app for personal, non-commercial purposes.</Text>
      <Text style={styles.bulletPoint}>Misuse of the app may result in account suspension or termination.</Text>

      <Text style={styles.sectionTitle}>5. Content and Privacy</Text>
      <Text style={styles.bulletPoint}>Users retain ownership of their wellness and profile data.</Text>
      <Text style={styles.bulletPoint}>By using CampusLife, users consent to sharing wellness updates only with parent(s) or student(s) as designed.</Text>
      <Text style={styles.bulletPoint}>Users must not attempt to access data from other families.</Text>

      <Text style={styles.sectionTitle}>6. Limitation of Liability</Text>
      <Text style={styles.text}>
        CampusLife and its affiliates are not liable for:
      </Text>
      <Text style={styles.bulletPoint}>Losses from external payments.</Text>
      <Text style={styles.bulletPoint}>Inaccurate self-reported wellness or payment attestations.</Text>
      <Text style={styles.bulletPoint}>Any indirect, incidental, or consequential damages from app use.</Text>

      <Text style={styles.sectionTitle}>7. Modifications</Text>
      <Text style={styles.text}>
        We may update these Terms & Conditions from time to time. Continued use of the app constitutes acceptance of the updated terms.
      </Text>

      <Text style={styles.sectionTitle}>8. Contact</Text>
      <Text style={styles.text}>
        For questions or concerns, please visit our website: https://www.campuslifeapp.com
      </Text>

      <Text style={styles.footer}>
        By using CampusLife, you acknowledge that you have read and understood these terms and conditions.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  lastUpdated: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  website: {
    fontSize: 14,
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginTop: 24,
    marginBottom: 12,
  },
  text: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletPoint: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginLeft: 8,
    marginBottom: 6,
  },
  footer: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    textAlign: 'center',
    marginTop: 32,
    marginBottom: 20,
    fontStyle: 'italic',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
});