import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

interface RoleSelectionScreenProps {
  navigation: any;
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
    backgroundColor: '#0f0f23',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
    paddingBottom: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#a855f7',
    fontWeight: '500',
    letterSpacing: 1,
  },
  roleSelection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  roleCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2d2d44',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  parentCard: {
    backgroundColor: '#1e3a8a',
    borderColor: '#3b82f6',
  },
  studentCard: {
    backgroundColor: '#166534',
    borderColor: '#22c55e',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
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
    color: '#ffffff',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  features: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  featuresList: {
    gap: 8,
  },
  feature: {
    fontSize: 14,
    color: '#e2e8f0',
    textAlign: 'center',
    fontWeight: '500',
  },
  loginButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  loginButtonText: {
    fontSize: 16,
    color: '#a855f7',
    fontWeight: '600',
  },
});