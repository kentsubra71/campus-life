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
exports.refreshToken = exports.setFamilyClaims = exports.onUserCreated = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// FIXED: Set custom claims immediately after user creation
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
    try {
        functions.logger.info('New user created', { uid: user.uid, email: user.email });
        // Set basic custom claims immediately - don't wait for user document
        await admin.auth().setCustomUserClaims(user.uid, {
            email_verified: user.emailVerified,
            admin: true,
            initialized: Date.now(),
            // family_id and user_type will be set later when user joins/creates family
        });
        functions.logger.info('Initial custom claims set for new user', { uid: user.uid });
    }
    catch (error) {
        functions.logger.error('Failed to set initial custom claims', { uid: user.uid, error: error.message });
    }
});
// Email verification is handled by the existing markUserVerified function
// IMPROVED: Function to set family claims after family creation/joining
exports.setFamilyClaims = functions.https.onCall(async (data, context) => {
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
        await admin.auth().setCustomUserClaims(userId, Object.assign(Object.assign({}, existingClaims), { family_id: familyId, user_type: userType, family_joined_at: Math.floor(Date.now() / 1000), admin: true }));
        functions.logger.info('Family custom claims set', { userId, familyId, userType });
        return { success: true, message: 'Family claims set successfully' };
    }
    catch (error) {
        functions.logger.error('Failed to set family claims', { userId, familyId, error: error.message });
        throw new functions.https.HttpsError('internal', 'Failed to set family claims');
    }
});
// Utility function to force token refresh on client
exports.refreshToken = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    try {
        // Just return success - client will call getIdToken(true) to refresh
        return { success: true, message: 'Token refresh requested' };
    }
    catch (error) {
        throw new functions.https.HttpsError('internal', 'Failed to refresh token');
    }
});
//# sourceMappingURL=auth-triggers.js.map