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

// Mark user as verified in Firestore
export const markUserAsVerified = async (userId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      email_verified: true,
      updated_at: Timestamp.now()
    });
    
    // Also update profiles collection if it exists
    try {
      await updateDoc(doc(db, 'profiles', userId), {
        email_verified: true,
        updated_at: Timestamp.now()
      });
    } catch (profileError) {
      // Profile might not exist for parents, that's OK
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Complete email verification process
export const completeEmailVerification = async (token: string): Promise<{
  success: boolean;
  userId?: string;
  error?: string;
}> => {
  try {
    const tokenResult = await verifyToken(token);
    
    if (!tokenResult.valid || tokenResult.type !== 'email_verification') {
      return { success: false, error: tokenResult.error || 'Invalid verification token' };
    }
    
    const markResult = await markUserAsVerified(tokenResult.userId!);
    
    if (!markResult.success) {
      return { success: false, error: markResult.error };
    }
    
    return { success: true, userId: tokenResult.userId };
  } catch (error: any) {
    return { success: false, error: error.message };
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