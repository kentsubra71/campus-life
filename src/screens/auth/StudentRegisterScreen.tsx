import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  Alert,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { AuthScreenProps } from '../../types/navigation';
import { theme } from '../../styles/theme';

interface StudentRegisterScreenProps extends AuthScreenProps<'StudentRegister'> {}

export const StudentRegisterScreen: React.FC<StudentRegisterScreenProps> = ({ navigation }) => {
  const { joinFamily, isLoading } = useAuthStore();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    inviteCode: '',
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.inviteCode.trim()) {
      newErrors.inviteCode = 'Family invite code is required';
    } else if (formData.inviteCode.length < 6) {
      newErrors.inviteCode = 'Invite code should be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    const result = await joinFamily(
      {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: 'student',
        inviteCode: formData.inviteCode,
      },
      formData.inviteCode
    );

    if (result.success) {
      Alert.alert(
        'Welcome to the Family!',
        'You\'ve successfully joined your family\'s CampusLife account. You can now track your wellness and stay connected with your family.',
        [
          { 
            text: 'Get Started', 
            onPress: () => {
              // Navigation will be handled automatically by auth state change
              // No need to manually reset navigation stack
            }
          }
        ]
      );
    } else {
      Alert.alert('Registration Failed', result.error || 'Please try again');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Join Your Family</Text>
        <Text style={styles.subtitle}>Connect with your family's CampusLife account</Text>
      </View>

      <View style={styles.inviteCard}>
        <Text style={styles.inviteTitle}>Need an invite code?</Text>
        <Text style={styles.inviteText}>
          Ask your parent to create a family account first. They'll receive an invite code to share with you.
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Family Invite Code</Text>
          <TextInput
            style={[styles.input, styles.inviteInput, errors.inviteCode ? styles.inputError : null]}
            placeholder="Enter your family's invite code"
            placeholderTextColor={theme.colors.textSecondary}
            value={formData.inviteCode}
            onChangeText={(text) => setFormData({...formData, inviteCode: text.toUpperCase()})}
            autoCapitalize="characters"
            maxLength={10}
          />
          {errors.inviteCode && <Text style={styles.errorText}>{errors.inviteCode}</Text>}
          <Text style={styles.helpText}>This was provided by your parent when they created the family account</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Your Name</Text>
          <TextInput
            style={[styles.input, errors.name ? styles.inputError : null]}
            placeholder="Enter your full name"
            placeholderTextColor={theme.colors.textSecondary}
            value={formData.name}
            onChangeText={(text) => setFormData({...formData, name: text})}
            autoCapitalize="words"
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={[styles.input, errors.email ? styles.inputError : null]}
            placeholder="your@email.com"
            placeholderTextColor={theme.colors.textSecondary}
            value={formData.email}
            onChangeText={(text) => setFormData({...formData, email: text})}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={[styles.input, errors.password ? styles.inputError : null]}
            placeholder="Create a secure password"
            placeholderTextColor={theme.colors.textSecondary}
            value={formData.password}
            onChangeText={(text) => setFormData({...formData, password: text})}
            secureTextEntry
          />
          {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={[styles.input, errors.confirmPassword ? styles.inputError : null]}
            placeholder="Confirm your password"
            placeholderTextColor={theme.colors.textSecondary}
            value={formData.confirmPassword}
            onChangeText={(text) => setFormData({...formData, confirmPassword: text})}
            secureTextEntry
          />
          {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
        </View>
      </View>

      <View style={styles.benefitsCard}>
        <Text style={styles.benefitsTitle}>What you'll get:</Text>
        <View style={styles.benefitsList}>
          <View style={styles.benefitItem}>
            <View style={styles.benefitBullet} />
            <Text style={styles.benefit}>Track your wellness journey</Text>
          </View>
          <View style={styles.benefitItem}>
            <View style={styles.benefitBullet} />
            <Text style={styles.benefit}>Receive family support & encouragement</Text>
          </View>
          <View style={styles.benefitItem}>
            <View style={styles.benefitBullet} />
            <Text style={styles.benefit}>Request help when you need it</Text>
          </View>
          <View style={styles.benefitItem}>
            <View style={styles.benefitBullet} />
            <Text style={styles.benefit}>Share your achievements</Text>
          </View>
          <View style={styles.benefitItem}>
            <View style={styles.benefitBullet} />
            <Text style={styles.benefit}>Occasional care boosts & surprises</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
        onPress={handleRegister}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.registerButtonText}>Join Family Account</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.loginLink}
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={styles.loginLinkText}>Already have an account? Sign In</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 24,
  },
  backButton: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  inviteCard: {
    backgroundColor: theme.colors.success,
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    ...theme.shadows.small,
  },
  inviteTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  inviteText: {
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 20,
    opacity: 0.9,
  },
  form: {
    gap: 20,
    marginBottom: 24,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  input: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: theme.colors.textPrimary,
    ...theme.shadows.small,
  },
  inviteInput: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 2,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  errorText: {
    fontSize: 12,
    color: theme.colors.error,
    marginTop: 4,
  },
  helpText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  benefitsCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.small,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },
  benefit: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    flex: 1,
  },
  registerButton: {
    backgroundColor: theme.colors.success,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    ...theme.shadows.medium,
  },
  registerButtonDisabled: {
    backgroundColor: theme.colors.textSecondary,
    opacity: 0.6,
  },
  registerButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  loginLinkText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});