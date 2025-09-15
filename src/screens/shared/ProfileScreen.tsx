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
  Platform,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';
import { StatusHeader } from '../../components/StatusHeader';
import { theme } from '../../styles/theme';
import { cache, CACHE_CONFIGS, smartRefresh } from '../../utils/universalCache';
import { changePassword } from '../../lib/passwordReset';

interface ProfileScreenProps {
  navigation: any;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { user, family, logout, updateProfile, getFamilyMembers } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [familyMembers, setFamilyMembers] = useState<{ parents: any[]; students: any[] }>({ parents: [], students: [] });
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [isEmailVerified, setIsEmailVerified] = useState(true);
  const [loadingVerification, setLoadingVerification] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [showPaypalSetup, setShowPaypalSetup] = useState(false);
  const [paypalHandle, setPaypalHandle] = useState('');
  const [isUpdatingPaypal, setIsUpdatingPaypal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadFamilyMembers();
    checkEmailVerificationStatus();
    // Initialize PayPal handle from user data
    if (user?.paypal_me_handle) {
      setPaypalHandle(user.paypal_me_handle);
    }
  }, [user?.id]);

  const checkEmailVerificationStatus = async () => {
    if (!user) return;
    
    try {
      const { cache, CACHE_CONFIGS } = await import('../../utils/universalCache');
      
      const verificationStatus = await cache.getOrFetch(
        CACHE_CONFIGS.EMAIL_VERIFICATION_STATUS,
        async () => {
          const { doc, getDoc } = await import('firebase/firestore');
          const { db } = await import('../../lib/firebase');
          
          const userDoc = await getDoc(doc(db, 'users', user.id));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            return userData.email_verified ?? false;
          }
          return false;
        },
        user.id
      );
      
      setIsEmailVerified(verificationStatus);
    } catch (error) {
      console.error('Failed to check email verification status:', error);
    }
  };

  const handleResendVerificationEmail = async () => {
    if (!user) return;

    setLoadingVerification(true);
    try {
      // Use the secure Cloud Function for resending verification email
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('../../lib/firebase');

      const resendVerificationEmailFunction = httpsCallable(functions, 'resendVerificationEmail');
      const result = await resendVerificationEmailFunction({});

      console.log('✅ Verification email resent:', result.data);
      Alert.alert('Verification Email Sent', 'A new verification email has been sent to your email address. Please check your inbox and click the verification link.');
    } catch (error: any) {
      console.error('Error resending verification email:', error);

      let errorMessage = 'Failed to send verification email. Please try again.';

      if (error.code === 'functions/already-exists') {
        errorMessage = 'Your email is already verified.';
      } else if (error.code === 'functions/not-found') {
        errorMessage = 'User not found. Please try signing in again.';
      } else if (error.code === 'functions/unauthenticated') {
        errorMessage = 'You must be signed in to resend verification email.';
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setLoadingVerification(false);
    }
  };

  const handleSendEmailInvite = async () => {
    if (!user || !family || !inviteEmail.trim() || !inviteName.trim()) return;
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    
    if (inviteName.trim().length < 2) {
      Alert.alert('Invalid Name', 'Please enter a valid name (at least 2 characters).');
      return;
    }
    
    setLoadingInvite(true);
    try {
      const { sendInvitationEmail } = await import('../../lib/emailInvitation');
      const result = await sendInvitationEmail(
        inviteEmail,
        inviteName,
        user.name,
        family.name,
        family.inviteCode
      );
      
      if (result.success) {
        Alert.alert(
          'Invitation Sent! 📧', 
          `An invitation email has been sent to ${inviteName} at ${inviteEmail}. They can use the invite code ${family.inviteCode} to join your family.`
        );
        setInviteEmail(''); // Clear the inputs
        setInviteName('');
      } else {
        // Show error with manual sharing option
        Alert.alert(
          'Email Service Unavailable',
          result.error || 'Failed to send invitation email.',
          [
            { 
              text: 'Share Manually', 
              onPress: () => {
                // Copy invite code and show sharing instructions
                const message = `Hi ${inviteName}! I've invited you to join our family on CampusLife. Download the app and use invite code: ${family.inviteCode}`;
                Alert.alert(
                  'Share This Message',
                  message,
                  [
                    { 
                      text: 'Copy Message', 
                      onPress: async () => {
                        const Clipboard = await import('expo-clipboard');
                        await Clipboard.default.setStringAsync(message);
                        Alert.alert('Copied!', 'Message copied to clipboard. You can now paste it in a text message or email.');
                      }
                    },
                    { text: 'OK' }
                  ]
                );
              }
            },
            { text: 'OK', style: 'cancel' }
          ]
        );
      }
    } catch (error: any) {
      console.error('Email invitation error:', error);
      Alert.alert('Error', `Failed to send invitation email: ${error.message || 'Please try again.'}`);
    } finally {
      setLoadingInvite(false);
    }
  };


  const loadFamilyMembers = async () => {
    if (!user) return;
    
    try {
      // Clear the family members cache first to force fresh data
      const { cache, CACHE_CONFIGS } = await import('../../utils/universalCache');
      await cache.clear(CACHE_CONFIGS.FAMILY_MEMBERS, user.id);
      console.log('🗑️ Cleared family members cache');
      
      // Now load fresh data
      console.log('🔄 Loading fresh family members...');
      const members = await getFamilyMembers();
      console.log('👥 Loaded family members:', members);
      setFamilyMembers(members);
      setLoadingMembers(false);
    } catch (error) {
      console.error('Failed to load family members:', error);
      setLoadingMembers(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadFamilyMembers(),
        checkEmailVerificationStatus()
      ]);
    } catch (error) {
      console.error('Error refreshing profile data:', error);
    } finally {
      setRefreshing(false);
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
      'Type "DELETE" below to confirm account deletion:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm Deletion', 
          style: 'destructive',
          onPress: () => performDeleteAccount()
        }
      ]
    );
  };

  const performDeleteAccount = async () => {
    if (!user) return;

    try {
      // Show loading state
      Alert.alert('Deleting Account', 'Please wait while we securely delete your account and data...');

      // Use the secure Cloud Function for account deletion
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('../../lib/firebase');

      const deleteAccountFunction = httpsCallable(functions, 'deleteAccount');
      const result = await deleteAccountFunction({ confirmationText: 'DELETE' });

      console.log('✅ Account deletion completed:', result.data);

      // Clear local cache
      await cache.clearAll();

      Alert.alert(
        'Account Deleted',
        'Your account and all associated data have been permanently deleted.',
        [{
          text: 'OK',
          onPress: () => {
            // Logout and let auth state change handle navigation automatically
            logout();
          }
        }]
      );
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

      Alert.alert('Error', errorMessage);
    }
  };

  const handleSavePaypal = async () => {
    if (!user) return;

    // Basic validation
    const cleanHandle = paypalHandle.replace(/^@/, '').toLowerCase().trim();
    if (cleanHandle && !/^[a-zA-Z0-9._-]{6,20}$/.test(cleanHandle)) {
      Alert.alert('Invalid Handle', 'PayPal handle must be 6-20 characters with only letters, numbers, dots, dashes, and underscores.');
      return;
    }

    setIsUpdatingPaypal(true);
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');

      await updateDoc(doc(db, 'users', user.id), {
        paypal_me_handle: cleanHandle || null,
        updated_at: new Date()
      });

      // Update local user data (this would normally be handled by auth store)
      Alert.alert(
        'Success!',
        cleanHandle
          ? `PayPal handle saved! Family can now send you money at paypal.me/${cleanHandle}`
          : 'PayPal handle removed successfully',
        [{ text: 'OK', onPress: () => setShowPaypalSetup(false) }]
      );

    } catch (error: any) {
      console.error('Error saving PayPal handle:', error);
      Alert.alert('Error', 'Failed to save PayPal handle. Please try again.');
    } finally {
      setIsUpdatingPaypal(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Error', 'New password must be at least 8 characters long');
      return;
    }

    setIsChangingPassword(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      
      if (result.success) {
        Alert.alert(
          'Success', 
          'Password changed successfully',
          [{ text: 'OK', onPress: () => {
            setShowPasswordChange(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
          }}]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to change password');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to change password. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
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
          <>
            <TouchableOpacity style={styles.inviteCodeContainer} onPress={copyInviteCode}>
              <Text style={styles.inviteCodeLabel}>Family Invite Code</Text>
              <Text style={styles.inviteCode}>{family.inviteCode}</Text>
              <Text style={styles.inviteCodeHint}>Tap to copy and share</Text>
            </TouchableOpacity>
            
            <View style={styles.inviteEmailContainer}>
              <Text style={styles.inviteEmailLabel}>Invite Student by Email</Text>
              <TextInput
                style={styles.inviteEmailInput}
                placeholder="Student's name"
                placeholderTextColor={theme.colors.textTertiary}
                value={inviteName}
                onChangeText={setInviteName}
                autoCapitalize="words"
                autoCorrect={false}
              />
              <TextInput
                style={[styles.inviteEmailInput, { marginTop: 8 }]}
                placeholder="Student's email address"
                placeholderTextColor={theme.colors.textTertiary}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.sendInviteButton, (!inviteEmail || !inviteName || loadingInvite) && styles.sendInviteButtonDisabled]}
                onPress={handleSendEmailInvite}
                disabled={!inviteEmail || !inviteName || loadingInvite}
              >
                {loadingInvite ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.sendInviteButtonText}>Send Invite Email</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
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
                  {familyMembers.parents.map((parent) => {
                    console.log('👤 Parent data:', { id: parent.id, name: parent.name, email: parent.email });
                    return (
                      <View key={parent.id} style={styles.memberItem}>
                        <Text style={styles.memberName}>
                          {parent.name || 'No name'}
                          {parent.id === user.id && ' (You)'}
                        </Text>
                        <Text style={styles.memberEmail}>{parent.email}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {familyMembers.students.length > 0 && (
                <View style={styles.memberGroup}>
                  <Text style={styles.memberGroupTitle}>Students</Text>
                  {familyMembers.students.map((student) => {
                    console.log('👤 Student data:', { id: student.id, name: student.name, email: student.email, paypal_me_handle: student.paypal_me_handle });
                    return (
                      <View key={student.id} style={styles.memberItem}>
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>
                            {student.name || 'No name'}
                            {student.id === user.id && ' (You)'}
                          </Text>
                          <Text style={styles.memberEmail}>{student.email}</Text>
                          {student.paypal_me_handle ? (
                            <View style={styles.paypalContainer}>
                              <Text style={styles.paypalLabel}>💳 PayPal:</Text>
                              <Text style={styles.paypalHandle}>paypal.me/{student.paypal_me_handle}</Text>
                            </View>
                          ) : (
                            <Text style={styles.paypalMissing}>💳 PayPal not set up</Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </View>
      </View>

      {/* PayPal Handle Alert for Students */}
      {user.role === 'student' && !user.paypal_me_handle && (
        <View style={styles.paypalAlert}>
          <View style={styles.alertHeader}>
            <Text style={styles.alertIcon}>💳</Text>
            <Text style={styles.alertTitle}>Edit PayPal Handle</Text>
          </View>
          <Text style={styles.alertDescription}>
            Set up your PayPal.Me handle to receive payments from family. Go to your profile to add it.
          </Text>
          <TouchableOpacity
            style={styles.alertButton}
            onPress={() => setShowPaypalSetup(true)}
          >
            <Text style={styles.alertButtonText}>Set Up PayPal</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Email Verification Panel */}
      {!isEmailVerified && (
        <View style={styles.verificationCard}>
          <View style={styles.verificationHeader}>
            <Text style={styles.verificationIcon}>⚠️</Text>
            <Text style={styles.verificationTitle}>Email Not Verified</Text>
          </View>
          <Text style={styles.verificationDescription}>
            Your email address needs to be verified to ensure account security and receive important notifications.
          </Text>
          <TouchableOpacity
            style={[styles.verifyButton, loadingVerification && styles.verifyButtonDisabled]}
            onPress={handleResendVerificationEmail}
            disabled={loadingVerification}
          >
            {loadingVerification ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.verifyButtonText}>Send Verification Email</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.verificationHint}>
            Check your spam folder if you don't see the email within a few minutes.
          </Text>
        </View>
      )}


      {/* Password Change Section */}
      <View style={styles.passwordSection}>
        <TouchableOpacity 
          style={styles.passwordButton} 
          onPress={() => setShowPasswordChange(!showPasswordChange)}
        >
          <Text style={styles.passwordButtonText}>Change Password</Text>
          <Text style={styles.passwordButtonArrow}>{showPasswordChange ? '▼' : '▶'}</Text>
        </TouchableOpacity>
        
        {showPasswordChange && (
          <View style={styles.passwordForm}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Current Password"
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.passwordInput}
              placeholder="New Password (min 8 characters)"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.passwordInput}
              placeholder="Confirm New Password"
              secureTextEntry
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              autoCapitalize="none"
            />
            
            <View style={styles.passwordActions}>
              <TouchableOpacity 
                style={styles.cancelPasswordButton} 
                onPress={() => {
                  setShowPasswordChange(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                }}
              >
                <Text style={styles.cancelPasswordButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.changePasswordButton, isChangingPassword && styles.disabledButton]} 
                onPress={handleChangePassword}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.changePasswordButtonText}>Change Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actionsSection}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.deleteAccountButton} onPress={handleDeleteAccount}>
          <Text style={styles.deleteAccountButtonText}>Delete Account</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* PayPal Setup Modal */}
      {showPaypalSetup && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Up PayPal Handle</Text>
              <TouchableOpacity
                onPress={() => setShowPaypalSetup(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Enter your PayPal.Me handle so family can send you money instantly.
              For example, if your handle is "johnsmith", your link will be paypal.me/johnsmith
            </Text>

            <View style={styles.paypalInputContainer}>
              <Text style={styles.paypalPrefix}>paypal.me/</Text>
              <TextInput
                style={styles.paypalInput}
                value={paypalHandle}
                onChangeText={(text) => {
                  // Clean input: remove @ symbols and paypal.me prefixes
                  const cleanText = text.replace(/^@/, '').replace(/^(https?:\/\/)?(www\.)?paypal\.com\/paypalme\//, '').toLowerCase();
                  setPaypalHandle(cleanText);
                }}
                placeholder="yourhandle"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {paypalHandle && (
              <View style={styles.previewContainer}>
                <Text style={styles.previewLabel}>Preview:</Text>
                <Text style={styles.previewUrl}>https://paypal.me/{paypalHandle}/25.00</Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowPaypalSetup(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveButton, isUpdatingPaypal && styles.modalSaveButtonDisabled]}
                onPress={handleSavePaypal}
                disabled={isUpdatingPaypal}
              >
                {isUpdatingPaypal ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSaveText}>Save PayPal Handle</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
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
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
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
  inviteEmailContainer: {
    backgroundColor: theme.colors.backgroundTertiary,
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inviteEmailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  inviteEmailInput: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  sendInviteButton: {
    backgroundColor: theme.colors.success,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  sendInviteButtonDisabled: {
    backgroundColor: theme.colors.textSecondary,
  },
  sendInviteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
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
  memberInfo: {
    flex: 1,
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
  paypalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: '#f0f9ff',
    padding: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  paypalLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1e40af',
    marginRight: 4,
  },
  paypalHandle: {
    fontSize: 11,
    color: '#1e40af',
    fontFamily: 'monospace',
    flex: 1,
  },
  paypalMissing: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  actionsSection: {
    marginTop: 32,
    gap: 12,
  },
  signOutButton: {
    backgroundColor: theme.colors.error,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.backgroundSecondary,
  },
  deleteAccountButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#dc2626',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteAccountButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#dc2626',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  // Verification Panel Styles
  verificationCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  verificationIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  verificationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#92400E',
  },
  // PayPal Alert Styles
  paypalAlert: {
    backgroundColor: '#EBF8FF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E40AF',
  },
  alertDescription: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
    marginBottom: 16,
  },
  alertButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  alertButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  verificationDescription: {
    fontSize: 15,
    color: '#92400E',
    lineHeight: 20,
    marginBottom: 16,
  },
  verifyButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  verifyButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  verificationHint: {
    fontSize: 13,
    color: '#92400E',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  passwordSection: {
    marginBottom: 24,
  },
  passwordButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  passwordButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  passwordButtonArrow: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  passwordForm: {
    backgroundColor: '#ffffff',
    marginTop: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  passwordInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
  },
  passwordActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cancelPasswordButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelPasswordButtonText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
  changePasswordButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    padding: 12,
    marginLeft: 8,
    alignItems: 'center',
  },
  changePasswordButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#94a3b8',
  },
  // PayPal Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    maxWidth: 400,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 20,
    color: '#64748b',
    fontWeight: '600',
  },
  modalDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  paypalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 16,
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
  previewContainer: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  previewLabel: {
    fontSize: 12,
    color: '#1e40af',
    fontWeight: '600',
    marginBottom: 4,
  },
  previewUrl: {
    fontSize: 14,
    color: '#1e40af',
    fontFamily: 'monospace',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  modalSaveButton: {
    flex: 2,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSaveButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});