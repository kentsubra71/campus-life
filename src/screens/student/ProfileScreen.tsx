import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';
import { useWellnessStore } from '../../stores/wellnessStore';
import { useRewardsStore } from '../../stores/rewardsStore';
import { showMessage } from 'react-native-flash-message';
import { theme } from '../../styles/theme';
import { testPayPalMeHandle, isValidPayPalHandle } from '../../lib/paypalDeepLink';
// Removed supabase import as it's not used in this version

interface ProfileScreenProps {
  navigation: any;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { user, logout } = useAuthStore();
  const { stats } = useWellnessStore();
  const { level, totalEarned } = useRewardsStore();
  
  const [profile, setProfile] = useState({
    fullName: '',
    email: user?.email || '',
    phone: '',
    emergencyContact: '',
    school: '',
    major: '',
    graduationYear: '',
    paypalEmail: '',
    paypalMeHandle: '',
  });
  
  const [preferences, setPreferences] = useState({
    notifications: true,
    weeklyReports: true,
    parentUpdates: true,
    dataSharing: false,
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      // Profile data is already available from user object
      const data = user;
      const error = null;
      
      if (data) {
        setProfile({
          fullName: user?.name || '',
          email: user?.email || '',
          phone: '',
          emergencyContact: '',
          school: '',
          major: '',
          graduationYear: '',
          paypalEmail: '',
          paypalMeHandle: user?.paypal_me_handle || '',
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const saveProfile = async () => {
    if (!user) return;

    // Validate PayPal.Me handle if provided
    if (profile.paypalMeHandle && !isValidPayPalHandle(profile.paypalMeHandle)) {
      Alert.alert('Invalid PayPal Handle', 'Please enter a valid PayPal.Me handle (3-20 characters, start/end with letters/numbers, can contain letters, numbers, hyphens, dots, underscores)');
      return;
    }

    // Check if PayPal handle is being changed - require password confirmation
    const isPayPalChanging = profile.paypalMeHandle !== (user?.paypal_me_handle || '');
    if (isPayPalChanging && profile.paypalMeHandle) {
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.prompt(
          'Confirm PayPal Change',
          'For security, please enter your password to change your PayPal.Me handle:',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            {
              text: 'Confirm',
              onPress: (password) => {
                if (password && password.length >= 6) {
                  resolve(true);
                } else {
                  Alert.alert('Invalid Password', 'Password must be at least 6 characters.');
                  resolve(false);
                }
              }
            }
          ],
          'secure-text'
        );
      });

      if (!confirmed) return;
    }

    setLoading(true);
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');

      const updateData: any = {
        paypal_me_handle: profile.paypalMeHandle || null,
        updated_at: new Date()
      };

      await updateDoc(doc(db, 'users', user.id), updateData);

      showMessage({
        message: 'Success',
        description: profile.paypalMeHandle
          ? 'PayPal.Me handle updated! Family can now send you money instantly.'
          : 'Profile updated successfully',
        type: 'success',
        backgroundColor: theme.colors.backgroundCard,
        color: theme.colors.textPrimary,
      });
      setIsEditing(false);

    } catch (error: any) {
      console.error('Error saving profile:', error);
      showMessage({
        message: 'Error',
        description: error.message || 'Failed to update profile',
        type: 'danger',
        backgroundColor: theme.colors.backgroundCard,
        color: theme.colors.textPrimary,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      const error = null;
      if (error) {
        showMessage({
          message: 'Error',
          description: 'Failed to sign out',
          type: 'danger',
          backgroundColor: theme.colors.backgroundCard,
          color: theme.colors.textPrimary,
        });
      } else {
        // User is already logged out via logout()
      }
    } catch (error) {
      showMessage({
        message: 'Error',
        description: 'Failed to sign out',
        type: 'danger',
        backgroundColor: theme.colors.backgroundCard,
        color: theme.colors.textPrimary,
      });
    }
  };

  const confirmSignOut = () => {
    showMessage({
      message: 'Sign Out',
      description: 'Are you sure you want to sign out?',
      type: 'info',
      backgroundColor: theme.colors.backgroundCard,
      color: theme.colors.textPrimary,
      duration: 4000,
    });
    // For now, just sign out directly since we can't customize the action buttons
    setTimeout(() => {
      handleSignOut();
    }, 2000);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This action cannot be undone.\n\nAre you absolutely sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Account', 
          style: 'destructive',
          onPress: () => confirmDeleteAccount()
        }
      ]
    );
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Final Confirmation',
      'This will delete all your wellness data, messages, rewards, and payment history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Everything', 
          style: 'destructive',
          onPress: () => performDeleteAccount()
        }
      ]
    );
  };

  const performDeleteAccount = async () => {
    if (!user) return;

    try {
      // Show loading message
      showMessage({
        message: 'Deleting Account',
        description: 'Please wait while we securely delete your account and data...',
        type: 'info',
        backgroundColor: theme.colors.backgroundCard,
        color: theme.colors.textPrimary,
        duration: 5000,
      });

      // Use the secure Cloud Function for account deletion
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('../../lib/firebase');

      const deleteAccountFunction = httpsCallable(functions, 'deleteAccount');
      const result = await deleteAccountFunction({ confirmationText: 'DELETE' });

      console.log('✅ Account deletion completed:', result.data);

      // Logout user and navigate to welcome screen
      logout();

      showMessage({
        message: 'Account Deleted',
        description: 'Your account and all data have been permanently deleted.',
        type: 'success',
        backgroundColor: theme.colors.success,
        color: theme.colors.backgroundCard,
        duration: 3000,
      });

      // Navigate to welcome screen after a brief delay
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'RoleSelection' }],
        });
      }, 1500);
    } catch (error: any) {
      console.error('Error deleting account:', error);

      let errorMessage = 'Failed to delete account. Please try again.';

      if (error.code === 'functions/unauthenticated') {
        errorMessage = 'You must be signed in to delete your account. Please sign in again.';
      } else if (error.code === 'functions/invalid-argument') {
        errorMessage = 'Invalid deletion request. Please try again.';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'For security reasons, you need to sign in again before deleting your account. Please sign out and sign back in, then try again.';
      }

      showMessage({
        message: 'Error',
        description: errorMessage,
        type: 'danger',
        backgroundColor: theme.colors.backgroundCard,
        color: theme.colors.textPrimary,
        duration: 5000,
      });
    }
  };

  const renderProfileField = (
    label: string,
    value: string,
    key: keyof typeof profile,
    multiline = false
  ) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {isEditing ? (
        <TextInput
          style={[styles.fieldInput, multiline && styles.multilineInput]}
          value={value}
          onChangeText={(text) => setProfile({ ...profile, [key]: text })}
          placeholder={`Enter ${label.toLowerCase()}`}
          placeholderTextColor={theme.colors.textTertiary}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
      ) : (
        <Text style={styles.fieldValue}>{value || 'Not set'}</Text>
      )}
    </View>
  );

  const renderPayPalMeField = () => {
    const handleValidation = testPayPalMeHandle(profile.paypalMeHandle);

    return (
      <View style={styles.fieldContainer}>
        <View style={styles.paypalHeaderContainer}>
          <View style={styles.paypalHeaderText}>
            <Text style={styles.fieldLabel}>PayPal.Me Handle</Text>
            <Text style={styles.fieldDescription}>
              Your PayPal.Me username (e.g., "johnsmith" for paypal.me/johnsmith)
            </Text>
          </View>
          {!isEditing && !profile.paypalMeHandle && (
            <TouchableOpacity
              style={styles.setupPaypalButton}
              onPress={() => setIsEditing(true)}
            >
              <Text style={styles.setupPaypalButtonText}>Set Up PayPal</Text>
            </TouchableOpacity>
          )}
        </View>

        {isEditing ? (
          <View>
            <View style={styles.paypalInputContainer}>
              <Text style={styles.paypalPrefix}>paypal.me/</Text>
              <TextInput
                style={styles.paypalInput}
                value={profile.paypalMeHandle}
                onChangeText={(text) => {
                  // Remove any @ symbols or paypal.me/ prefixes
                  const cleanText = text.replace(/^@/, '').replace(/^(https?:\/\/)?(www\.)?paypal\.com\/paypalme\//, '');
                  setProfile({ ...profile, paypalMeHandle: cleanText.toLowerCase() });
                }}
                placeholder="yourhandle"
                placeholderTextColor={theme.colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {profile.paypalMeHandle && (
              <View style={[
                styles.validationContainer,
                handleValidation.valid ? styles.validationSuccess : styles.validationError
              ]}>
                <Text style={[
                  styles.validationText,
                  handleValidation.valid ? styles.validationTextSuccess : styles.validationTextError
                ]}>
                  {handleValidation.valid ? '✓ Valid handle' : handleValidation.error}
                </Text>
                {handleValidation.valid && handleValidation.exampleUrl && (
                  <Text style={styles.exampleUrl}>
                    Example: {handleValidation.exampleUrl}
                  </Text>
                )}
              </View>
            )}
          </View>
        ) : (
          <View>
            <Text style={styles.fieldValue}>
              {profile.paypalMeHandle ? `paypal.me/${profile.paypalMeHandle}` : 'Not set'}
            </Text>
            {!profile.paypalMeHandle && (
              <View style={styles.setupPromptContainer}>
                <Text style={styles.setupPrompt}>
                  💰 Set up your PayPal.Me handle to receive instant payments from family
                </Text>
                <Text style={styles.setupPromptSecondary}>
                  Tap "Set Up PayPal" above or use the Edit button to get started
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderPreferenceSwitch = (
    label: string,
    description: string,
    key: keyof typeof preferences
  ) => (
    <View style={styles.preferenceContainer}>
      <View style={styles.preferenceText}>
        <Text style={styles.preferenceLabel}>{label}</Text>
        <Text style={styles.preferenceDescription}>{description}</Text>
      </View>
      <Switch
        value={preferences[key]}
        onValueChange={(value) => setPreferences({ ...preferences, [key]: value })}
        trackColor={{ false: theme.colors.backgroundTertiary, true: theme.colors.primary }}
        thumbColor={preferences[key] ? theme.colors.backgroundSecondary : theme.colors.textTertiary}
      />
    </View>
  );

  const getMembershipDuration = () => {
    if (!user?.createdAt) return 'New member';
    
    const joinDate = new Date(user.createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - joinDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) return `${diffDays} days`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months`;
    return `${Math.floor(diffDays / 365)} years`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile & Settings</Text>
          <Text style={styles.subtitle}>Manage your account and preferences</Text>
        </View>

        {/* Profile Overview Card */}
        <View style={styles.overviewCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profile.fullName ? profile.fullName.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
            <View style={styles.overviewInfo}>
              <Text style={styles.overviewName}>
                {profile.fullName || 'User'}
              </Text>
              <Text style={styles.overviewEmail}>{profile.email}</Text>
              <Text style={styles.overviewStatus}>
                {user?.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : 'Student'} • Level {level}
              </Text>
            </View>
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalEntries}</Text>
              <Text style={styles.statLabel}>Log Entries</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.currentStreak}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>${totalEarned}</Text>
              <Text style={styles.statLabel}>Total Earned</Text>
            </View>
          </View>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <TouchableOpacity
              onPress={() => isEditing ? saveProfile() : setIsEditing(true)}
              disabled={loading}
              style={styles.editButton}
            >
              <Text style={styles.editButtonText}>
                {loading ? 'Saving...' : isEditing ? 'Save' : 'Edit'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.fieldsContainer}>
            {renderProfileField('Full Name', profile.fullName, 'fullName')}
            {renderProfileField('Email', profile.email, 'email')}
            {renderProfileField('Phone', profile.phone, 'phone')}
            {renderProfileField('Emergency Contact', profile.emergencyContact, 'emergencyContact')}
          </View>
        </View>

        {/* Academic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Academic Information</Text>
          <View style={styles.fieldsContainer}>
            {renderProfileField('School', profile.school, 'school')}
            {renderProfileField('Major', profile.major, 'major')}
            {renderProfileField('Graduation Year', profile.graduationYear, 'graduationYear')}
          </View>
        </View>

        {/* Payment Setup */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Setup</Text>
          <Text style={styles.sectionSubtitle}>
            Set up your PayPal.Me handle so family can send you money instantly
          </Text>
          <View style={styles.fieldsContainer}>
            {renderPayPalMeField()}
            {renderProfileField('PayPal Email (Backup)', profile.paypalEmail, 'paypalEmail')}
          </View>
        </View>

        {/* Account Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Details</Text>
          <View style={styles.accountDetail}>
            <Text style={styles.accountLabel}>Member Since</Text>
            <Text style={styles.accountValue}>{getMembershipDuration()}</Text>
          </View>
          <View style={styles.accountDetail}>
            <Text style={styles.accountLabel}>Account Type</Text>
            <Text style={styles.accountValue}>
              {user?.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : 'Student'}
            </Text>
          </View>
          <View style={styles.accountDetail}>
            <Text style={styles.accountLabel}>Current Level</Text>
            <Text style={styles.accountValue}>Level {level}</Text>
          </View>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.preferencesContainer}>
            {renderPreferenceSwitch(
              'Push Notifications',
              'Receive wellness reminders and updates',
              'notifications'
            )}
            {renderPreferenceSwitch(
              'Weekly Reports',
              'Get weekly wellness summary reports',
              'weeklyReports'
            )}
            {renderPreferenceSwitch(
              'Parent Updates',
              'Share progress updates with parents',
              'parentUpdates'
            )}
            {renderPreferenceSwitch(
              'Data Sharing',
              'Share anonymized data for research',
              'dataSharing'
            )}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Export My Data</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Privacy Policy</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Terms of Service</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.signOutButton]}
            onPress={confirmSignOut}
          >
            <Text style={[styles.actionButtonText, styles.signOutText]}>Sign Out</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteAccountButton]}
            onPress={handleDeleteAccount}
          >
            <Text style={[styles.actionButtonText, styles.deleteAccountText]}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 30,
    paddingTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  overviewCard: {
    backgroundColor: theme.colors.backgroundCard,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
  },
  overviewInfo: {
    flex: 1,
  },
  overviewName: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  overviewEmail: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  overviewStatus: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  editButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  fieldsContainer: {
    backgroundColor: theme.colors.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  fieldValue: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    paddingVertical: 8,
  },
  fieldInput: {
    backgroundColor: theme.colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  fieldDescription: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  paypalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  paypalPrefix: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  paypalInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginLeft: 4,
  },
  validationContainer: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
  },
  validationSuccess: {
    backgroundColor: '#f0fdf4',
    borderColor: '#d1fae5',
    borderWidth: 1,
  },
  validationError: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
  },
  validationText: {
    fontSize: 12,
    fontWeight: '600',
  },
  validationTextSuccess: {
    color: '#059669',
  },
  validationTextError: {
    color: '#dc2626',
  },
  exampleUrl: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  paypalHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  paypalHeaderText: {
    flex: 1,
    marginRight: 12,
  },
  setupPaypalButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  setupPaypalButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  setupPromptContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0ea5e9',
  },
  setupPrompt: {
    fontSize: 14,
    color: '#0c4a6e',
    marginBottom: 4,
    fontWeight: '600',
  },
  setupPromptSecondary: {
    fontSize: 12,
    color: '#075985',
    fontStyle: 'italic',
  },
  accountDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundCard,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  accountLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  accountValue: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  preferencesContainer: {
    backgroundColor: theme.colors.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
  },
  preferenceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  preferenceText: {
    flex: 1,
    marginRight: 16,
  },
  preferenceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  actionsSection: {
    marginBottom: 40,
  },
  actionButton: {
    backgroundColor: theme.colors.backgroundCard,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  signOutButton: {
    borderColor: theme.colors.error,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  signOutText: {
    color: theme.colors.error,
  },
  deleteAccountButton: {
    borderColor: '#dc2626',
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  deleteAccountText: {
    color: '#dc2626',
    fontWeight: '700',
  },
}); 