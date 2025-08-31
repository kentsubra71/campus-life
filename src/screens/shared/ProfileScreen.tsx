import React, { useState, useEffect } from 'react';
import { 
  ScrollView, 
  View, 
  Text, 
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';
import { StatusHeader } from '../../components/StatusHeader';
import { theme } from '../../styles/theme';
import { cache, CACHE_CONFIGS, smartRefresh } from '../../utils/universalCache';

interface ProfileScreenProps {
  navigation: any;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { user, family, logout, updateProfile, getFamilyMembers } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [familyMembers, setFamilyMembers] = useState<{ parents: any[]; students: any[] }>({ parents: [], students: [] });
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    loadFamilyMembers();
  }, []);

  const loadFamilyMembers = async () => {
    if (!user) return;
    
    try {
      await smartRefresh(
        CACHE_CONFIGS.FAMILY_MEMBERS,
        async () => {
          console.log('🔄 Loading fresh family members...');
          const members = await getFamilyMembers();
          return members;
        },
        (cachedMembers) => {
          console.log('📦 Using cached family members');
          setFamilyMembers(cachedMembers);
          setLoadingMembers(false);
        },
        (freshMembers) => {
          console.log('✅ Updated with fresh family members');
          setFamilyMembers(freshMembers);
          setLoadingMembers(false);
        },
        user.id
      );
    } catch (error) {
      console.error('Failed to load family members:', error);
      setLoadingMembers(false);
    }
  };

  const handleSaveName = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    const success = await updateProfile({ name: editName });
    if (success) {
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } else {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: () => {
            logout();
            // Navigation will be handled automatically by auth state change
            // No need to manually reset navigation stack
          }
        }
      ]
    );
  };

  const copyInviteCode = async () => {
    if (family?.inviteCode) {
      await Clipboard.setStringAsync(family.inviteCode);
      Alert.alert(
        'Invite Code Copied',
        `Share this code with family members:\n\n${family.inviteCode}\n\nThis code has been copied to your clipboard. They can use this to join your family account.`,
        [{ text: 'OK' }]
      );
    }
  };

  const getRoleColor = (role: string) => {
    return role === 'parent' ? theme.colors.primary : theme.colors.success;
  };


  if (!user || !family) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Profile not available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusHeader title="Profile" />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
        style={[styles.scrollContainer, { paddingTop: 50 }]} 
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Manage your account and family</Text>
        </View>

      {/* User Info Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {user.name.split(' ').map(n => n[0]).join('')}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            {isEditing ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={styles.editInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Enter your name"
                  autoCapitalize="words"
                />
                <View style={styles.editButtons}>
                  <TouchableOpacity style={styles.saveButton} onPress={handleSaveName}>
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.cancelButton} 
                    onPress={() => {
                      setIsEditing(false);
                      setEditName(user.name);
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.profileName}>{user.name}</Text>
                <TouchableOpacity onPress={() => setIsEditing(true)}>
                  <Text style={styles.editLink}>Edit name</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
        
        <View style={styles.profileDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Email:</Text>
            <Text style={styles.detailValue}>{user.email}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Role:</Text>
            <View style={[styles.roleBadge, { backgroundColor: getRoleColor(user.role) }]}>
              <Text style={styles.roleText}>
                {user.role === 'parent' ? 'Parent' : 'Student'}
              </Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Member since:</Text>
            <Text style={styles.detailValue}>
              {user.createdAt.toLocaleDateString()}
            </Text>
          </View>
        </View>
      </View>

      {/* Family Info Card */}
      <View style={styles.familyCard}>
        <Text style={styles.familyTitle}>{family.name}</Text>
        
        {user.role === 'parent' && (
          <TouchableOpacity style={styles.inviteCodeContainer} onPress={copyInviteCode}>
            <Text style={styles.inviteCodeLabel}>Family Invite Code</Text>
            <Text style={styles.inviteCode}>{family.inviteCode}</Text>
            <Text style={styles.inviteCodeHint}>Tap to copy and share</Text>
          </TouchableOpacity>
        )}

        <View style={styles.membersSection}>
          <Text style={styles.membersTitle}>Family Members</Text>
          
          {loadingMembers ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading family members...</Text>
            </View>
          ) : (
            <>
              {familyMembers.parents.length > 0 && (
                <View style={styles.memberGroup}>
                  <Text style={styles.memberGroupTitle}>Parents</Text>
                  {familyMembers.parents.map((parent) => (
                    <View key={parent.id} style={styles.memberItem}>
                      <Text style={styles.memberName}>
                        {parent.name}
                        {parent.id === user.id && ' (You)'}
                      </Text>
                      <Text style={styles.memberEmail}>{parent.email}</Text>
                    </View>
                  ))}
                </View>
              )}

              {familyMembers.students.length > 0 && (
                <View style={styles.memberGroup}>
                  <Text style={styles.memberGroupTitle}>Students</Text>
                  {familyMembers.students.map((student) => (
                    <View key={student.id} style={styles.memberItem}>
                      <Text style={styles.memberName}>
                        {student.name}
                        {student.id === user.id && ' (You)'}
                      </Text>
                      <Text style={styles.memberEmail}>{student.email}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsSection}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
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
  scrollContainer: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 16,
  },
  header: {
    marginBottom: 32,
  },
  backButton: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
    marginBottom: 12,
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
  },
  profileCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.backgroundSecondary,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  editLink: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  editContainer: {
    gap: 12,
  },
  editInput: {
    backgroundColor: theme.colors.backgroundTertiary,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  editButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  saveButton: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveButtonText: {
    color: theme.colors.backgroundSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  cancelButton: {
    backgroundColor: theme.colors.backgroundTertiary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  profileDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.backgroundSecondary,
    textTransform: 'uppercase',
  },
  familyCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  familyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  inviteCodeContainer: {
    backgroundColor: theme.colors.backgroundTertiary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inviteCodeLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
    fontWeight: '600',
  },
  inviteCode: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    letterSpacing: 3,
    marginBottom: 4,
  },
  inviteCodeHint: {
    fontSize: 10,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  membersSection: {
    gap: 16,
  },
  membersTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  memberGroup: {
    gap: 8,
  },
  memberGroupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  memberItem: {
    backgroundColor: theme.colors.backgroundTertiary,
    padding: 12,
    borderRadius: 8,
    marginLeft: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  memberEmail: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  actionsSection: {
    marginTop: 32,
  },
  signOutButton: {
    backgroundColor: theme.colors.error,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.backgroundSecondary,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
});