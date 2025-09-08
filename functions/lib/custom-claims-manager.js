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
exports.onUserUpdated = exports.onUserCreated = exports.setUserClaims = void 0;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
// CRITICAL: Set custom claims after user verification
exports.setUserClaims = functions.https.onCall({
    timeoutSeconds: 30,
}, async (request) => {
    var _a, _b;
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
            ? (_a = familyData === null || familyData === void 0 ? void 0 : familyData.parentIds) === null || _a === void 0 ? void 0 : _a.includes(uid)
            : (_b = familyData === null || familyData === void 0 ? void 0 : familyData.studentIds) === null || _b === void 0 ? void 0 : _b.includes(uid);
        if (!isAuthorized) {
            throw new functions.https.HttpsError('permission-denied', 'Not authorized for this family');
        }
        // Set custom claims with admin flag for server operations
        const claims = {
            family_id,
            user_type,
            email_verified: true,
            role_verified_at: Math.floor(Date.now() / 1000),
            admin: true, // Required for Firestore rule admin operations
        };
        await admin.auth().setCustomUserClaims(uid, claims);
        functions.logger.info('Custom claims set', { uid, family_id, user_type });
        return { success: true };
    }
    catch (error) {
        functions.logger.error('Failed to set custom claims', { uid, error });
        throw error;
    }
});
// Trigger to automatically set claims on user creation
exports.onUserCreated = functions.identity.beforeUserCreated(async (event) => {
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
        if (!(userData === null || userData === void 0 ? void 0 : userData.family_id) || !(userData === null || userData === void 0 ? void 0 : userData.user_type)) {
            functions.logger.warn('Incomplete user data', { uid: user.uid });
            return;
        }
        // Set initial claims (will be updated after email verification)
        const claims = {
            family_id: userData.family_id,
            user_type: userData.user_type,
            email_verified: user.emailVerified,
            admin: true, // Required for server operations
        };
        await admin.auth().setCustomUserClaims(user.uid, claims);
        functions.logger.info('Initial claims set for new user', {
            uid: user.uid,
            family_id: userData.family_id,
            user_type: userData.user_type
        });
    }
    catch (error) {
        functions.logger.error('Failed to set initial claims', { uid: user.uid, error });
    }
});
// Update claims on email verification
exports.onUserUpdated = functions.identity.beforeUserSignedIn(async (event) => {
    const user = event.data;
    // Check if email verification is needed
    if (user.emailVerified) {
        try {
            const existingClaims = user.customClaims || {};
            await admin.auth().setCustomUserClaims(user.uid, Object.assign(Object.assign({}, existingClaims), { email_verified: true, role_verified_at: Math.floor(Date.now() / 1000), admin: true }));
            functions.logger.info('Claims updated for email verification', { uid: user.uid });
        }
        catch (error) {
            functions.logger.error('Failed to update claims on email verification', {
                uid: user.uid,
                error
            });
        }
    }
});
//# sourceMappingURL=custom-claims-manager.js.map