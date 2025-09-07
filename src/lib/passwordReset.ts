import { auth, db } from './firebase';
import { doc, getDoc, updateDoc, query, collection, where, getDocs, Timestamp } from 'firebase/firestore';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, signInAnonymously } from 'firebase/auth';
import { createVerificationToken, sendVerificationEmail, verifyToken } from './emailVerification';

// Request password reset
export const requestPasswordReset = async (email: string): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    // Check if user exists with this email
    const usersQuery = query(collection(db, 'users'), where('email', '==', email));
    const userSnapshot = await getDocs(usersQuery);
    
    if (userSnapshot.empty) {
      // Don't reveal if email exists or not for security
      return { success: true }; // Always return success
    }
    
    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    
    // Create password reset token
    const tokenResult = await createVerificationToken(
      userDoc.id,
      email,
      'password_reset'
    );
    
    if (tokenResult.error) {
      return { success: false, error: tokenResult.error };
    }
    
    // Send password reset email
    const emailResult = await sendVerificationEmail(
      email,
      userData.full_name,
      tokenResult.token,
      'password_reset'
    );
    
    return emailResult;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Verify password reset token
export const verifyPasswordResetToken = async (token: string): Promise<{
  valid: boolean;
  userId?: string;
  email?: string;
  error?: string;
}> => {
  try {
    const result = await verifyToken(token);
    
    if (!result.valid || result.type !== 'password_reset') {
      return { valid: false, error: 'Invalid or expired reset token' };
    }
    
    return {
      valid: true,
      userId: result.userId,
      email: result.email
    };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
};

// Reset password with token (for users who are logged out)
export const resetPasswordWithToken = async (
  token: string,
  newPassword: string
): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    // Use HTTP endpoint for password reset (no authentication required)
    const response = await fetch('https://us-central1-campus-life-b0fd3.cloudfunctions.net/resetPasswordHttp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        newPassword
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      return { success: true };
    } else {
      return { success: false, error: data.error || 'Failed to reset password' };
    }
  } catch (error: any) {
    console.error('Reset password error:', error);
    return { success: false, error: 'Network error. Please check your internet connection and try again.' };
  }
};

// Change password for authenticated users
export const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const user = auth.currentUser;
    
    if (!user || !user.email) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // Check if new password is different from current password
    if (currentPassword === newPassword) {
      return { success: false, error: 'New password must be different from current password' };
    }
    
    // Re-authenticate user with current password
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    
    // Update password
    await updatePassword(user, newPassword);
    
    // Clear any pending password reset flags
    await updateDoc(doc(db, 'users', user.uid), {
      password_reset_pending: false,
      password_reset_token: null,
      password_reset_requested_at: null,
      updated_at: Timestamp.now()
    });

    // Send password change confirmation email
    try {
      await fetch('https://us-central1-campus-life-b0fd3.cloudfunctions.net/sendPasswordChangeConfirmationHttp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          userId: user.uid
        })
      });
    } catch (emailError) {
      console.log('Failed to send password change confirmation email:', emailError);
      // Don't fail password change if email fails
    }
    
    return { success: true };
  } catch (error: any) {
    let errorMessage = error.message;
    
    // Handle specific Firebase auth errors
    switch (error.code) {
      case 'auth/wrong-password':
        errorMessage = 'Current password is incorrect';
        break;
      case 'auth/weak-password':
        errorMessage = 'New password is too weak. Please choose a stronger password';
        break;
      case 'auth/requires-recent-login':
        errorMessage = 'Please log out and log back in before changing your password';
        break;
      default:
        errorMessage = 'Failed to update password. Please try again';
    }
    
    return { success: false, error: errorMessage };
  }
};

// Check if user has a pending password reset
export const checkPendingPasswordReset = async (userId: string): Promise<{
  hasPendingReset: boolean;
  token?: string;
  error?: string;
}> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      return { hasPendingReset: false, error: 'User not found' };
    }
    
    const userData = userDoc.data();
    
    return {
      hasPendingReset: userData.password_reset_pending || false,
      token: userData.password_reset_token
    };
  } catch (error: any) {
    return { hasPendingReset: false, error: error.message };
  }
};