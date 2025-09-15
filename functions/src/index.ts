import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { Expo } from 'expo-server-sdk';
import { defineSecret } from 'firebase-functions/params';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Export auth trigger functions
export * from './auth-triggers';

// Email service secret definition using Firebase Secret Manager
const RESEND_API_KEY = defineSecret('campus-life-resend-prod');

// Debug logging function for email functions
const debugLog = (functionName: string, message: string, data?: any) => {
  console.log(`🔍 [${functionName}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

// SECURITY: Email verification function
export const markUserVerified = functions.https.onCall(async (data, context) => {
  const { userId } = data;

  if (!context.auth || context.auth.uid !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'Unauthorized');
  }

  try {
    // Update user's custom claims to include admin flag
    const existingUser = await admin.auth().getUser(userId);
    const existingClaims = existingUser.customClaims || {};

    await admin.auth().setCustomUserClaims(userId, {
      ...existingClaims,
      email_verified: true,
      admin: true, // Required for Firestore rule operations
      role_verified_at: Math.floor(Date.now() / 1000),
    });

    // Update Firestore with admin privileges
    await db.collection('users').doc(userId).update({
      email_verified: true,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, userId };

  } catch (error: any) {
    functions.logger.error('Failed to mark user as verified', { userId, error: error.message });
    throw new functions.https.HttpsError('internal', 'Verification failed');
  }
});

// SECURITY: Delete account function - handles complete account deletion with admin privileges
export const deleteAccount = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = context.auth.uid;

  try {
    // Grant temporary admin privileges for cleanup
    await admin.auth().setCustomUserClaims(userId, {
      admin: true,
      cleanup_mode: true,
      cleanup_started_at: Math.floor(Date.now() / 1000)
    });

    // Wait briefly for claims to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get all user's data for cleanup
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (userData) {
      // Clean up family associations
      if (userData.family_id) {
        const familyRef = db.collection('families').doc(userData.family_id);
        const familyDoc = await familyRef.get();

        if (familyDoc.exists) {
          const familyData = familyDoc.data();

          if (familyData) {
            // Remove user from family arrays
            const updatedParentIds = (familyData.parentIds || []).filter((id: string) => id !== userId);
            const updatedStudentIds = (familyData.studentIds || []).filter((id: string) => id !== userId);

            await familyRef.update({
              parentIds: updatedParentIds,
              studentIds: updatedStudentIds,
              updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
      }

      // Clean up user's subcollections
      const collections = ['wellness_entries', 'notifications', 'activities'];
      for (const collectionName of collections) {
        const subcollectionRef = db.collection('users').doc(userId).collection(collectionName);
        const snapshot = await subcollectionRef.get();

        // Delete all documents in batches
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }

      // Clean up related documents in other collections
      const paymentsSnapshot = await db.collection('payments').where('parent_id', '==', userId).get();
      const paymentsBatch = db.batch();
      paymentsSnapshot.docs.forEach(doc => paymentsBatch.delete(doc.ref));
      await paymentsBatch.commit();

      const studentPaymentsSnapshot = await db.collection('payments').where('student_id', '==', userId).get();
      const studentPaymentsBatch = db.batch();
      studentPaymentsSnapshot.docs.forEach(doc => studentPaymentsBatch.delete(doc.ref));
      await studentPaymentsBatch.commit();

      // Clean up transactions
      const transactionsParent = await db.collection('transactions').where('parentId', '==', userId).get();
      const transactionsBatchParent = db.batch();
      transactionsParent.docs.forEach(doc => transactionsBatchParent.delete(doc.ref));
      await transactionsBatchParent.commit();

      const transactionsStudent = await db.collection('transactions').where('studentId', '==', userId).get();
      const transactionsBatchStudent = db.batch();
      transactionsStudent.docs.forEach(doc => transactionsBatchStudent.delete(doc.ref));
      await transactionsBatchStudent.commit();
    }

    // Delete the user document from Firestore
    await db.collection('users').doc(userId).delete();

    // Finally, delete the auth user
    await admin.auth().deleteUser(userId);

    return { success: true, message: 'Account deleted successfully' };

  } catch (error: any) {
    functions.logger.error('Account deletion failed', { userId, error: error.message });
    throw new functions.https.HttpsError('internal', 'Failed to delete account');
  }
});

// SECURITY: Resend verification email function - handles email resend with admin privileges
const resendApiKeySecret = defineSecret('RESEND_API_KEY');
export const resendVerificationEmail = functions
  .runWith({ secrets: [resendApiKeySecret] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { email, firstName, role } = data;
    const userId = context.auth.uid;

    try {
      // Generate verification token
      const verificationToken = admin.auth().createCustomToken(userId, {
        email_verification: true,
        temp_verification: true,
        role: role
      });

      // Create verification URL
      const verificationUrl = `https://campus-life-b0fd3.web.app/verify-email?token=${await verificationToken}&email=${encodeURIComponent(email)}`;

      // Send email using Resend
      const response = await axios.post('https://api.resend.com/emails', {
        from: 'Campus Life <noreply@campuslife.app>',
        to: [email],
        subject: 'Verify Your Campus Life Account',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to Campus Life, ${firstName}!</h2>
            <p>Thank you for joining Campus Life. Please verify your email address to complete your ${role} account setup.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Verify Email Address
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              This link will expire in 24 hours. If you didn't create this account, you can safely ignore this email.
            </p>
          </div>
        `
      }, {
        headers: {
          'Authorization': `Bearer ${resendApiKeySecret.value()}`,
          'Content-Type': 'application/json'
        }
      });

      return { success: true, messageId: response.data.id };

    } catch (error: any) {
      functions.logger.error('Resend verification email failed', { userId, email, error: error.message });
      throw new functions.https.HttpsError('internal', 'Failed to send verification email');
    }
  });

// Initialize Expo SDK for push notifications
const expo = new Expo();

// Send Push Notification Function
export const sendPushNotification = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { userId, title, body, data: notificationData, type = 'general' } = data;

  try {
    // Get user's push token and notification preferences
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const userData = userDoc.data();
    const pushToken = userData?.pushToken;
    const preferences = userData?.notificationPreferences || {};

    // Check if user has notifications enabled for this type
    if (!checkNotificationTypeEnabled(type, preferences)) {
      return { success: true, skipped: true, reason: 'notifications_disabled_for_type' };
    }

    if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
      return { success: true, skipped: true, reason: 'no_valid_push_token' };
    }

    // Create the notification message
    const message = {
      to: pushToken,
      sound: 'default' as const,
      title,
      body,
      data: notificationData || {},
    };

    // Send the notification
    const tickets = await expo.sendPushNotificationsAsync([message]);
    const ticket = tickets[0];

    if (ticket.status === 'error') {
      throw new Error(`Push notification failed: ${ticket.message}`);
    }

    // Store notification in user's notifications subcollection
    await db.collection('users').doc(userId).collection('notifications').add({
      title,
      body,
      type,
      data: notificationData || {},
      status: 'sent',
      ticket_id: ticket.id,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      read: false
    });

    return {
      success: true,
      ticket: ticket.id,
      userId,
      type
    };

  } catch (error: any) {
    functions.logger.error('Push notification failed', {
      userId,
      type,
      error: error.message
    });

    throw new functions.https.HttpsError('internal', `Failed to send notification: ${error.message}`);
  }
});

// Helper function to check notification type preferences
function checkNotificationTypeEnabled(type: string, preferences: any): boolean {
  if (!preferences) return true;

  switch (type) {
    case 'support_received':
      return preferences.supportMessages !== false;
    case 'payment_received':
    case 'payment_status':
      return preferences.paymentUpdates !== false;
    case 'wellness_reminder':
      return preferences.wellnessReminders !== false;
    case 'care_request':
      return preferences.careRequests !== false;
    case 'weekly_report':
      return preferences.weeklyReports !== false;
    case 'daily_summary':
      return preferences.dailySummaries !== false;
    case 'student_wellness_logged':
      return preferences.studentWellnessLogged !== false;
    default:
      return true;
  }
}

// Send Email using Resend API (Secure)
export const sendEmail = functions
  .runWith({ secrets: [RESEND_API_KEY] })
  .https.onCall(async (data, context) => {
  debugLog('sendEmail', 'Function called', {
    userId: context.auth?.uid,
    hasAuth: !!context.auth,
    data: { ...data, verificationUrl: '[REDACTED]' }
  });

  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const {
    to,
    subject,
    htmlContent,
    from = 'Campus Life <noreply@campuslife.app>',
    type = 'general'
  } = data;

  if (!to || !subject || !htmlContent) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required email fields');
  }

  try {
    const response = await axios.post('https://api.resend.com/emails', {
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: htmlContent
    }, {
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY.value()}`,
        'Content-Type': 'application/json'
      }
    });

    debugLog('sendEmail', 'Email sent successfully', {
      messageId: response.data.id,
      to: Array.isArray(to) ? to : [to],
      subject,
      type
    });

    return {
      success: true,
      messageId: response.data.id,
      timestamp: new Date().toISOString()
    };

  } catch (error: any) {
    debugLog('sendEmail', 'Email sending failed', {
      error: error.response?.data || error.message,
      to,
      subject,
      type
    });

    throw new functions.https.HttpsError('internal', 'Failed to send email');
  }
});