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
exports.markUserVerified = exports.verifyEmailServer = void 0;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
// CRITICAL: Server-side email verification that can update Firestore
exports.verifyEmailServer = functions.https.onCall({
    timeoutSeconds: 30,
}, async (request) => {
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
        const tokenData = tokenDoc.data();
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
        await admin.auth().setCustomUserClaims(userId, Object.assign(Object.assign({}, existingClaims), { email_verified: true, admin: true, role_verified_at: Math.floor(Date.now() / 1000) }));
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
        }
        catch (profileError) {
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
    }
    catch (error) {
        functions.logger.error('Email verification failed', { token, error: error.message });
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Email verification failed');
    }
});
// CRITICAL: Server-side function to mark user as verified (for existing users)
exports.markUserVerified = functions.https.onCall({
    timeoutSeconds: 30,
}, async (request) => {
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
        await admin.auth().setCustomUserClaims(userId, Object.assign(Object.assign({}, existingClaims), { email_verified: true, admin: true, role_verified_at: Math.floor(Date.now() / 1000) }));
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
        }
        catch (profileError) {
            functions.logger.info('Profile update skipped', { userId });
        }
        functions.logger.info('User marked as verified', { userId });
        return { success: true, userId };
    }
    catch (error) {
        functions.logger.error('Failed to mark user as verified', { userId, error: error.message });
        throw new functions.https.HttpsError('internal', 'Verification failed');
    }
});
//# sourceMappingURL=email-verification-server.js.map