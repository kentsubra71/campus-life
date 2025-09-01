// Test utility to verify email verification enforcement
import { getCurrentUser, getUserProfile } from './firebase';

export const checkEmailVerificationRequired = async (action: string): Promise<{
  canProceed: boolean;
  error?: string;
  user?: any;
}> => {
  try {
    const user = getCurrentUser();
    if (!user) {
      return { 
        canProceed: false, 
        error: 'User not authenticated' 
      };
    }

    const userProfile = await getUserProfile(user.uid);
    if (!userProfile?.email_verified) {
      return { 
        canProceed: false, 
        error: `Email verification required to ${action}. Please verify your email address first.`,
        user: { id: user.uid, email: user.email, emailVerified: false }
      };
    }

    return { 
      canProceed: true, 
      user: { id: user.uid, email: user.email, emailVerified: true }
    };
  } catch (error: any) {
    return { 
      canProceed: false, 
      error: error.message || 'Error checking email verification status' 
    };
  }
};