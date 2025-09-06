import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { theme } from '../styles/theme';

export const PrivacyPolicy: React.FC = () => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={true}>
      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.lastUpdated}>Last updated: {new Date().toLocaleDateString()}</Text>

      <Text style={styles.sectionTitle}>1. Information We Collect</Text>
      <Text style={styles.text}>
        We collect information you provide directly to us, such as when you create an account, use our services, or contact us. This includes:
      </Text>
      <Text style={styles.bulletPoint}>• Name and email address</Text>
      <Text style={styles.bulletPoint}>• Family connection information</Text>
      <Text style={styles.bulletPoint}>• Wellness and activity data you choose to share</Text>
      <Text style={styles.bulletPoint}>• Payment information for transactions</Text>
      <Text style={styles.bulletPoint}>• Messages and communications within the app</Text>

      <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
      <Text style={styles.text}>
        We use the information we collect to:
      </Text>
      <Text style={styles.bulletPoint}>• Provide and maintain our services</Text>
      <Text style={styles.bulletPoint}>• Connect family members through our platform</Text>
      <Text style={styles.bulletPoint}>• Process payments and transactions</Text>
      <Text style={styles.bulletPoint}>• Send you important notifications and updates</Text>
      <Text style={styles.bulletPoint}>• Improve our services and user experience</Text>

      <Text style={styles.sectionTitle}>3. Information Sharing</Text>
      <Text style={styles.text}>
        We do not sell or rent your personal information to third parties. We may share your information only:
      </Text>
      <Text style={styles.bulletPoint}>• With family members you've connected with</Text>
      <Text style={styles.bulletPoint}>• With service providers who help us operate our services</Text>
      <Text style={styles.bulletPoint}>• When required by law or to protect our rights</Text>

      <Text style={styles.sectionTitle}>4. Data Security</Text>
      <Text style={styles.text}>
        We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet is 100% secure.
      </Text>

      <Text style={styles.sectionTitle}>5. Your Rights</Text>
      <Text style={styles.text}>
        You have the right to:
      </Text>
      <Text style={styles.bulletPoint}>• Access and update your personal information</Text>
      <Text style={styles.bulletPoint}>• Delete your account and associated data</Text>
      <Text style={styles.bulletPoint}>• Control your notification preferences</Text>
      <Text style={styles.bulletPoint}>• Request a copy of your data</Text>

      <Text style={styles.sectionTitle}>6. Children's Privacy</Text>
      <Text style={styles.text}>
        Our service is designed for college students and their families. We do not knowingly collect personal information from children under 13. If you believe we have collected such information, please contact us immediately.
      </Text>

      <Text style={styles.sectionTitle}>7. Changes to This Policy</Text>
      <Text style={styles.text}>
        We may update this privacy policy from time to time. We will notify you of any changes by posting the new privacy policy in the app and updating the "Last updated" date.
      </Text>

      <Text style={styles.sectionTitle}>8. Contact Us</Text>
      <Text style={styles.text}>
        If you have any questions about this privacy policy or our practices, please contact us at:
      </Text>
      <Text style={styles.contactText}>Email: privacy@campuslifeapp.com</Text>
      <Text style={styles.contactText}>Support: support@campuslifeapp.com</Text>

      <Text style={styles.footer}>
        By using CampusLife, you acknowledge that you have read and understood this privacy policy.
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
    marginBottom: 24,
    fontStyle: 'italic',
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
  contactText: {
    fontSize: 15,
    color: theme.colors.primary,
    lineHeight: 22,
    marginLeft: 8,
    marginBottom: 6,
    fontWeight: '500',
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