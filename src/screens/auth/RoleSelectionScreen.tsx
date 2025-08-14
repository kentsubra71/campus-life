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
        {/* Modern Header */}
        <View style={styles.header}>
          <Text style={styles.title}>CampusLife</Text>
          <Text style={styles.subtitle}>Connect • Care • Thrive</Text>
        </View>

        {/* Get Started Section */}
        <View style={styles.getStartedSection}>
          <Text style={styles.sectionTitle}>Get Started</Text>
          
          {/* Parent Action */}
          <TouchableOpacity 
            style={styles.actionItem}
            onPress={() => navigation.navigate('ParentRegister')}
          >
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Parent</Text>
              <Text style={styles.actionSubtitle}>Create family account</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
          
          {/* Student Action */}
          <TouchableOpacity 
            style={styles.actionItem}
            onPress={() => navigation.navigate('StudentRegister')}
          >
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Student</Text>
              <Text style={styles.actionSubtitle}>Join with invite code</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>What makes us different</Text>
          <View style={styles.featuresContainer}>
            <View style={styles.featureItem}>
              <View style={styles.featureBullet} />
              <Text style={styles.feature}>Wellness tracking & support</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureBullet} />
              <Text style={styles.feature}>Meaningful family connection</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureBullet} />
              <Text style={styles.feature}>Care beyond transactions</Text>
            </View>
          </View>
        </View>

        {/* Login Link */}
        <TouchableOpacity 
          style={styles.loginAction}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginActionText}>Already have an account? Sign in</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  
  // Modern Header
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '500',
    letterSpacing: 1,
  },
  
  // Get Started Section
  getStartedSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  
  // Action Items - Both Parent and Student (Equal treatment)
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 1,
  },
  actionSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  actionArrow: {
    fontSize: 18,
    color: theme.colors.textTertiary,
    fontWeight: '300',
  },
  
  // Features Section (With subtle outline container)
  featuresSection: {
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  featuresContainer: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },
  feature: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  
  // Login Action
  loginAction: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  loginActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
});