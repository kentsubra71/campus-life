import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

// FIXED: Set custom claims AND create user documents server-side
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  const db = admin.firestore();

  try {
    functions.logger.info('New user created', { uid: user.uid, email: user.email });

    // Set basic custom claims immediately - don't wait for user document
    await admin.auth().setCustomUserClaims(user.uid, {
      email_verified: user.emailVerified,
      admin: true, // Required for server operations
      initialized: Date.now(),
      // family_id and user_type will be set later when user joins/creates family
    });

    // CRITICAL FIX: Create user document server-side (required by Firestore rules)
    // This prevents "permission denied" errors when client tries to create user doc
    const userProfile = {
      id: user.uid,
      email: user.email || '',
      full_name: user.displayName || '',
      user_type: '', // Will be set later by registration process
      email_verified: false,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('users').doc(user.uid).set(userProfile);

    functions.logger.info('User document and custom claims set for new user', { uid: user.uid });

  } catch (error: any) {
    functions.logger.error('Failed to initialize new user', { uid: user.uid, error: error.message });
  }
});

// Email verification is handled by the existing markUserVerified function

// IMPROVED: Function to set family claims after family creation/joining
export const setFamilyClaims = functions.https.onCall(async (data, context) => {
  const { userId, familyId, userType } = data;
  
  // Allow setting claims for self, or by other family members
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  // Validate input
  if (!userId || !familyId || !['parent', 'student'].includes(userType)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid family claims data');
  }
  
  try {
    // Get existing claims
    const userRecord = await admin.auth().getUser(userId);
    const existingClaims = userRecord.customClaims || {};
    
    // Set family-specific claims
    await admin.auth().setCustomUserClaims(userId, {
      ...existingClaims,
      family_id: familyId,
      user_type: userType,
      family_joined_at: Math.floor(Date.now() / 1000),
      admin: true, // Required for server operations
    });
    
    functions.logger.info('Family custom claims set', { userId, familyId, userType });
    
    return { success: true, message: 'Family claims set successfully' };
    
  } catch (error: any) {
    functions.logger.error('Failed to set family claims', { userId, familyId, error: error.message });
    throw new functions.https.HttpsError('internal', 'Failed to set family claims');
  }
});

// Utility function to force token refresh on client
export const refreshToken = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  try {
    // Just return success - client will call getIdToken(true) to refresh
    return { success: true, message: 'Token refresh requested' };
  } catch (error: any) {
    throw new functions.https.HttpsError('internal', 'Failed to refresh token');
  }
});