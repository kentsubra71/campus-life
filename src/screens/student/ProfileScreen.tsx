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
} from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { useWellnessStore } from '../../stores/wellnessStore';
import { useRewardsStore } from '../../stores/rewardsStore';
import { showMessage } from 'react-native-flash-message';
import { theme } from '../../styles/theme';

interface ProfileScreenProps {
  navigation: any;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { user } = useAuthStore();
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
    
    // Set default profile data from user
    setProfile({
      fullName: user.name || '',
      email: user.email || '',
      phone: '',
      emergencyContact: '',
      school: '',
      major: '',
      graduationYear: '',
    });
  };

  const saveProfile = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Simulate saving - in a real app this would call your API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      showMessage({
        message: 'Success',
        description: 'Profile updated successfully',
        type: 'success',
        backgroundColor: theme.colors.backgroundSecondary,
        color: theme.colors.textPrimary,
      });
      setIsEditing(false);
    } catch (error) {
      showMessage({
        message: 'Error',
        description: 'Failed to update profile',
        type: 'danger',
        backgroundColor: theme.colors.backgroundSecondary,
        color: theme.colors.textPrimary,
      });
    } finally {
      setLoading(false);
    }
  };

  const { signOut } = useAuthStore();
  
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      showMessage({
        message: 'Error',
        description: 'Failed to sign out',
        type: 'danger',
        backgroundColor: theme.colors.backgroundSecondary,
        color: theme.colors.textPrimary,
      });
    }
  };

  const confirmSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: handleSignOut }
      ]
    );
  };

  const renderProfileField = (
    label: string,
    value: string,
    key: keyof typeof profile,
    multiline = false
  ) => (
    <View style={styles.fieldItem}>
      <View style={styles.fieldHeader}>
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
    </View>
  );

  const renderPreferenceSwitch = (
    label: string,
    description: string,
    key: keyof typeof preferences
  ) => (
    <View style={styles.preferenceItem}>
      <View style={styles.preferenceContent}>
        <Text style={styles.preferenceLabel}>{label}</Text>
        <Text style={styles.preferenceDescription}>{description}</Text>
      </View>
      <View style={styles.preferenceControl}>
        <Switch
          value={preferences[key]}
          onValueChange={(value) => setPreferences({ ...preferences, [key]: value })}
          trackColor={{ false: theme.colors.borderSecondary, true: theme.colors.primary }}
          thumbColor={preferences[key] ? '#ffffff' : theme.colors.textTertiary}
        />
      </View>
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

  const getEditStatusTag = () => {
    if (loading) return { backgroundColor: theme.colors.warning, text: 'Saving', textColor: '#ffffff' };
    if (isEditing) return { backgroundColor: theme.colors.success, text: 'Save', textColor: '#ffffff' };
    return { backgroundColor: theme.colors.secondary, text: 'Edit', textColor: theme.colors.primaryDark };
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Modern Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Profile</Text>
          <Text style={styles.title}>
            {profile.fullName?.split(' ')[0] || 'Student'}
          </Text>
          <Text style={styles.pullHint}>Manage your account and preferences</Text>
        </View>

        {/* Profile Overview Section - Clean layout without heavy card */}
        <View style={styles.profileSection}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {profile.fullName ? profile.fullName.charAt(0).toUpperCase() : 'U'}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>
                  {profile.fullName || 'User'}
                </Text>
                <Text style={styles.profileEmail}>{profile.email}</Text>
                <View style={styles.levelTag}>
                  <Text style={styles.levelTagText}>Level {level}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Your Stats</Text>
          
          <View style={styles.statItem}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>Log Entries</Text>
              <Text style={styles.statValue}>{stats.totalEntries}</Text>
            </View>
          </View>
          
          <View style={styles.statItem}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>Current Streak</Text>
              <Text style={styles.statValue}>{stats.currentStreak} days</Text>
            </View>
          </View>
          
          <View style={styles.statItem}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>Total Earned</Text>
              <Text style={styles.statValue}>${totalEarned}</Text>
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
              style={[styles.editTag, { backgroundColor: getEditStatusTag().backgroundColor }]}
            >
              <Text style={[styles.editTagText, { color: getEditStatusTag().textColor }]}>
                {getEditStatusTag().text}
              </Text>
            </TouchableOpacity>
          </View>
          
          {renderProfileField('Full Name', profile.fullName, 'fullName')}
          {renderProfileField('Email', profile.email, 'email')}
          {renderProfileField('Phone', profile.phone, 'phone')}
          {renderProfileField('Emergency Contact', profile.emergencyContact, 'emergencyContact')}
        </View>

        {/* Academic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Academic Information</Text>
          {renderProfileField('School', profile.school, 'school')}
          {renderProfileField('Major', profile.major, 'major')}
          {renderProfileField('Graduation Year', profile.graduationYear, 'graduationYear')}
        </View>

        {/* Account Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Details</Text>
          
          <View style={styles.detailItem}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailLabel}>Member Since</Text>
              <Text style={styles.detailValue}>{getMembershipDuration()}</Text>
            </View>
          </View>
          
          <View style={styles.detailItem}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailLabel}>Account Type</Text>
              <View style={styles.typeTag}>
                <Text style={styles.typeTagText}>Student</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.detailItem}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailLabel}>Current Level</Text>
              <Text style={styles.detailValue}>Level {level}</Text>
            </View>
          </View>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
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

        {/* Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>More</Text>
          
          <TouchableOpacity style={styles.actionItem}>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Export My Data</Text>
              <Text style={styles.actionSubtitle}>Download your wellness data</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionItem}>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Privacy Policy</Text>
              <Text style={styles.actionSubtitle}>Review our privacy practices</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionItem}>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Terms of Service</Text>
              <Text style={styles.actionSubtitle}>Read the terms and conditions</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionItem, styles.signOutAction]}
            onPress={confirmSignOut}
          >
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, styles.signOutText]}>Sign Out</Text>
              <Text style={styles.actionSubtitle}>Log out of your account</Text>
            </View>
            <Text style={[styles.actionArrow, styles.signOutText]}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flex: 1,
  },

  // Modern Header (like parent dashboard)
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    letterSpacing: -1,
    marginTop: 4,
  },
  pullHint: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    marginTop: 4,
    fontWeight: '500',
  },

  // Profile Section - Clean layout without heavy card
  profileSection: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    marginBottom: 8,
  },
  profileHeader: {
    marginBottom: 8,
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  levelTag: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  levelTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Stats Section
  statsSection: {
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  statItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },

  // Section Styling
  section: {
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  editTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  editTagText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Field Items - Clean list style
  fieldItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  fieldHeader: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  fieldValue: {
    fontSize: 15,
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  fieldInput: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Detail Items
  detailItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  typeTag: {
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Preference Items
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  preferenceContent: {
    flex: 1,
    marginRight: 16,
  },
  preferenceLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  preferenceDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  preferenceControl: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Actions Section
  actionsSection: {
    paddingHorizontal: 24,
    marginBottom: 40,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 1,
  },
  actionSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  actionArrow: {
    fontSize: 18,
    color: theme.colors.textTertiary,
    fontWeight: '300',
  },
  signOutAction: {
    // Keep it clean, no special background
  },
  signOutText: {
    color: theme.colors.error,
  },
}); 