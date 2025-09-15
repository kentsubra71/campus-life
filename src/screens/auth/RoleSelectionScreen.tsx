import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../styles/theme';
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
  const insets = useSafeAreaInsets();
  
  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.hero}>
          <View style={styles.logoContainer}>
            {/* eslint-disable-next-line @typescript-eslint/no-require-imports */}
            <Image source={require('../../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.appName}>CampusLife</Text>
          <Text style={styles.tagline}>Stay close when you're far apart</Text>
        </View>

        {/* Role Selection */}
        <View style={styles.roleSection}>
          <Text style={styles.roleTitle}>Choose your role</Text>
          
          {/* Parent Option */}
          <TouchableOpacity 
            style={styles.roleOption}
            onPress={() => navigation.navigate('ParentRegister')}
          >
            <View style={styles.roleIndicator}>
              <View style={[styles.roleCircle, { backgroundColor: theme.colors.primary }]} />
            </View>
            <View style={styles.roleContent}>
              <View style={styles.roleTitleRow}>
                <Text style={styles.roleLabel}>I'm a Parent</Text>
                <View style={[styles.roleTag, { backgroundColor: '#E3F2FD' }]}>
                  <Text style={[styles.roleTagText, { color: theme.colors.primary }]}>Family Creator</Text>
                </View>
              </View>
              <Text style={styles.roleDescription}>Create a family account and invite your college student</Text>
            </View>
            <Text style={styles.roleArrow}>›</Text>
          </TouchableOpacity>

          {/* Student Option */}
          <TouchableOpacity 
            style={styles.roleOption}
            onPress={() => navigation.navigate('StudentRegister')}
          >
            <View style={styles.roleIndicator}>
              <View style={[styles.roleCircle, { backgroundColor: theme.colors.success }]} />
            </View>
            <View style={styles.roleContent}>
              <View style={styles.roleTitleRow}>
                <Text style={styles.roleLabel}>I'm a Student</Text>
                <View style={[styles.roleTag, { backgroundColor: '#E8F5E8' }]}>
                  <Text style={[styles.roleTagText, { color: theme.colors.success }]}>Family Member</Text>
                </View>
              </View>
              <Text style={styles.roleDescription}>Join your family's account with an invite code</Text>
            </View>
            <Text style={styles.roleArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Features */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>Why families love CampusLife</Text>
          
          <View style={styles.featuresList}>
            <View style={styles.feature}>
              <View style={[styles.featureDot, { backgroundColor: '#64B5F6' }]} />
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Wellness Connection</Text>
                <Text style={styles.featureText}>Track mood and wellness together</Text>
              </View>
            </View>
            
            <View style={styles.feature}>
              <View style={[styles.featureDot, { backgroundColor: '#81C784' }]} />
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Meaningful Support</Text>
                <Text style={styles.featureText}>Send love and help when needed</Text>
              </View>
            </View>
            
            <View style={styles.feature}>
              <View style={[styles.featureDot, { backgroundColor: '#FFB74D' }]} />
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Stay Connected</Text>
                <Text style={styles.featureText}>Bridge distance with care, not just money</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Sign In Link */}
        <TouchableOpacity 
          style={styles.signInLink}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.signInText}>Already have an account? Sign in</Text>
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
    paddingTop: 80,
    justifyContent: 'space-between',
  },
  
  // Hero Section
  hero: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E3F2FD',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  logo: {
    width: 40,
    height: 40,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  
  // Role Selection
  roleSection: {
    marginBottom: 40,
  },
  roleTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 24,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  roleIndicator: {
    marginRight: 12,
  },
  roleCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  roleContent: {
    flex: 1,
  },
  roleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  roleLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginRight: 8,
  },
  roleTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleTagText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  roleDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  roleArrow: {
    fontSize: 18,
    color: theme.colors.textTertiary,
    fontWeight: '300',
  },
  
  // Features
  featuresSection: {
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  featuresList: {
    gap: 4,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 12,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  featureText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  
  // Sign In Link
  signInLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  signInText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});