import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { CallableRequest } from 'firebase-functions/v2/https';

interface UserClaims {
  family_id: string;
  user_type: 'parent' | 'student';
  email_verified: boolean;
  role_verified_at: number;
}

// CRITICAL: Set custom claims after user verification
export const setUserClaims = functions.https.onCall({
  timeoutSeconds: 30,
}, async (request: CallableRequest) => {
  const { data, auth } = request;
  // Only allow server-side calls (not client calls)
  if (!auth || !auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }
  
  const { uid, family_id, user_type } = data;
  
  try {
    // Verify user exists and email is verified
    const userRecord = await admin.auth().getUser(uid);
    if (!userRecord.emailVerified) {
      throw new functions.https.HttpsError('failed-precondition', 'Email not verified');
    }
    
    // Verify family exists and user has access
    const familyDoc = await admin.firestore()
      .collection('families')
      .doc(family_id)
      .get();
    
    if (!familyDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Family not found');
    }
    
    const familyData = familyDoc.data();
    const isAuthorized = user_type === 'parent' 
      ? familyData?.parentIds?.includes(uid)
      : familyData?.studentIds?.includes(uid);
    
    if (!isAuthorized) {
      throw new functions.https.HttpsError('permission-denied', 'Not authorized for this family');
    }
    
    // Set custom claims
    const claims: UserClaims = {
      family_id,
      user_type,
      email_verified: true,
      role_verified_at: Math.floor(Date.now() / 1000),
    };
    
    await admin.auth().setCustomUserClaims(uid, claims);
    
    functions.logger.info('Custom claims set', { uid, family_id, user_type });
    
    return { success: true };
    
  } catch (error) {
    functions.logger.error('Failed to set custom claims', { uid, error });
    throw error;
  }
});

// Trigger to automatically set claims on user creation
export const onUserCreated = functions.identity.beforeUserCreated(async (event) => {
  const user = event.data;
  try {
    // Wait for Firestore user document to be created
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(user.uid)
      .get();
    
    if (!userDoc.exists) {
      functions.logger.warn('User document not found', { uid: user.uid });
      return;
    }
    
    const userData = userDoc.data();
    if (!userData?.family_id || !userData?.user_type) {
      functions.logger.warn('Incomplete user data', { uid: user.uid });
      return;
    }
    
    // Set initial claims (will be updated after email verification)
    const claims: Partial<UserClaims> = {
      family_id: userData.family_id,
      user_type: userData.user_type,
      email_verified: user.emailVerified,
    };
    
    await admin.auth().setCustomUserClaims(user.uid, claims);
    
    functions.logger.info('Initial claims set for new user', { 
      uid: user.uid, 
      family_id: userData.family_id,
      user_type: userData.user_type 
    });
    
  } catch (error) {
    functions.logger.error('Failed to set initial claims', { uid: user.uid, error });
  }
});

// Update claims on email verification
export const onUserUpdated = functions.identity.beforeUserSignedIn(async (event) => {
  const user = event.data;
  
  // Check if email verification is needed
  if (user.emailVerified) {
    try {
      const existingClaims = user.customClaims || {};
      
      await admin.auth().setCustomUserClaims(user.uid, {
        ...existingClaims,
        email_verified: true,
        role_verified_at: Math.floor(Date.now() / 1000),
      });
      
      functions.logger.info('Claims updated for email verification', { uid: user.uid });
      
    } catch (error) {
      functions.logger.error('Failed to update claims on email verification', { 
        uid: user.uid, 
        error 
      });
    }
  }
});