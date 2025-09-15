import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';
import { AuthScreenProps } from '../../types/navigation';
import { theme } from '../../styles/theme';

type StudentRegisterScreenProps = AuthScreenProps<'StudentRegister'>;

export const StudentRegisterScreen: React.FC<StudentRegisterScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { joinFamily, isLoading } = useAuthStore();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    inviteCode: '',
    paypalMeHandle: '',
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

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
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.inviteCode.trim()) {
      newErrors.inviteCode = 'Family invite code is required';
    } else if (formData.inviteCode.length < 6) {
      newErrors.inviteCode = 'Invite code should be at least 6 characters';
    }

    if (!acceptedPrivacy) {
      newErrors.privacy = 'You must accept the Privacy Policy to continue';
    }

    if (!formData.paypalMeHandle.trim()) {
      newErrors.paypalMeHandle = 'PayPal.Me handle is required for receiving payments';
    } else if (!/^[a-zA-Z0-9._-]+$/.test(formData.paypalMeHandle)) {
      newErrors.paypalMeHandle = 'PayPal.Me handle can only contain letters, numbers, dots, dashes, and underscores';
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
        paypal_me_handle: formData.paypalMeHandle,
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
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          
          <View style={styles.logoContainer}>
            {/* eslint-disable-next-line @typescript-eslint/no-require-imports */}
            <Image source={require('../../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.title}>Join Your Family</Text>
          <Text style={styles.subtitle}>Connect with your family's CampusLife account</Text>
        </View>

        {/* Help Section */}
        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>Need an invite code?</Text>
          <Text style={styles.helpText}>Ask your parent to create a family account first. They'll get an invite code to share with you.</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Family Invite Code</Text>
            <TextInput
              style={[styles.input, styles.inviteInput, errors.inviteCode ? styles.inputError : null]}
              placeholder="FAMILY CODE"
              placeholderTextColor={theme.colors.textTertiary}
              value={formData.inviteCode}
              onChangeText={(text) => setFormData({...formData, inviteCode: text.toUpperCase()})}
              autoCapitalize="characters"
              maxLength={10}
            />
            {errors.inviteCode && <Text style={styles.errorText}>{errors.inviteCode}</Text>}
            <Text style={styles.helpText}>This was provided by your parent</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Your Name</Text>
            <TextInput
              style={[styles.input, errors.name ? styles.inputError : null]}
              placeholder="Enter your full name"
              placeholderTextColor={theme.colors.textTertiary}
              value={formData.name}
              onChangeText={(text) => setFormData({...formData, name: text})}
              autoCapitalize="words"
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, errors.email ? styles.inputError : null]}
              placeholder="your@email.com"
              placeholderTextColor={theme.colors.textTertiary}
              value={formData.email}
              onChangeText={(text) => setFormData({...formData, email: text})}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.passwordInput, errors.password ? styles.inputError : null]}
                placeholder="Create a secure password"
                placeholderTextColor={theme.colors.textTertiary}
                value={formData.password}
                onChangeText={(text) => setFormData({...formData, password: text})}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.passwordInput, errors.confirmPassword ? styles.inputError : null]}
                placeholder="Confirm your password"
                placeholderTextColor={theme.colors.textTertiary}
                value={formData.confirmPassword}
                onChangeText={(text) => setFormData({...formData, confirmPassword: text})}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Text style={styles.eyeIcon}>{showConfirmPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
            {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>PayPal.Me Handle</Text>
            <View style={styles.paypalContainer}>
              <Text style={styles.paypalPrefix}>paypal.me/</Text>
              <TextInput
                style={[styles.paypalInput, errors.paypalMeHandle ? styles.inputError : null]}
                placeholder="yourhandle"
                placeholderTextColor={theme.colors.textTertiary}
                value={formData.paypalMeHandle}
                onChangeText={(text) => setFormData({...formData, paypalMeHandle: text})}
                autoCapitalize="none"
              />
            </View>
            {errors.paypalMeHandle && <Text style={styles.errorText}>{errors.paypalMeHandle}</Text>}
            <Text style={styles.helpTextSecondary}>Your PayPal.Me handle for receiving payments from family</Text>
          </View>

          {/* Privacy Policy Checkbox */}
          <View style={styles.privacyContainer}>
            <TouchableOpacity 
              style={styles.checkboxContainer}
              onPress={() => setAcceptedPrivacy(!acceptedPrivacy)}
            >
              <View style={[styles.checkbox, acceptedPrivacy && styles.checkboxChecked]}>
                {acceptedPrivacy && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
            <View style={styles.privacyTextContainer}>
              <Text style={styles.privacyText}>
                I agree to the{' '}
                <Text 
                  style={styles.privacyLink}
                  onPress={() => navigation.navigate('PrivacyPolicy')}
                >
                  Privacy Policy
                </Text>
                {' '}and Terms of Service
              </Text>
            </View>
          </View>
          {errors.privacy && <Text style={styles.errorText}>{errors.privacy}</Text>}

          <TouchableOpacity 
            style={[styles.joinButton, isLoading && styles.joinButtonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.joinButtonText}>Join Family Account</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Benefits */}
        <View style={styles.benefitsSection}>
          <Text style={styles.benefitsTitle}>What you'll get:</Text>
          <View style={styles.benefitsList}>
            <View style={styles.benefit}>
              <View style={[styles.benefitDot, { backgroundColor: '#81C784' }]} />
              <Text style={styles.benefitText}>Track your wellness journey</Text>
            </View>
            <View style={styles.benefit}>
              <View style={[styles.benefitDot, { backgroundColor: '#64B5F6' }]} />
              <Text style={styles.benefitText}>Receive family support & encouragement</Text>
            </View>
            <View style={styles.benefit}>
              <View style={[styles.benefitDot, { backgroundColor: '#FFB74D' }]} />
              <Text style={styles.benefitText}>Request help when you need it</Text>
            </View>
            <View style={styles.benefit}>
              <View style={[styles.benefitDot, { backgroundColor: '#F48FB1' }]} />
              <Text style={styles.benefitText}>Share your achievements</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.signInButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.signInText}>
              Already have an account? <Text style={styles.signInLink}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  
  // Header
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8F5E8',
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
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  
  // Help Section
  helpSection: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    marginBottom: 24,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: 6,
  },
  helpText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  
  // Form
  form: {
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontWeight: '500',
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontWeight: '500',
    paddingRight: 50, // Make room for the eye button
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    padding: 4,
  },
  eyeIcon: {
    fontSize: 16,
  },
  privacyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  checkboxContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.backgroundSecondary,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkmark: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '700',
  },
  privacyTextContainer: {
    flex: 1,
  },
  privacyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  privacyLink: {
    color: theme.colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  inviteInput: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 2,
    backgroundColor: theme.colors.backgroundTertiary,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.error,
    marginTop: 6,
    fontWeight: '500',
  },
  helpTextSecondary: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    marginTop: 6,
  },
  joinButton: {
    backgroundColor: theme.colors.success,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  joinButtonDisabled: {
    backgroundColor: theme.colors.textSecondary,
  },
  joinButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  
  // Benefits
  benefitsSection: {
    marginBottom: 24,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  benefitsList: {
    gap: 4,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  benefitDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 12,
  },
  benefitText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  
  // Footer
  footer: {
    alignItems: 'center',
  },
  signInButton: {
    paddingVertical: 12,
  },
  signInText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  signInLink: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  paypalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  paypalPrefix: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginRight: 4,
  },
  paypalInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontWeight: '500',
    paddingVertical: 0,
  },
});