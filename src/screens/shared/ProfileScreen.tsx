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
  Switch,
  ActivityIndicator
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';
import { StatusHeader } from '../../components/StatusHeader';
import { theme } from '../../styles/theme';
import { cache, CACHE_CONFIGS, smartRefresh } from '../../utils/universalCache';
import { pushNotificationService } from '../../services/pushNotificationService';
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
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [familyMembers, setFamilyMembers] = useState<{ parents: any[]; students: any[] }>({ parents: [], students: [] });
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [notificationPreferences, setNotificationPreferences] = useState({
    enabled: true,
    supportMessages: true,
    paymentUpdates: true,
    wellnessReminders: true,
    careRequests: true,
    weeklyReports: true,
    dailySummaries: true,
    studentWellnessLogged: true,
  });
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState(true);
  const [loadingVerification, setLoadingVerification] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [loadingInvite, setLoadingInvite] = useState(false);

  useEffect(() => {
    if (user?.id) {
      console.log('👤 User changed, reloading profile data for user:', user.id);
      loadFamilyMembers();
      loadNotificationPreferences();
      checkEmailVerificationStatus();
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
    };
  }, [user?.id, saveTimeout]);

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
      const { resendVerificationEmail } = await import('../../lib/emailVerification');
      const result = await resendVerificationEmail(user.id);
      
      if (result.success) {
        Alert.alert('Verification Email Sent', 'A new verification email has been sent to your email address. Please check your inbox and click the verification link.');
      } else {
        Alert.alert('Error', result.error || 'Failed to send verification email. Please try again.');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to send verification email. Please try again.');
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

  const loadNotificationPreferences = async () => {
    if (!user) return;
    
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      
      console.log('📱 Loading notification preferences for user:', user.id);
      
      const userDoc = await getDoc(doc(db, 'users', user.id));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('📄 User document exists:', !!userData);
        
        if (userData.notificationPreferences) {
          console.log('🔔 Found saved notification preferences:', userData.notificationPreferences);
          const loadedPreferences = {
            enabled: userData.notificationPreferences.enabled ?? true,
            supportMessages: userData.notificationPreferences.supportMessages ?? true,
            paymentUpdates: userData.notificationPreferences.paymentUpdates ?? true,
            wellnessReminders: userData.notificationPreferences.wellnessReminders ?? true,
            careRequests: userData.notificationPreferences.careRequests ?? true,
            weeklyReports: userData.notificationPreferences.weeklyReports ?? true,
            dailySummaries: userData.notificationPreferences.dailySummaries ?? true,
            studentWellnessLogged: userData.notificationPreferences.studentWellnessLogged ?? true,
          };
          setNotificationPreferences(loadedPreferences);
          console.log('✅ Notification preferences loaded successfully:', loadedPreferences);
        } else {
          console.log('📱 No saved notification preferences found, using defaults');
          // Initialize with default preferences if none exist
          const defaultPreferences = {
            enabled: true,
            supportMessages: true,
            paymentUpdates: true,
            wellnessReminders: true,
            careRequests: true,
            weeklyReports: true,
            dailySummaries: true,
            studentWellnessLogged: true,
          };
          setNotificationPreferences(defaultPreferences);
          // Save the defaults to Firebase so they persist (without triggering push notification setup)
          const { doc, updateDoc, Timestamp } = await import('firebase/firestore');
          await updateDoc(doc(db, 'users', user.id), {
            notificationPreferences: defaultPreferences,
            updated_at: Timestamp.now()
          });
          console.log('💾 Saved default notification preferences to Firebase');
        }
      } else {
        console.error('❌ User document does not exist for user:', user.id);
      }
    } catch (error) {
      console.error('❌ Failed to load notification preferences:', error);
    }
  };

  const debouncedSaveNotificationPreferences = (newPreferences: typeof notificationPreferences) => {
    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    // Set new timeout
    const timeout = setTimeout(() => {
      saveNotificationPreferences(newPreferences);
    }, 300); // 300ms debounce
    
    setSaveTimeout(timeout);
  };

  const saveNotificationPreferences = async (newPreferences: typeof notificationPreferences) => {
    if (!user) {
      console.error('❌ No user found, cannot save notification preferences');
      return;
    }
    
    console.log('💾 Saving notification preferences for user:', user.id, newPreferences);
    setLoadingNotifications(true);
    
    try {
      const { doc, updateDoc, Timestamp, getDoc } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      
      // First verify the user document exists
      const userDocRef = doc(db, 'users', user.id);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        throw new Error(`User document does not exist for user: ${user.id}`);
      }
      
      await updateDoc(userDocRef, {
        notificationPreferences: newPreferences,
        updated_at: Timestamp.now()
      });
      
      console.log('✅ Successfully saved notification preferences to Firebase:', newPreferences);
      
      // Verify the save was successful by reading it back
      const updatedDoc = await getDoc(userDocRef);
      const updatedData = updatedDoc.data();
      console.log('🔍 Verification - preferences in Firebase after save:', updatedData?.notificationPreferences);
      
      setNotificationPreferences(newPreferences);
      
      // Re-initialize push notifications with new preferences
      if (newPreferences.enabled) {
        await pushNotificationService.initialize(user.id);
        
        // Schedule notifications based on preferences
        if (newPreferences.wellnessReminders && user.role === 'student') {
          await pushNotificationService.scheduleDailyWellnessReminder(user.id);
        }
        
        if (newPreferences.dailySummaries) {
          await pushNotificationService.scheduleDailySummary(user.id);
        }
        
        if (newPreferences.weeklyReports) {
          await pushNotificationService.scheduleWeeklySummary(user.id);
        }
      } else {
        // Cancel all notifications if disabled
        await pushNotificationService.cancelScheduledNotifications();
      }
      
      console.log('🎉 Notification preferences saved and verified successfully');
    } catch (error: any) {
      console.error('❌ Failed to save notification preferences:', error);
      
      // More specific error messages
      let errorMessage = 'Failed to update notification preferences';
      if (error.code === 'permission-denied') {
        errorMessage = 'Permission denied. Please make sure you are logged in.';
      } else if (error.code === 'not-found') {
        errorMessage = 'User account not found. Please try logging out and back in.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
      
      // Revert the local state if save failed
      loadNotificationPreferences();
    } finally {
      setLoadingNotifications(false);
    }
  };

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
      // Import Firebase auth functions
      const { getCurrentUser, signOutUser } = await import('../../lib/firebase');
      const { deleteUser } = await import('firebase/auth');
      const { doc, deleteDoc, collection, query, where, getDocs, writeBatch } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');

      const currentUser = getCurrentUser();
      if (!currentUser) {
        Alert.alert('Error', 'No authenticated user found');
        return;
      }

      // Show loading state
      Alert.alert('Deleting Account', 'Please wait while we delete your account and data...');

      // Delete user's data from Firestore collections
      const batch = writeBatch(db);

      // Delete from users collection
      batch.delete(doc(db, 'users', user.id));

      // Delete from profiles collection if it exists
      try {
        batch.delete(doc(db, 'profiles', user.id));
      } catch (error) {
        // Profile might not exist, continue
      }

      // Delete wellness entries
      const wellnessQuery = query(collection(db, 'wellness_entries'), where('user_id', '==', user.id));
      const wellnessSnapshot = await getDocs(wellnessQuery);
      wellnessSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete rewards
      const rewardsQuery = query(collection(db, 'rewards'), where('user_id', '==', user.id));
      const rewardsSnapshot = await getDocs(rewardsQuery);
      rewardsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete messages sent by user
      const messagesQuery = query(collection(db, 'messages'), where('from_user_id', '==', user.id));
      const messagesSnapshot = await getDocs(messagesQuery);
      messagesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete payments (parent or student)
      const paymentsParentQuery = query(collection(db, 'payments'), where('parent_id', '==', user.id));
      const paymentsParentSnapshot = await getDocs(paymentsParentQuery);
      paymentsParentSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      const paymentsStudentQuery = query(collection(db, 'payments'), where('student_id', '==', user.id));
      const paymentsStudentSnapshot = await getDocs(paymentsStudentQuery);
      paymentsStudentSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete item requests
      const itemRequestsStudentQuery = query(collection(db, 'item_requests'), where('student_id', '==', user.id));
      const itemRequestsStudentSnapshot = await getDocs(itemRequestsStudentQuery);
      itemRequestsStudentSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      const itemRequestsParentQuery = query(collection(db, 'item_requests'), where('parent_id', '==', user.id));
      const itemRequestsParentSnapshot = await getDocs(itemRequestsParentQuery);
      itemRequestsParentSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete subscriptions
      const subscriptionsQuery = query(collection(db, 'subscriptions'), where('user_id', '==', user.id));
      const subscriptionsSnapshot = await getDocs(subscriptionsQuery);
      subscriptionsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete monthly spend records
      const monthlySpendQuery = query(collection(db, 'monthly_spend'), where('parent_id', '==', user.id));
      const monthlySpendSnapshot = await getDocs(monthlySpendQuery);
      monthlySpendSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete transactions
      const transactionsParentQuery = query(collection(db, 'transactions'), where('parentId', '==', user.id));
      const transactionsParentSnapshot = await getDocs(transactionsParentQuery);
      transactionsParentSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      const transactionsStudentQuery = query(collection(db, 'transactions'), where('studentId', '==', user.id));
      const transactionsStudentSnapshot = await getDocs(transactionsStudentQuery);
      transactionsStudentSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete user progress
      try {
        batch.delete(doc(db, 'user_progress', user.id));
      } catch (error) {
        // Might not exist, continue
      }

      // Commit all Firestore deletions
      await batch.commit();

      // Clear local cache
      await cache.clearAll();

      // Delete Firebase Auth user (this will also sign them out)
      await deleteUser(currentUser);

      Alert.alert(
        'Account Deleted',
        'Your account and all associated data have been permanently deleted.',
        [{ text: 'OK' }]
      );

      // Logout will be handled automatically by auth state change
    } catch (error: any) {
      console.error('Error deleting account:', error);
      
      let errorMessage = 'Failed to delete account. Please try again.';
      
      if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'For security reasons, you need to sign in again before deleting your account. Please sign out and sign back in, then try again.';
      }

      Alert.alert('Error', errorMessage);
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

            {/* Family Join Requests Button */}
            <TouchableOpacity 
              style={styles.joinRequestsButton}
              onPress={() => navigation.navigate('FamilyJoinRequests' as never)}
            >
              <View style={styles.joinRequestsContent}>
                <Text style={styles.joinRequestsTitle}>Family Join Requests</Text>
                <Text style={styles.joinRequestsSubtitle}>Approve new students</Text>
              </View>
              <Text style={styles.joinRequestsArrow}>→</Text>
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

      {/* Notification Preferences */}
      <View style={styles.familyCard}>
        <Text style={styles.familyTitle}>🔔 Notification Preferences</Text>
        
        <View style={styles.preferencesContainer}>
          {/* Master toggle */}
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceContent}>
              <Text style={styles.preferenceLabel}>Push Notifications</Text>
              <Text style={styles.preferenceDescription}>
                Enable all push notifications
              </Text>
            </View>
            <Switch
              value={notificationPreferences.enabled}
              onValueChange={(value) => {
                const newPrefs = { ...notificationPreferences, enabled: value };
                setNotificationPreferences(newPrefs); // Update UI immediately
                debouncedSaveNotificationPreferences(newPrefs); // Save with debounce
              }}
              trackColor={{ false: '#ccc', true: theme.colors.primary }}
              thumbColor={notificationPreferences.enabled ? '#fff' : '#f4f3f4'}
              disabled={loadingNotifications}
            />
          </View>

          {notificationPreferences.enabled && (
            <>
              {/* Support Messages */}
              <View style={styles.preferenceItem}>
                <View style={styles.preferenceContent}>
                  <Text style={styles.preferenceLabel}>Support Messages</Text>
                  <Text style={styles.preferenceDescription}>
                    Get notified when you receive support messages
                  </Text>
                </View>
                <Switch
                  value={notificationPreferences.supportMessages}
                  onValueChange={(value) => {
                    const newPrefs = { ...notificationPreferences, supportMessages: value };
                    setNotificationPreferences(newPrefs);
                    debouncedSaveNotificationPreferences(newPrefs);
                  }}
                  trackColor={{ false: '#ccc', true: theme.colors.primary }}
                  thumbColor={notificationPreferences.supportMessages ? '#fff' : '#f4f3f4'}
                  disabled={loadingNotifications}
                />
              </View>

              {/* Payment Updates */}
              <View style={styles.preferenceItem}>
                <View style={styles.preferenceContent}>
                  <Text style={styles.preferenceLabel}>Payment Updates</Text>
                  <Text style={styles.preferenceDescription}>
                    Get notified about payment status changes
                  </Text>
                </View>
                <Switch
                  value={notificationPreferences.paymentUpdates}
                  onValueChange={(value) => {
                    const newPrefs = { ...notificationPreferences, paymentUpdates: value };
                    setNotificationPreferences(newPrefs);
                    debouncedSaveNotificationPreferences(newPrefs);
                  }}
                  trackColor={{ false: '#ccc', true: theme.colors.primary }}
                  thumbColor={notificationPreferences.paymentUpdates ? '#fff' : '#f4f3f4'}
                  disabled={loadingNotifications}
                />
              </View>

              {/* Wellness Reminders (Students only) */}
              {user?.role === 'student' && (
                <View style={styles.preferenceItem}>
                  <View style={styles.preferenceContent}>
                    <Text style={styles.preferenceLabel}>Daily Wellness Reminders</Text>
                    <Text style={styles.preferenceDescription}>
                      Get reminded to log your daily wellness (8 PM)
                    </Text>
                  </View>
                  <Switch
                    value={notificationPreferences.wellnessReminders}
                    onValueChange={(value) => {
                      const newPrefs = { ...notificationPreferences, wellnessReminders: value };
                      setNotificationPreferences(newPrefs);
                      debouncedSaveNotificationPreferences(newPrefs);
                    }}
                    trackColor={{ false: '#ccc', true: theme.colors.primary }}
                    thumbColor={notificationPreferences.wellnessReminders ? '#fff' : '#f4f3f4'}
                    disabled={loadingNotifications}
                  />
                </View>
              )}

              {/* Student Wellness Logged (Parents only) */}
              {user?.role === 'parent' && (
                <View style={styles.preferenceItem}>
                  <View style={styles.preferenceContent}>
                    <Text style={styles.preferenceLabel}>Student Check-ins</Text>
                    <Text style={styles.preferenceDescription}>
                      Get notified when your student logs their wellness
                    </Text>
                  </View>
                  <Switch
                    value={notificationPreferences.studentWellnessLogged}
                    onValueChange={(value) => {
                      const newPrefs = { ...notificationPreferences, studentWellnessLogged: value };
                      setNotificationPreferences(newPrefs);
                      debouncedSaveNotificationPreferences(newPrefs);
                    }}
                    trackColor={{ false: '#ccc', true: theme.colors.primary }}
                    thumbColor={notificationPreferences.studentWellnessLogged ? '#fff' : '#f4f3f4'}
                    disabled={loadingNotifications}
                  />
                </View>
              )}

              {/* Care Requests */}
              <View style={styles.preferenceItem}>
                <View style={styles.preferenceContent}>
                  <Text style={styles.preferenceLabel}>Care Requests</Text>
                  <Text style={styles.preferenceDescription}>
                    Get notified about urgent care requests
                  </Text>
                </View>
                <Switch
                  value={notificationPreferences.careRequests}
                  onValueChange={(value) => {
                    const newPrefs = { ...notificationPreferences, careRequests: value };
                    setNotificationPreferences(newPrefs);
                    debouncedSaveNotificationPreferences(newPrefs);
                  }}
                  trackColor={{ false: '#ccc', true: theme.colors.primary }}
                  thumbColor={notificationPreferences.careRequests ? '#fff' : '#f4f3f4'}
                  disabled={loadingNotifications}
                />
              </View>

              {/* Weekly Reports */}
              <View style={styles.preferenceItem}>
                <View style={styles.preferenceContent}>
                  <Text style={styles.preferenceLabel}>Weekly Reports</Text>
                  <Text style={styles.preferenceDescription}>
                    Get weekly wellness summary reports
                  </Text>
                </View>
                <Switch
                  value={notificationPreferences.weeklyReports}
                  onValueChange={(value) => {
                    const newPrefs = { ...notificationPreferences, weeklyReports: value };
                    setNotificationPreferences(newPrefs);
                    debouncedSaveNotificationPreferences(newPrefs);
                  }}
                  trackColor={{ false: '#ccc', true: theme.colors.primary }}
                  thumbColor={notificationPreferences.weeklyReports ? '#fff' : '#f4f3f4'}
                  disabled={loadingNotifications}
                />
              </View>

              {/* Daily Summaries */}
              <View style={styles.preferenceItem}>
                <View style={styles.preferenceContent}>
                  <Text style={styles.preferenceLabel}>Daily Summaries</Text>
                  <Text style={styles.preferenceDescription}>
                    Get daily activity and wellness summaries (9 PM)
                  </Text>
                </View>
                <Switch
                  value={notificationPreferences.dailySummaries}
                  onValueChange={(value) => {
                    const newPrefs = { ...notificationPreferences, dailySummaries: value };
                    setNotificationPreferences(newPrefs);
                    debouncedSaveNotificationPreferences(newPrefs);
                  }}
                  trackColor={{ false: '#ccc', true: theme.colors.primary }}
                  thumbColor={notificationPreferences.dailySummaries ? '#fff' : '#f4f3f4'}
                  disabled={loadingNotifications}
                />
              </View>
            </>
          )}

          {loadingNotifications && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Updating preferences...</Text>
            </View>
          )}
        </View>
      </View>

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
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInputField}
                placeholder="Current Password"
                secureTextEntry={!showCurrentPassword}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                <Text style={styles.eyeIcon}>{showCurrentPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInputField}
                placeholder="New Password (min 8 characters)"
                secureTextEntry={!showNewPassword}
                value={newPassword}
                onChangeText={setNewPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowNewPassword(!showNewPassword)}
              >
                <Text style={styles.eyeIcon}>{showNewPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInputField}
                placeholder="Confirm New Password"
                secureTextEntry={!showConfirmNewPassword}
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
              >
                <Text style={styles.eyeIcon}>{showConfirmNewPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
            
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
  joinRequestsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  joinRequestsContent: {
    flex: 1,
  },
  joinRequestsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: 2,
  },
  joinRequestsSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  joinRequestsArrow: {
    fontSize: 20,
    color: theme.colors.primary,
    fontWeight: '600',
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
  preferencesContainer: {
    gap: 16,
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  preferenceContent: {
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
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    marginBottom: 12,
  },
  passwordInputField: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  eyeIcon: {
    fontSize: 18,
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
});