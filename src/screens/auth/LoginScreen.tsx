import React, { useState } from 'react';
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
} from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { AuthScreenProps } from '../../types/navigation';
import { theme } from '../../styles/theme';
import { commonStyles } from '../../styles/components';

interface LoginScreenProps extends AuthScreenProps<'Login'> {
  onNavigateToRegister?: () => void;
  onLoginSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation, onNavigateToRegister, onLoginSuccess }) => {
  const { login, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const result = await login(email, password);

    if (result.success) {
      // Use callback if provided, otherwise handle navigation directly
      if (onLoginSuccess) {
        onLoginSuccess();
      } else {
        // Navigation will be handled automatically by auth state change
        // No need to manually reset navigation stack
      }
    } else {
      Alert.alert('Login Failed', result.error || 'Please try again');
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <View style={styles.headerContainer}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue your wellness journey</Text>
          </View>

          <View style={styles.formContainer}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={theme.colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={theme.colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={() => navigation.navigate('ForgotPassword')}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => onNavigateToRegister ? onNavigateToRegister() : navigation.navigate('RoleSelection')}
              activeOpacity={0.7}
            >
              <Text style={styles.linkText}>
                Don't have an account? <Text style={styles.linkTextBold}>Sign up</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...commonStyles.container,
  },
  keyboardContainer: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    ...theme.layout.screenPadding,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.huge + theme.spacing.sm,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    letterSpacing: -1,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  formContainer: {
    width: '100%',
  },
  input: {
    ...commonStyles.input,
    marginBottom: theme.spacing.xl,
  },
  loginButton: {
    ...commonStyles.button,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xxxl,
    shadowColor: theme.colors.primary,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.textSecondary,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    ...commonStyles.buttonText,
  },
  linkButton: {
    ...commonStyles.linkButton,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  linkTextBold: {
    fontWeight: '600',
    color: theme.colors.primary,
  },
  forgotPasswordButton: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  forgotPasswordText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
}); 