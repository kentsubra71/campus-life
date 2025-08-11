import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { AuthScreenProps } from '../../types/navigation';
import { verifyPasswordResetToken, resetPasswordWithToken } from '../../lib/passwordReset';

export const ResetPasswordScreen: React.FC<AuthScreenProps<'ResetPassword'>> = ({ navigation, route }) => {
  const { token } = route.params;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    verifyToken();
  }, []);

  const verifyToken = async () => {
    try {
      const result = await verifyPasswordResetToken(token);
      if (result.valid) {
        setTokenValid(true);
        setUserEmail(result.email || '');
      } else {
        Alert.alert(
          'Invalid Link',
          'This password reset link is invalid or has expired. Please request a new one.',
          [{ text: 'OK', onPress: () => navigation.navigate('ForgotPassword') }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'Unable to verify reset link. Please try again.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/(?=.*[a-z])/.test(pwd)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/(?=.*[A-Z])/.test(pwd)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/(?=.*\d)/.test(pwd)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      Alert.alert('Invalid Password', passwordError);
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const result = await resetPasswordWithToken(token, password);
      
      if (result.success) {
        Alert.alert(
          'Password Reset Successfully',
          'Your password has been reset. You can now log in with your new password.',
          [
            {
              text: 'Go to Login',
              onPress: () => navigation.navigate('Login')
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to reset password');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Verifying reset link...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!tokenValid) {
    return null; // Alert will show and redirect
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <View style={styles.headerContainer}>
            <Text style={styles.title}>Create New Password</Text>
            <Text style={styles.subtitle}>
              Reset password for {userEmail}
            </Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>New Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter new password"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                placeholderTextColor="#9ca3af"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <View style={styles.requirementsContainer}>
              <Text style={styles.requirementsTitle}>Password Requirements:</Text>
              <Text style={[styles.requirement, password.length >= 8 && styles.requirementMet]}>
                • At least 8 characters
              </Text>
              <Text style={[styles.requirement, /(?=.*[a-z])/.test(password) && styles.requirementMet]}>
                • One lowercase letter
              </Text>
              <Text style={[styles.requirement, /(?=.*[A-Z])/.test(password) && styles.requirementMet]}>
                • One uppercase letter
              </Text>
              <Text style={[styles.requirement, /(?=.*\d)/.test(password) && styles.requirementMet]}>
                • One number
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.resetButton, isLoading && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Reset Password</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.7}
            >
              <Text style={styles.backButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  keyboardContainer: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 16,
    marginTop: 16,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#f9fafb',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
  },
  formContainer: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#d1d5db',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    fontSize: 16,
    color: '#f9fafb',
    borderWidth: 1,
    borderColor: '#374151',
  },
  requirementsContainer: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#374151',
  },
  requirementsTitle: {
    color: '#d1d5db',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  requirement: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 4,
  },
  requirementMet: {
    color: '#10b981',
  },
  resetButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    backgroundColor: '#4b5563',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '500',
  },
});