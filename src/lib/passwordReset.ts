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
    // Import Firebase functions dynamically
    const { functions } = await import('./firebase');
    const { httpsCallable } = await import('firebase/functions');
    
    // Call the Cloud Function to reset the password
    const resetPasswordFunction = httpsCallable(functions, 'resetPassword');
    const result = await resetPasswordFunction({ token, newPassword });
    
    const data = result.data as any;
    
    if (data.success) {
      return { success: true };
    } else {
      return { success: false, error: data.message || 'Failed to reset password' };
    }
  } catch (error: any) {
    console.error('Reset password error:', error);
    
    // Handle specific Firebase function errors
    if (error.code === 'functions/not-found') {
      return { 
        success: false, 
        error: 'Password reset service is currently unavailable. Please try again later.' 
      };
    }
    
    if (error.code === 'functions/invalid-argument') {
      return { success: false, error: error.message };
    }
    
    if (error.code === 'functions/unauthenticated') {
      // For password reset, we need to temporarily authenticate
      // Let's try to sign in the user with a temporary method
      try {
        const tokenResult = await verifyPasswordResetToken(token);
        
        if (!tokenResult.valid) {
          return { success: false, error: tokenResult.error };
        }
        
        // Import signInAnonymously temporarily for the password reset
        const { signInAnonymously } = await import('firebase/auth');
        await signInAnonymously(auth);
        
        // Retry the function call
        const retryResult = await resetPasswordFunction({ token, newPassword });
        const retryData = retryResult.data as any;
        
        // Sign out the anonymous user
        await auth.signOut();
        
        return retryData.success 
          ? { success: true } 
          : { success: false, error: retryData.message || 'Failed to reset password' };
          
      } catch (retryError) {
        return { success: false, error: 'Unable to complete password reset. Please try again.' };
      }
    }
    
    return { success: false, error: error.message || 'Failed to reset password' };
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