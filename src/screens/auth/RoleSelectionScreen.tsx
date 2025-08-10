import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface RoleSelectionScreenProps {
  navigation: any;
}

export const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to CampusLife</Text>
        <Text style={styles.subtitle}>Stay close when you're far apart</Text>
        
        <View style={styles.descriptionCard}>
          <Text style={styles.descriptionTitle}>Choose your role to get started</Text>
          <Text style={styles.description}>
            CampusLife connects families through wellness tracking, support messages, 
            and meaningful care - not just transactions.
          </Text>
        </View>

        <View style={styles.roleCards}>
          {/* Parent Card */}
          <TouchableOpacity 
            style={[styles.roleCard, styles.parentCard]}
            onPress={() => navigation.navigate('ParentRegister')}
          >
            <Text style={styles.roleEmoji}>👨‍👩‍👧‍👦</Text>
            <Text style={styles.roleTitle}>I'm a Parent</Text>
            <Text style={styles.roleDescription}>
              Create a family account and get an invite code for your college student
            </Text>
            <View style={styles.roleFeatures}>
              <Text style={styles.roleFeature}>• Send love and support</Text>
              <Text style={styles.roleFeature}>• Monitor wellness trends</Text>
              <Text style={styles.roleFeature}>• Celebrate achievements</Text>
              <Text style={styles.roleFeature}>• Respond when help is needed</Text>
            </View>
          </TouchableOpacity>

          {/* Student Card */}
          <TouchableOpacity 
            style={[styles.roleCard, styles.studentCard]}
            onPress={() => navigation.navigate('StudentRegister')}
          >
            <Text style={styles.roleEmoji}>🎓</Text>
            <Text style={styles.roleTitle}>I'm a Student</Text>
            <Text style={styles.roleDescription}>
              Join your family's account using the invite code they created
            </Text>
            <View style={styles.roleFeatures}>
              <Text style={styles.roleFeature}>• Track your wellness journey</Text>
              <Text style={styles.roleFeature}>• Receive family support</Text>
              <Text style={styles.roleFeature}>• Request help when needed</Text>
              <Text style={styles.roleFeature}>• Share your progress</Text>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.loginButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginButtonText}>Already have an account? Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#f9fafb',
    textAlign: 'center',
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 32,
    fontStyle: 'italic',
  },
  descriptionCard: {
    backgroundColor: '#1f2937',
    padding: 20,
    borderRadius: 12,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#374151',
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#d1d5db',
    lineHeight: 20,
    textAlign: 'center',
  },
  roleCards: {
    gap: 20,
    marginBottom: 32,
  },
  roleCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  parentCard: {
    backgroundColor: '#1e40af',
    borderColor: '#3b82f6',
  },
  studentCard: {
    backgroundColor: '#059669',
    borderColor: '#10b981',
  },
  roleEmoji: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 16,
  },
  roleTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
  },
  roleDescription: {
    fontSize: 14,
    color: '#e5e7eb',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  roleFeatures: {
    gap: 6,
  },
  roleFeature: {
    fontSize: 12,
    color: '#e5e7eb',
    lineHeight: 16,
  },
  loginButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  loginButtonText: {
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});