import React, { useState, useEffect } from 'react';
import { 
  ScrollView, 
  View, 
  Text, 
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore } from '../../stores/authStore';

interface ProfileScreenProps {
  navigation: any;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { user, family, logout, updateProfile, getFamilyMembers } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [familyMembers, setFamilyMembers] = useState<{ parents: any[]; students: any[] }>({ parents: [], students: [] });

  useEffect(() => {
    loadFamilyMembers();
  }, []);

  const loadFamilyMembers = async () => {
    const members = await getFamilyMembers();
    setFamilyMembers(members);
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
        'Invite Code Copied! 📋',
        `Share this code with family members:\n\n${family.inviteCode}\n\nThis code has been copied to your clipboard. They can use this to join your family account.`,
        [{ text: 'OK' }]
      );
    }
  };

  const getRoleColor = (role: string) => {
    return role === 'parent' ? '#1e40af' : '#059669';
  };

  const getRoleEmoji = (role: string) => {
    return role === 'parent' ? '👨‍👩‍👧‍👦' : '🎓';
  };

  if (!user || !family) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Profile not available</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
            <View style={styles.roleBadge}>
              <Text style={styles.roleEmoji}>{getRoleEmoji(user.role)}</Text>
              <Text style={[styles.roleText, { color: getRoleColor(user.role) }]}>
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
            <Text style={styles.inviteCodeLabel}>Family Invite Code:</Text>
            <Text style={styles.inviteCode}>{family.inviteCode}</Text>
            <Text style={styles.inviteCodeHint}>Tap to share with family members</Text>
          </TouchableOpacity>
        )}

        <View style={styles.membersSection}>
          <Text style={styles.membersTitle}>Family Members</Text>
          
          {familyMembers.parents.length > 0 && (
            <View style={styles.memberGroup}>
              <Text style={styles.memberGroupTitle}>👨‍👩‍👧‍👦 Parents</Text>
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
              <Text style={styles.memberGroupTitle}>🎓 Students</Text>
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
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsSection}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 16,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#f9fafb',
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
  },
  profileCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#374151',
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
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 4,
  },
  editLink: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
  },
  editContainer: {
    gap: 12,
  },
  editInput: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#f9fafb',
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  editButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  saveButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  cancelButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  cancelButtonText: {
    color: '#d1d5db',
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
    color: '#9ca3af',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#f9fafb',
    fontWeight: '600',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleEmoji: {
    fontSize: 16,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '700',
  },
  familyCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#374151',
  },
  familyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 20,
    textAlign: 'center',
  },
  inviteCodeContainer: {
    backgroundColor: '#374151',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  inviteCodeLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  inviteCode: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f9fafb',
    letterSpacing: 3,
    marginBottom: 4,
  },
  inviteCodeHint: {
    fontSize: 10,
    color: '#6366f1',
    fontStyle: 'italic',
  },
  membersSection: {
    gap: 16,
  },
  membersTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f9fafb',
  },
  memberGroup: {
    gap: 8,
  },
  memberGroupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d1d5db',
  },
  memberItem: {
    backgroundColor: '#374151',
    padding: 12,
    borderRadius: 8,
    marginLeft: 16,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f9fafb',
  },
  memberEmail: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  actionsSection: {
    marginTop: 32,
  },
  signOutButton: {
    backgroundColor: '#dc2626',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});