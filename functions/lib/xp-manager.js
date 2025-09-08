"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserProgress = exports.awardXPForAction = exports.updateUserXP = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// Calculate level from total XP
function calculateLevel(totalXP) {
    // Level progression: 100 XP for level 1, +50 XP per subsequent level
    // Level 1: 0-99 XP, Level 2: 100-149 XP, Level 3: 150-199 XP, etc.
    if (totalXP < 100)
        return 1;
    return Math.floor((totalXP - 100) / 50) + 2;
}
// CRITICAL: Server-side XP management to prevent cheating
exports.updateUserXP = functions.https.onCall(async (data, context) => {
    const { userId, experienceGained, reason, source } = data;
    // Verify authentication and authorization
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }
    // Only allow users to update their own XP
    if (context.auth.uid !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Can only update own XP');
    }
    // Validate input
    if (!userId || typeof experienceGained !== 'number' || !reason) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid XP update data');
    }
    // Prevent negative XP or excessive XP gains (max 100 per action)
    if (experienceGained < 0 || experienceGained > 100) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid XP amount (0-100 allowed)');
    }
    try {
        const db = admin.firestore();
        // Get current user progress
        const progressRef = db.collection('user_progress').doc(userId);
        const currentProgress = await progressRef.get();
        let currentXP = 0;
        let currentLevel = 1;
        if (currentProgress.exists) {
            const data = currentProgress.data();
            currentXP = data.experience || 0;
            currentLevel = data.level || 1;
        }
        // Calculate new totals
        const newXP = currentXP + experienceGained;
        const newLevel = calculateLevel(newXP);
        const leveledUp = newLevel > currentLevel;
        // Update user progress with admin privileges
        await progressRef.set({
            user_id: userId,
            experience: newXP,
            level: newLevel,
            last_updated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        // Log XP transaction for audit trail
        await db.collection('xp_transactions').add({
            user_id: userId,
            experience_gained: experienceGained,
            total_experience: newXP,
            level_before: currentLevel,
            level_after: newLevel,
            reason,
            source: source || 'unknown',
            leveled_up: leveledUp,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        functions.logger.info('XP updated', {
            userId,
            experienceGained,
            newXP,
            newLevel,
            leveledUp,
            reason
        });
        return {
            success: true,
            newExperience: newXP,
            newLevel,
            leveledUp,
            experienceGained
        };
    }
    catch (error) {
        functions.logger.error('Failed to update XP', { userId, error: error.message });
        throw new functions.https.HttpsError('internal', 'XP update failed');
    }
});
// CRITICAL: Award XP for specific actions (called by other Cloud Functions)
exports.awardXPForAction = functions.https.onCall(async (data, context) => {
    const { userId, action } = data;
    // Define XP rewards for different actions
    const xpRewards = {
        'wellness_logged': { xp: 10, reason: 'Daily wellness entry logged' },
        'first_wellness': { xp: 25, reason: 'First wellness entry bonus' },
        'streak_3_days': { xp: 15, reason: '3-day wellness streak bonus' },
        'streak_7_days': { xp: 30, reason: '7-day wellness streak bonus' },
        'streak_30_days': { xp: 100, reason: '30-day wellness streak bonus' },
        'profile_complete': { xp: 20, reason: 'Profile completion bonus' },
        'family_joined': { xp: 15, reason: 'Successfully joined family' }
    };
    const reward = xpRewards[action];
    if (!reward) {
        throw new functions.https.HttpsError('invalid-argument', 'Unknown action type');
    }
    try {
        // Directly call the internal XP update logic with admin privileges
        const db = admin.firestore();
        // Get current user progress
        const progressRef = db.collection('user_progress').doc(userId);
        const currentProgress = await progressRef.get();
        let currentXP = 0;
        let currentLevel = 1;
        if (currentProgress.exists) {
            const data = currentProgress.data();
            currentXP = data.experience || 0;
            currentLevel = data.level || 1;
        }
        // Calculate new totals
        const newXP = currentXP + reward.xp;
        const newLevel = calculateLevel(newXP);
        const leveledUp = newLevel > currentLevel;
        // Update user progress with admin privileges
        await progressRef.set({
            user_id: userId,
            experience: newXP,
            level: newLevel,
            last_updated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        // Log XP transaction for audit trail
        await db.collection('xp_transactions').add({
            user_id: userId,
            experience_gained: reward.xp,
            total_experience: newXP,
            level_before: currentLevel,
            level_after: newLevel,
            reason: reward.reason,
            source: 'system_reward',
            leveled_up: leveledUp,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        const result = {
            success: true,
            newExperience: newXP,
            newLevel,
            leveledUp,
            experienceGained: reward.xp
        };
        functions.logger.info('XP awarded for action', { userId, action, xp: reward.xp });
        return result;
    }
    catch (error) {
        functions.logger.error('Failed to award XP', { userId, action, error: error.message });
        throw new functions.https.HttpsError('internal', 'XP award failed');
    }
});
// CRITICAL: Get user progress (read-only)
exports.getUserProgress = functions.https.onCall(async (data, context) => {
    const { userId } = data;
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }
    // Only allow users to read their own progress
    if (context.auth.uid !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Can only access own progress');
    }
    try {
        const db = admin.firestore();
        const progressDoc = await db.collection('user_progress').doc(userId).get();
        if (!progressDoc.exists) {
            return {
                user_id: userId,
                experience: 0,
                level: 1,
                exists: false
            };
        }
        const progress = progressDoc.data();
        return {
            user_id: progress.user_id,
            experience: progress.experience,
            level: progress.level,
            last_updated: progress.last_updated,
            exists: true
        };
    }
    catch (error) {
        functions.logger.error('Failed to get user progress', { userId, error: error.message });
        throw new functions.https.HttpsError('internal', 'Failed to get progress');
    }
});
//# sourceMappingURL=xp-manager.js.map