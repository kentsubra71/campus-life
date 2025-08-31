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

interface StudentRegisterScreenProps extends AuthScreenProps<'StudentRegister'> {}

export const StudentRegisterScreen: React.FC<StudentRegisterScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
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
            <Image source={require('../../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.title}>Join Your Family</Text>
          <Text style={styles.subtitle}>Connect with your family's CampusLife account</Text>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Need an invite code?</Text>
          <Text style={styles.infoText}>
            Ask your parent to create a family account first. They'll get an invite code to share with you.
          </Text>
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
            <TextInput
              style={[styles.input, errors.password ? styles.inputError : null]}
              placeholder="Create a secure password"
              placeholderTextColor={theme.colors.textTertiary}
              value={formData.password}
              onChangeText={(text) => setFormData({...formData, password: text})}
              secureTextEntry
            />
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={[styles.input, errors.confirmPassword ? styles.inputError : null]}
              placeholder="Confirm your password"
              placeholderTextColor={theme.colors.textTertiary}
              value={formData.confirmPassword}
              onChangeText={(text) => setFormData({...formData, confirmPassword: text})}
              secureTextEntry
            />
            {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
          </View>

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
              <View style={styles.benefitIcon}>
                <Text style={styles.benefitIconText}>T</Text>
              </View>
              <Text style={styles.benefitText}>Track your wellness journey</Text>
            </View>
            <View style={styles.benefit}>
              <View style={styles.benefitIcon}>
                <Text style={styles.benefitIconText}>S</Text>
              </View>
              <Text style={styles.benefitText}>Receive family support & encouragement</Text>
            </View>
            <View style={styles.benefit}>
              <View style={styles.benefitIcon}>
                <Text style={styles.benefitIconText}>H</Text>
              </View>
              <Text style={styles.benefitText}>Request help when you need it</Text>
            </View>
            <View style={styles.benefit}>
              <View style={styles.benefitIcon}>
                <Text style={styles.benefitIconText}>A</Text>
              </View>
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
    marginBottom: 32,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginBottom: 24,
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
    backgroundColor: theme.colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
  
  // Info Card
  infoCard: {
    backgroundColor: theme.colors.success,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 22,
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
  helpText: {
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
    shadowColor: theme.colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  joinButtonDisabled: {
    backgroundColor: theme.colors.textSecondary,
    shadowOpacity: 0,
    elevation: 0,
  },
  joinButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  
  // Benefits
  benefitsSection: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  benefitsList: {
    gap: 12,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  benefitIconText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
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
});