import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Simple server-side email verification that can bypass Firestore rules
export const markUserVerified = functions.https.onCall(async (data, context) => {
  const { userId } = data;
  
  // Only allow authenticated users to verify themselves
  if (!context.auth || context.auth.uid !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'Unauthorized');
  }

  try {
    const db = admin.firestore();
    
    // Update user's custom claims first
    const existingUser = await admin.auth().getUser(userId);
    const existingClaims = existingUser.customClaims || {};
    
    await admin.auth().setCustomUserClaims(userId, {
      ...existingClaims,
      email_verified: true,
      admin: true, // Required for Firestore rule operations
      role_verified_at: Math.floor(Date.now() / 1000),
    });
    
    // Then update Firestore (now has admin privileges)
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
      // Profile might not exist, that's OK
    }
    
    functions.logger.info('User marked as verified', { userId });
    return { success: true, userId };
    
  } catch (error: any) {
    functions.logger.error('Failed to mark user as verified', { userId, error: error.message });
    throw new functions.https.HttpsError('internal', 'Verification failed');
  }
});

// Simple XP update function that bypasses client rules
export const updateUserXP = functions.https.onCall(async (data, context) => {
  const { userId, experienceGained, reason } = data;
  
  // Only allow authenticated users to update their own XP
  if (!context.auth || context.auth.uid !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'Unauthorized');
  }
  
  // Validate input
  if (!userId || typeof experienceGained !== 'number' || !reason) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid XP update data');
  }
  
  // Prevent excessive XP gains (max 100 per action)
  if (experienceGained < 0 || experienceGained > 100) {
    throw new functions.https.HttpsError('invalid-argument', 'XP gain must be between 0-100');
  }
  
  try {
    const db = admin.firestore();
    
    // Get current progress
    const progressRef = db.collection('user_progress').doc(userId);
    const currentProgress = await progressRef.get();
    
    let currentXP = 0;
    let currentLevel = 1;
    
    if (currentProgress.exists) {
      const data = currentProgress.data()!;
      currentXP = data.experience || 0;
      currentLevel = data.level || 1;
    }
    
    // Calculate new values
    const newXP = currentXP + experienceGained;
    const newLevel = Math.floor((newXP - 100) / 50) + 2; // Simple level calculation
    const leveledUp = newLevel > currentLevel;
    
    // Update with server privileges
    await progressRef.set({
      user_id: userId,
      experience: newXP,
      level: Math.max(newLevel, 1),
      last_updated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    functions.logger.info('XP updated', { userId, experienceGained, newXP, newLevel });
    
    return {
      success: true,
      newExperience: newXP,
      newLevel: Math.max(newLevel, 1),
      leveledUp,
      experienceGained
    };
    
  } catch (error: any) {
    functions.logger.error('Failed to update XP', { userId, error: error.message });
    throw new functions.https.HttpsError('internal', 'XP update failed');
  }
});

// Simple function to get user progress
export const getUserProgress = functions.https.onCall(async (data, context) => {
  const { userId } = data;
  
  // Only allow authenticated users to get their own progress
  if (!context.auth || context.auth.uid !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'Unauthorized');
  }
  
  try {
    const db = admin.firestore();
    const progressDoc = await db.collection('user_progress').doc(userId).get();
    
    if (!progressDoc.exists) {
      return {
        exists: false,
        experience: 0,
        level: 1
      };
    }
    
    const progress = progressDoc.data()!;
    
    return {
      exists: true,
      experience: progress.experience || 0,
      level: progress.level || 1
    };
    
  } catch (error: any) {
    functions.logger.error('Failed to get user progress', { userId, error: error.message });
    throw new functions.https.HttpsError('internal', 'Failed to get progress');
  }
});