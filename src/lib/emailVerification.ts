import { db } from './firebase';
import { doc, setDoc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import * as Crypto from 'expo-crypto';

export interface VerificationToken {
  token: string;
  user_id: string;
  email: string;
  type: 'email_verification' | 'password_reset';
  expires_at: Timestamp;
  used: boolean;
  created_at: Timestamp;
}

// Generate secure verification token
export const generateVerificationToken = async (): Promise<string> => {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${Date.now()}-${Math.random()}-${Math.random()}`
  );
};

// Create verification token in Firestore
export const createVerificationToken = async (
  userId: string, 
  email: string, 
  type: 'email_verification' | 'password_reset'
): Promise<{ token: string; error?: string }> => {
  try {
    // First, invalidate any existing tokens of the same type for this user
    const { query, collection, where, getDocs, updateDoc } = await import('firebase/firestore');
    const existingTokensQuery = query(
      collection(db, 'verification_tokens'), 
      where('user_id', '==', userId),
      where('type', '==', type),
      where('used', '==', false)
    );
    
    const existingTokens = await getDocs(existingTokensQuery);
    const invalidationPromises = existingTokens.docs.map(tokenDoc => 
      updateDoc(tokenDoc.ref, { 
        used: true, 
        invalidated_at: Timestamp.now(),
        invalidated_reason: 'new_token_requested'
      })
    );
    
    if (invalidationPromises.length > 0) {
      await Promise.all(invalidationPromises);
      console.log(`Invalidated ${invalidationPromises.length} existing ${type} tokens for user ${userId}`);
    }

    const token = await generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    const verificationToken: VerificationToken = {
      token,
      user_id: userId,
      email,
      type,
      expires_at: Timestamp.fromDate(expiresAt),
      used: false,
      created_at: Timestamp.now()
    };

    await setDoc(doc(db, 'verification_tokens', token), verificationToken);
    
    return { token };
  } catch (error: any) {
    return { token: '', error: error.message };
  }
};

// Verify token and return user info
export const verifyToken = async (token: string): Promise<{
  valid: boolean;
  userId?: string;
  email?: string;
  type?: string;
  error?: string;
}> => {
  try {
    const tokenDoc = await getDoc(doc(db, 'verification_tokens', token));
    
    if (!tokenDoc.exists()) {
      return { valid: false, error: 'Invalid token' };
    }
    
    const tokenData = tokenDoc.data() as VerificationToken;
    
    // Check if token is already used
    if (tokenData.used) {
      return { valid: false, error: 'Token already used' };
    }
    
    // Check if token is expired
    if (tokenData.expires_at.toDate() < new Date()) {
      return { valid: false, error: 'Token expired' };
    }
    
    // Mark token as used
    await updateDoc(doc(db, 'verification_tokens', token), { used: true });
    
    return {
      valid: true,
      userId: tokenData.user_id,
      email: tokenData.email,
      type: tokenData.type
    };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
};

// Send verification email using Resend
export const sendVerificationEmail = async (
  email: string,
  fullName: string,
  token: string,
  type: 'email_verification' | 'password_reset'
): Promise<{ success: boolean; error?: string; messageId?: string }> => {
  try {
    const verificationUrl = `https://campus-life-auth-website.vercel.app/verify/${type}/${token}`;
    
    if (type === 'password_reset') {
      // Use HTTP endpoint for password reset (unauthenticated)
      const response = await fetch('https://us-central1-campus-life-b0fd3.cloudfunctions.net/sendPasswordResetEmailHttp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: email,
          emailData: {
            name: fullName,
            verificationUrl,
            token
          }
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ ${type} email sent to ${email}, Message ID: ${data.messageId}`);
      } else {
        console.error(`❌ Failed to send ${type} email to ${email}:`, data.error);
      }
      
      return {
        success: data.success,
        messageId: data.messageId,
        error: data.error
      };
    } else {
      // Use callable function for email verification (authenticated)
      const { functions } = await import('./firebase');
      const { httpsCallable } = await import('firebase/functions');
      
      const sendEmailFunction = httpsCallable(functions, 'sendEmail');
      const result = await sendEmailFunction({
        to: email,
        type,
        emailData: {
          name: fullName,
          verificationUrl,
          token
        }
      });
      
      const data = result.data as any;
      const finalResult = {
        success: data.success,
        messageId: data.messageId,
        error: data.error
      };
      
      if (finalResult.success) {
        console.log(`✅ ${type} email sent to ${email}, Message ID: ${finalResult.messageId}`);
      } else {
        console.error(`❌ Failed to send ${type} email to ${email}:`, finalResult.error);
      }
      
      return finalResult;
    }
  } catch (error: any) {
    console.error('Email sending failed:', error);
    
    // Handle specific function not found errors
    if (error.code === 'functions/not-found') {
      return { 
        success: false, 
        error: 'Email service is temporarily unavailable. Please try again later.' 
      };
    }
    
    return { success: false, error: error.message };
  }
};

// FIXED: Mark user as verified using secure Cloud Function
export const markUserAsVerified = async (userId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { httpsCallable } = await import('firebase/functions');
    const { functions } = await import('./firebase');
    
    const markUserVerified = httpsCallable(functions, 'markUserVerified');
    const result = await markUserVerified({ userId });
    
    return { success: true };
  } catch (error: any) {
    console.error('Failed to mark user as verified:', error);
    return { success: false, error: error.message };
  }
};

// FIXED: Complete email verification using secure Cloud Function
export const completeEmailVerification = async (token: string): Promise<{
  success: boolean;
  userId?: string;
  error?: string;
}> => {
  try {
    const { httpsCallable } = await import('firebase/functions');
    const { functions } = await import('./firebase');
    
    const verifyEmailServer = httpsCallable(functions, 'verifyEmailServer');
    const result = await verifyEmailServer({ token }) as any;
    
    console.log('✅ Email verification completed for user:', result.data.userId);
    
    return { 
      success: true, 
      userId: result.data.userId 
    };
  } catch (error: any) {
    console.error('Email verification failed:', error);
    
    // Extract error message from Cloud Function error
    const errorMessage = error.message || error.details || 'Email verification failed';
    
    return { 
      success: false, 
      error: errorMessage 
    };
  }
};

// Resend verification email
export const resendVerificationEmail = async (userId: string): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      return { success: false, error: 'User not found' };
    }
    
    const userData = userDoc.data();
    
    if (userData.email_verified) {
      return { success: false, error: 'Email already verified' };
    }
    
    const { token, error } = await createVerificationToken(
      userId, 
      userData.email, 
      'email_verification'
    );
    
    if (error) {
      return { success: false, error };
    }
    
    const emailResult = await sendVerificationEmail(
      userData.email,
      userData.full_name,
      token,
      'email_verification'
    );
    
    return emailResult;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};