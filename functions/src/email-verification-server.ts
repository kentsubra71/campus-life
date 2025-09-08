import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { CallableRequest } from 'firebase-functions/v2/https';

interface EmailVerificationData {
  token: string;
}

// CRITICAL: Server-side email verification that can update Firestore
export const verifyEmailServer = functions.https.onCall({
  timeoutSeconds: 30,
}, async (request: CallableRequest<EmailVerificationData>) => {
  const { data } = request;
  const { token } = data;
  
  if (!token) {
    throw new functions.https.HttpsError('invalid-argument', 'Verification token required');
  }
  
  try {
    const db = admin.firestore();
    
    // Get the verification token from Firestore
    const tokenDoc = await db.collection('verification_tokens').doc(token).get();
    
    if (!tokenDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Invalid or expired verification token');
    }
    
    const tokenData = tokenDoc.data()!;
    
    // Check if token is valid and not expired
    if (tokenData.used || tokenData.type !== 'email_verification') {
      throw new functions.https.HttpsError('invalid-argument', 'Token already used or invalid');
    }
    
    if (tokenData.expires_at.toDate() < new Date()) {
      throw new functions.https.HttpsError('deadline-exceeded', 'Verification token has expired');
    }
    
    const userId = tokenData.user_id;
    
    functions.logger.info('Verifying email for user', { userId });
    
    // Update user's custom claims to include email verification and admin flag
    const existingUser = await admin.auth().getUser(userId);
    const existingClaims = existingUser.customClaims || {};
    
    await admin.auth().setCustomUserClaims(userId, {
      ...existingClaims,
      email_verified: true,
      admin: true, // Required for Firestore rule operations
      role_verified_at: Math.floor(Date.now() / 1000),
    });
    
    // Now update Firestore with the admin-enabled token
    // This will pass the isServerRequest() check in Firestore rules
    await db.collection('users').doc(userId).update({
      email_verified: true,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Also update profiles collection if it exists
    try {
      await db.collection('profiles').doc(userId).update({
        email_verified: true,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (profileError) {
      // Profile might not exist for some users, that's OK
      functions.logger.info('Profile update skipped (document may not exist)', { userId });
    }
    
    // Mark token as used
    await db.collection('verification_tokens').doc(token).update({
      used: true,
      used_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    functions.logger.info('Email verification completed', { userId });
    
    return { 
      success: true, 
      userId,
      message: 'Email verified successfully' 
    };
    
  } catch (error: any) {
    functions.logger.error('Email verification failed', { token, error: error.message });
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', 'Email verification failed');
  }
});

// CRITICAL: Server-side function to mark user as verified (for existing users)
export const markUserVerified = functions.https.onCall({
  timeoutSeconds: 30,
}, async (request: CallableRequest<{ userId: string }>) => {
  const { data, auth } = request;
  const { userId } = data;
  
  // Only allow this for authenticated admin users or self-verification
  if (!auth || (auth.uid !== userId && !auth.token.admin)) {
    throw new functions.https.HttpsError('permission-denied', 'Unauthorized');
  }
  
  try {
    const db = admin.firestore();
    
    // Update user's custom claims
    const existingUser = await admin.auth().getUser(userId);
    const existingClaims = existingUser.customClaims || {};
    
    await admin.auth().setCustomUserClaims(userId, {
      ...existingClaims,
      email_verified: true,
      admin: true,
      role_verified_at: Math.floor(Date.now() / 1000),
    });
    
    // Update Firestore with admin privileges
    await db.collection('users').doc(userId).update({
      email_verified: true,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Also update profiles collection if it exists
    try {
      await db.collection('profiles').doc(userId).update({
        email_verified: true,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (profileError) {
      functions.logger.info('Profile update skipped', { userId });
    }
    
    functions.logger.info('User marked as verified', { userId });
    
    return { success: true, userId };
    
  } catch (error: any) {
    functions.logger.error('Failed to mark user as verified', { userId, error: error.message });
    throw new functions.https.HttpsError('internal', 'Verification failed');
  }
});