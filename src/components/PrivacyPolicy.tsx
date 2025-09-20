import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { theme } from '../styles/theme';

export const PrivacyPolicy: React.FC = () => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={true}>
      <Text style={styles.title}>CampusLife Privacy Policy</Text>
      <Text style={styles.lastUpdated}>Effective Date: 20 September 2025</Text>
      <Text style={styles.website}>Website: https://www.campuslifeapp.com</Text>

      <Text style={styles.sectionTitle}>1. Introduction</Text>
      <Text style={styles.text}>
        CampusLife ("we," "our," or "the App") respects your privacy. This Privacy Policy explains how we collect, use, store, and share information when you use our mobile application and services.
      </Text>

      <Text style={styles.sectionTitle}>2. Information We Collect</Text>
      <Text style={styles.text}>
        We collect only the data necessary to provide our services:
      </Text>
      <Text style={styles.bulletPoint}>Account Information: Name, email, role (parent or student), family association.</Text>
      <Text style={styles.bulletPoint}>Wellness Data: Mood, sleep, nutrition, exercise, social interaction, academic performance, and other self-reported metrics.</Text>
      <Text style={styles.bulletPoint}>Device and Usage Data: App usage patterns, crash reports, and analytics to improve performance.</Text>

      <Text style={styles.sectionTitle}>3. How We Use Your Data</Text>
      <Text style={styles.text}>
        We use collected data to:
      </Text>
      <Text style={styles.bulletPoint}>Enable secure parent-student communication and wellness tracking.</Text>
      <Text style={styles.bulletPoint}>Provide dashboards and trend analysis for parents.</Text>
      <Text style={styles.bulletPoint}>Sync wellness and account data across devices.</Text>
      <Text style={styles.bulletPoint}>Improve app functionality, performance, and user experience.</Text>

      <Text style={styles.sectionTitle}>4. How We Share Your Data</Text>
      <Text style={styles.bulletPoint}>Parent to Student: Wellness updates are shared only from student to their parent(s).</Text>
      <Text style={styles.bulletPoint}>No Cross-Family Sharing: Data is never shared with other users outside the immediate parent-student relationship.</Text>
      <Text style={styles.bulletPoint}>Third-Party Services: We use Firebase and Resend for authentication, database management, and notifications. These providers process data solely to provide services and are bound by strict security agreements.</Text>
      <Text style={styles.bulletPoint}>Payments: All financial transactions occur outside the app (e.g., via PayPal). The app does not process payment details.</Text>

      <Text style={styles.sectionTitle}>5. Security</Text>
      <Text style={styles.text}>
        We employ enterprise-grade security:
      </Text>
      <Text style={styles.bulletPoint}>Firebase Authentication and custom claims for account protection.</Text>
      <Text style={styles.bulletPoint}>Firestore Security Rules to prevent unauthorized access.</Text>
      <Text style={styles.bulletPoint}>Encryption in transit (TLS) and strict input validation.</Text>

      <Text style={styles.sectionTitle}>6. Children's Privacy</Text>
      <Text style={styles.text}>
        CampusLife is intended for college students aged 18 or older. We do not knowingly collect data from minors under 18.
      </Text>

      <Text style={styles.sectionTitle}>7. Data Retention</Text>
      <Text style={styles.text}>
        We retain your data as long as your account is active or as needed to provide our services. Users can request account deletion via the app or website.
      </Text>

      <Text style={styles.sectionTitle}>8. International Users</Text>
      <Text style={styles.text}>
        If you use CampusLife outside the United States, your data may be stored in U.S.-based servers. By using the app, you consent to this transfer.
      </Text>

      <Text style={styles.sectionTitle}>9. Changes to This Policy</Text>
      <Text style={styles.text}>
        We may update this Privacy Policy occasionally. The latest version will always be available at https://www.campuslifeapp.com
      </Text>

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