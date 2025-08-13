import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { theme } from '../../styles/theme';
import { commonStyles } from '../../styles/components';

import { NavigationProp } from '@react-navigation/native';

type AuthStackParamList = {
  RoleSelection: undefined;
  Login: undefined;
  ParentRegister: undefined;
  StudentRegister: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
};

interface RoleSelectionScreenProps {
  navigation: NavigationProp<AuthStackParamList>;
}

export const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>CampusLife</Text>
          <Text style={styles.subtitle}>Connect • Care • Thrive</Text>
        </View>

        {/* Role Selection */}
        <View style={styles.roleSelection}>
          <Text style={styles.sectionTitle}>Get Started</Text>
          
          {/* Parent Card */}
          <TouchableOpacity 
            style={[styles.roleCard, styles.parentCard]}
            onPress={() => navigation.navigate('ParentRegister')}
          >
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <Text style={styles.cardIcon}>👨‍👩‍👧‍👦</Text>
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Parent</Text>
                <Text style={styles.cardSubtitle}>Create family account</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Student Card */}
          <TouchableOpacity 
            style={[styles.roleCard, styles.studentCard]}
            onPress={() => navigation.navigate('StudentRegister')}
          >
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <Text style={styles.cardIcon}>🎓</Text>
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Student</Text>
                <Text style={styles.cardSubtitle}>Join with invite code</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Features */}
        <View style={styles.features}>
          <Text style={styles.featuresTitle}>What makes us different</Text>
          <View style={styles.featuresList}>
            <Text style={styles.feature}>🌟 Wellness tracking & support</Text>
            <Text style={styles.feature}>💬 Meaningful family connection</Text>
            <Text style={styles.feature}>🎯 Care beyond transactions</Text>
          </View>
        </View>

        {/* Login Link */}
        <TouchableOpacity 
          style={styles.loginButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginButtonText}>Already have an account? Sign in</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundAuth,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: theme.spacing.xxl,
    paddingTop: theme.spacing.massive,
    paddingBottom: theme.spacing.xxxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.huge,
  },
  title: {
    ...theme.typography.titleLarge,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '500',
    letterSpacing: 1,
  },
  roleSelection: {
    marginBottom: theme.spacing.xxxl,
  },
  sectionTitle: {
    ...theme.typography.subtitleLarge,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  roleCard: {
    ...commonStyles.cardElevated,
    marginBottom: theme.spacing.lg,
  },
  parentCard: {
    ...commonStyles.parentCard,
  },
  studentCard: {
    ...commonStyles.studentCard,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    ...commonStyles.iconContainer,
  },
  cardIcon: {
    fontSize: 28,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  cardSubtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  features: {
    ...commonStyles.featureCard,
    marginBottom: theme.spacing.xxl,
  },
  featuresTitle: {
    ...theme.typography.bodyLarge,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  featuresList: {
    gap: theme.spacing.sm,
  },
  feature: {
    ...theme.typography.bodySmall,
    color: theme.colors.textTertiary,
    textAlign: 'center',
  },
  loginButton: {
    ...commonStyles.linkButton,
  },
  loginButtonText: {
    ...commonStyles.linkButtonText,
  },
});