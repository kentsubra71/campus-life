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
            <Image source={require('../../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.appName}>CampusLife</Text>
          <Text style={styles.tagline}>Stay close when you're far apart</Text>
        </View>

        {/* Role Cards */}
        <View style={styles.roleSection}>
          <Text style={styles.roleTitle}>Choose your role</Text>
          
          {/* Parent Card */}
          <TouchableOpacity 
            style={[styles.roleCard, styles.parentCard]}
            onPress={() => navigation.navigate('ParentRegister')}
          >
            <View style={styles.cardIcon}>
              <View style={styles.parentIconBackground}>
                <Text style={styles.cardIconText}>P</Text>
              </View>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>I'm a Parent</Text>
              <Text style={styles.cardDescription}>
                Create a family account and invite your college student
              </Text>
            </View>
            <View style={styles.cardArrow}>
              <Text style={styles.arrowText}>→</Text>
            </View>
          </TouchableOpacity>

          {/* Student Card */}
          <TouchableOpacity 
            style={[styles.roleCard, styles.studentCard]}
            onPress={() => navigation.navigate('StudentRegister')}
          >
            <View style={styles.cardIcon}>
              <View style={styles.studentIconBackground}>
                <Text style={styles.cardIconText}>S</Text>
              </View>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>I'm a Student</Text>
              <Text style={styles.cardDescription}>
                Join your family's account with an invite code
              </Text>
            </View>
            <View style={styles.cardArrow}>
              <Text style={styles.arrowText}>→</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Features Preview */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>Why families love CampusLife</Text>
          
          <View style={styles.featuresList}>
            <View style={styles.feature}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureIconText}>W</Text>
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Wellness Connection</Text>
                <Text style={styles.featureText}>Track mood and wellness together</Text>
              </View>
            </View>
            
            <View style={styles.feature}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureIconText}>S</Text>
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Meaningful Support</Text>
                <Text style={styles.featureText}>Send love and help when needed</Text>
              </View>
            </View>
            
            <View style={styles.feature}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureIconText}>C</Text>
              </View>
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
    paddingTop: 60,
  },
  
  // Hero Section
  hero: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  logo: {
    width: 48,
    height: 48,
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
  roleCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  parentCard: {
    backgroundColor: theme.colors.backgroundSecondary,
  },
  studentCard: {
    backgroundColor: theme.colors.backgroundSecondary,
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  parentIconBackground: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentIconBackground: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  cardArrow: {
    marginLeft: 12,
  },
  arrowText: {
    fontSize: 24,
    color: theme.colors.textTertiary,
    fontWeight: '300',
  },
  
  // Features
  featuresSection: {
    marginBottom: 32,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 24,
  },
  featuresList: {
    gap: 20,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureIconText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  featureText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  
  // Sign In Link
  signInLink: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  signInText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});