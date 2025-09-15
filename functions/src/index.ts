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
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const userId = context.auth.uid;
  const { confirmationText } = data;

  // Require confirmation text for safety
  if (confirmationText !== 'DELETE') {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid confirmation text');
  }

  try {
    functions.logger.info(`Starting account deletion for user: ${userId}`);

    // Use a batch for all Firestore deletions
    const batch = db.batch();

    // Delete from users collection
    batch.delete(db.collection('users').doc(userId));

    // Delete from profiles collection
    batch.delete(db.collection('profiles').doc(userId));

    // Delete from user_progress collection
    batch.delete(db.collection('user_progress').doc(userId));

    // Delete wellness entries
    const wellnessEntries = await db.collection('wellness_entries').where('user_id', '==', userId).get();
    wellnessEntries.docs.forEach(doc => batch.delete(doc.ref));

    // Delete rewards
    const rewards = await db.collection('rewards').where('user_id', '==', userId).get();
    rewards.docs.forEach(doc => batch.delete(doc.ref));

    // Delete messages from user
    const messages = await db.collection('messages').where('from_user_id', '==', userId).get();
    messages.docs.forEach(doc => batch.delete(doc.ref));

    // Delete payments (parent)
    const paymentsParent = await db.collection('payments').where('parent_id', '==', userId).get();
    paymentsParent.docs.forEach(doc => batch.delete(doc.ref));

    // Delete payments (student)
    const paymentsStudent = await db.collection('payments').where('student_id', '==', userId).get();
    paymentsStudent.docs.forEach(doc => batch.delete(doc.ref));

    // Delete item requests (student)
    const itemRequestsStudent = await db.collection('item_requests').where('student_id', '==', userId).get();
    itemRequestsStudent.docs.forEach(doc => batch.delete(doc.ref));

    // Delete item requests (parent)
    const itemRequestsParent = await db.collection('item_requests').where('parent_id', '==', userId).get();
    itemRequestsParent.docs.forEach(doc => batch.delete(doc.ref));

    // Delete subscriptions
    const subscriptions = await db.collection('subscriptions').where('user_id', '==', userId).get();
    subscriptions.docs.forEach(doc => batch.delete(doc.ref));

    // Delete monthly spend
    const monthlySpend = await db.collection('monthly_spend').where('parent_id', '==', userId).get();
    monthlySpend.docs.forEach(doc => batch.delete(doc.ref));

    // Delete transactions (if they exist)
    try {
      const transactionsParent = await db.collection('transactions').where('parentId', '==', userId).get();
      transactionsParent.docs.forEach(doc => batch.delete(doc.ref));

      const transactionsStudent = await db.collection('transactions').where('studentId', '==', userId).get();
      transactionsStudent.docs.forEach(doc => batch.delete(doc.ref));
    } catch (error) {
      // Transactions collection might not exist, continue
      functions.logger.warn('Transactions collection not found, skipping');
    }

    // Delete support requests
    const supportRequests = await db.collection('support_requests').where('from_user_id', '==', userId).get();
    supportRequests.docs.forEach(doc => batch.delete(doc.ref));

    // Delete push tokens
    const pushTokens = await db.collection('push_tokens').where('userId', '==', userId).get();
    pushTokens.docs.forEach(doc => batch.delete(doc.ref));

    // Delete notification history
    const notifications = await db.collection('notification_history').where('userId', '==', userId).get();
    notifications.docs.forEach(doc => batch.delete(doc.ref));

    // Delete XP transactions
    const xpTransactions = await db.collection('xp_transactions').where('user_id', '==', userId).get();
    xpTransactions.docs.forEach(doc => batch.delete(doc.ref));

    // Commit all Firestore deletions
    await batch.commit();
    functions.logger.info(`Firestore data deleted for user: ${userId}`);

    // Delete Firebase Auth user (this will also sign them out)
    await admin.auth().deleteUser(userId);
    functions.logger.info(`Firebase Auth user deleted: ${userId}`);

    return {
      success: true,
      message: 'Account and all associated data have been permanently deleted'
    };

  } catch (error: any) {
    functions.logger.error('Account deletion failed', { userId, error: error.message });
    throw new functions.https.HttpsError('internal', `Account deletion failed: ${error.message}`);
  }
});

// SECURITY: Resend verification email function - handles email resend with admin privileges
const resendApiKeySecret = defineSecret('RESEND_API_KEY');
export const resendVerificationEmail = functions
  .runWith({
    secrets: [resendApiKeySecret]
  })
  .https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const userId = context.auth.uid;

  try {
    functions.logger.info(`Resending verification email for user: ${userId}`);

    // Get user data from Firestore with admin privileges
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const userData = userDoc.data();

    if (userData?.email_verified) {
      throw new functions.https.HttpsError('already-exists', 'Email already verified');
    }

    // Generate verification token
    const crypto = require('crypto');
    const token = crypto.createHash('sha256').update(`${Date.now()}-${Math.random()}-${Math.random()}`).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Invalidate existing tokens
    const existingTokensQuery = await db.collection('verification_tokens')
      .where('user_id', '==', userId)
      .where('type', '==', 'email_verification')
      .where('used', '==', false)
      .get();

    const batch = db.batch();
    existingTokensQuery.docs.forEach(doc => {
      batch.update(doc.ref, {
        used: true,
        invalidated_at: admin.firestore.FieldValue.serverTimestamp(),
        invalidated_reason: 'new_token_requested'
      });
    });

    // Create new verification token
    const verificationToken = {
      token,
      user_id: userId,
      email: userData?.email,
      type: 'email_verification',
      expires_at: admin.firestore.Timestamp.fromDate(expiresAt),
      used: false,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    };

    batch.set(db.collection('verification_tokens').doc(token), verificationToken);
    await batch.commit();

    // Send email using Resend API directly (since we're server-side)
    const verificationUrl = `https://campus-life-auth-website.vercel.app/verify/email_verification/${token}`;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKeySecret.value()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Campus Life <noreply@ronaldli.ca>',
        to: [userData?.email],
        subject: 'Verify your Campus Life email address',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Email Verification - Campus Life</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #ffffff; border-radius: 12px; padding: 40px; border: 1px solid #e2e8f0;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <div style="width: 64px; height: 64px; background: #60a5fa; border-radius: 12px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 24px;">CL</div>
                  <h1 style="color: #1e293b; margin: 0; font-size: 28px; font-weight: 900;">Campus Life</h1>
                  <p style="color: #64748b; margin: 10px 0 0 0; font-size: 16px;">Connecting families through wellness</p>
                </div>

                <h2 style="color: #1e293b; font-size: 20px; font-weight: 700; margin-bottom: 16px;">Hi ${userData?.name || userData?.full_name || 'User'},</h2>

                <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">
                  Thank you for joining Campus Life! Please verify your email address by clicking the button below to complete your account setup.
                </p>

                <div style="text-align: center; margin: 32px 0;">
                  <a href="${verificationUrl}" style="background: #60a5fa; color: white; padding: 16px 24px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; display: inline-block;">Verify Email Address</a>
                </div>

                <p style="color: #64748b; font-size: 14px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
                  If you didn't create a Campus Life account, you can safely ignore this email.<br>
                  This verification link will expire in 24 hours for security.
                </p>

                <div style="text-align: center; margin-top: 32px; color: #94a3b8; font-size: 12px;">
                  <p>Campus Life<br>
                  <a href="mailto:help@ronaldli.ca" style="color: #60a5fa;">help@ronaldli.ca</a></p>
                </div>
              </div>
            </body>
          </html>
        `
      })
    });

    if (!resendResponse.ok) {
      throw new Error(`Email sending failed: ${resendResponse.statusText}`);
    }

    functions.logger.info(`Verification email sent to ${userData?.email}`);

    return {
      success: true,
      message: 'Verification email sent successfully'
    };

  } catch (error: any) {
    functions.logger.error('Failed to resend verification email', { userId, error: error.message });

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError('internal', `Failed to resend verification email: ${error.message}`);
  }
});

// SECURITY: XP update function
export const updateUserXP = functions.https.onCall(async (data, context) => {
  const { userId, experienceGained } = data;
  
  if (!context.auth || context.auth.uid !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'Unauthorized');
  }
  
  if (!userId || typeof experienceGained !== 'number' || experienceGained < 0 || experienceGained > 100) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid XP data');
  }
  
  try {
    const progressRef = db.collection('user_progress').doc(userId);
    const currentProgress = await progressRef.get();
    
    let currentXP = 0;
    let currentLevel = 1;
    
    if (currentProgress.exists) {
      const data = currentProgress.data()!;
      currentXP = data.experience || 0;
      currentLevel = data.level || 1;
    }
    
    const newXP = currentXP + experienceGained;
    const newLevel = Math.floor((newXP - 100) / 50) + 2;
    const leveledUp = newLevel > currentLevel;
    
    // Update with server privileges (bypasses Firestore rules)
    await progressRef.set({
      user_id: userId,
      experience: newXP,
      level: Math.max(newLevel, 1),
      last_updated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    return {
      success: true,
      newExperience: newXP,
      newLevel: Math.max(newLevel, 1),
      leveledUp,
      experienceGained
    };
    
  } catch (error: any) {
    throw new functions.https.HttpsError('internal', 'XP update failed');
  }
});

// SECURITY: Get user progress function
export const getUserProgress = functions.https.onCall(async (data, context) => {
  const { userId } = data;
  
  if (!context.auth || context.auth.uid !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'Unauthorized');
  }
  
  try {
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
    throw new functions.https.HttpsError('internal', 'Failed to get progress');
  }
});

// Initialize Expo SDK for push notifications
const expo = new Expo();

// Secure secret definitions using Firebase Secret Manager
const PAYPAL_CLIENT_ID = defineSecret('paypal-client-id-prod');
const PAYPAL_CLIENT_SECRET = defineSecret('paypal-client-secret-prod');
const RESEND_API_KEY = defineSecret('campus-life-resend-prod');

// PayPal Configuration
const PAYPAL_BASE_URL = 'https://api-m.sandbox.paypal.com'; // Use production URL for live app

// Debug logging function - updated for payments collection
const debugLog = (functionName: string, message: string, data?: any) => {
  console.log(`🔍 [${functionName}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

// Get PayPal Access Token (now secure with secrets)
const getPayPalAccessToken = async (): Promise<string> => {
  debugLog('getPayPalAccessToken', 'Requesting PayPal access token');
  
  try {
    const clientId = PAYPAL_CLIENT_ID.value();
    const clientSecret = PAYPAL_CLIENT_SECRET.value();
    
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const response = await axios.post(`${PAYPAL_BASE_URL}/v1/oauth2/token`, 'grant_type=client_credentials', {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    debugLog('getPayPalAccessToken', 'Access token received successfully');
    return response.data.access_token;
  } catch (error: any) {
    debugLog('getPayPalAccessToken', 'Error getting access token', error.response?.data || error.message);
    throw new Error('Failed to get PayPal access token');
  }
};

// Create PayPal Order for P2P Payment
export const createPayPalOrder = functions
  .runWith({ secrets: [PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET] })
  .https.onCall(async (data, context) => {
  debugLog('createPayPalOrder', 'Function called', { userId: context.auth?.uid, data });
  
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { studentId, amountCents, note } = data;

  // Validate input
  if (!studentId || !amountCents || amountCents <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid payment data');
  }

  try {
    // Basic duplicate protection using existing parent_id index only
    // Client-side protection should handle most cases, this is just backup
    const recentPaymentsQuery = await db.collection('payments')
      .where('parent_id', '==', context.auth.uid)
      .orderBy('created_at', 'desc')
      .limit(5)
      .get();

    // Check if there's a very recent payment with same parameters (last 30 seconds)
    const thirtySecondsAgo = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 30 * 1000));
    const matchingPayments = recentPaymentsQuery.docs.filter(doc => {
      const data = doc.data();
      return data.created_at > thirtySecondsAgo &&
             data.student_id === studentId && 
             data.intent_cents === amountCents && 
             ['initiated', 'pending', 'processing'].includes(data.status);
    });

    if (matchingPayments.length > 0) {
      const existingPayment = matchingPayments[0];
      const existingData = existingPayment.data();
      
      debugLog('createPayPalOrder', 'Found recent duplicate payment, returning it', { 
        existingPaymentId: existingPayment.id,
        existingOrderId: existingData.paypal_order_id,
        existingStatus: existingData.status
      });
      
      // Return existing payment details instead of creating duplicate
      return {
        success: true,
        transactionId: existingPayment.id,
        paymentId: existingPayment.id,
        orderId: existingData.paypal_order_id,
        approvalUrl: existingData.paypal_approval_url || `https://www.sandbox.paypal.com/checkoutnow?token=${existingData.paypal_order_id}`
      };
    }

    // Get student PayPal email
    const studentDoc = await db.collection('users').doc(studentId).get();
    if (!studentDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Student not found');
    }

    const studentData = studentDoc.data()!;
    debugLog('createPayPalOrder', 'Student data retrieved', { 
      hasPaypalEmail: !!studentData.paypal_email,
      hasEmail: !!studentData.email,
      paypalEmail: studentData.paypal_email || '[not set]',
      email: studentData.email || '[not set]'
    });
    
    const recipientEmail = studentData.paypal_email || studentData.email;

    if (!recipientEmail) {
      debugLog('createPayPalOrder', 'No email found for student', studentData);
      throw new functions.https.HttpsError('failed-precondition', 'Student PayPal email not found');
    }

    debugLog('createPayPalOrder', 'Creating order for student', { recipientEmail, amountCents });

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Create PayPal order
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: (amountCents / 100).toFixed(2)
        },
        description: note || `Campus Life payment: $${(amountCents / 100).toFixed(2)}`,
        payee: {
          email_address: recipientEmail
        }
      }],
      application_context: {
        return_url: `https://campus-life-auth-website.vercel.app/api/paypal-success`,
        cancel_url: `https://campus-life-auth-website.vercel.app/api/paypal-cancel`,
        brand_name: 'Campus Life',
        user_action: 'PAY_NOW'
      }
    };

    const response = await axios.post(`${PAYPAL_BASE_URL}/v2/checkout/orders`, orderData, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const orderId = response.data.id;
    const approvalUrl = response.data.links.find((link: any) => link.rel === 'approve')?.href;

    debugLog('createPayPalOrder', 'PayPal order created', { orderId, approvalUrl });

    // Create payment record in Firestore to match existing payment system
    const paymentData = {
      parent_id: context.auth.uid,
      student_id: studentId,
      paypal_order_id: orderId,
      paypal_approval_url: approvalUrl,
      intent_cents: amountCents,
      note: note || '',
      recipient_email: recipientEmail,
      status: 'initiated',
      provider: 'paypal',
      completion_method: 'direct_paypal',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      idempotency_key: `paypal_${orderId}_${context.auth.uid}_${studentId}_${amountCents}`
    };

    const paymentRef = await db.collection('payments').add(paymentData);

    debugLog('createPayPalOrder', 'Payment record created', { paymentId: paymentRef.id });

    return {
      success: true,
      transactionId: paymentRef.id,
      paymentId: paymentRef.id,
      orderId,
      approvalUrl
    };

  } catch (error: any) {
    debugLog('createPayPalOrder', 'Error creating order', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', 'Failed to create payment order');
  }
});

// Verify and Capture PayPal Payment
export const verifyPayPalPayment = functions
  .runWith({ secrets: [PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET] })
  .https.onCall(async (data, context) => {
  debugLog('verifyPayPalPayment', 'Function called', { userId: context.auth?.uid, data });
  
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { transactionId, orderId, payerID } = data;

  if (!transactionId || !orderId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing transaction or order ID');
  }

  try {
    // Get payment record
    const paymentRef = db.collection('payments').doc(transactionId);
    const paymentDoc = await paymentRef.get();

    if (!paymentDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Payment not found');
    }

    const payment = paymentDoc.data()!;

    // Verify user owns this payment
    if (payment.parent_id !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Unauthorized access to payment');
    }

    debugLog('verifyPayPalPayment', 'Verifying PayPal order', { orderId, payerID });

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // First, check the current order status
    const orderResponse = await axios.get(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const orderData = orderResponse.data;
    const orderStatus = orderData?.status;

    debugLog('verifyPayPalPayment', 'PayPal order status', { orderStatus, orderData });

    // Handle missing or invalid order status
    if (!orderStatus) {
      debugLog('verifyPayPalPayment', 'Order status is missing or invalid', { orderData });
      
      await paymentRef.update({
        status: 'failed',
        error: 'PayPal order status unavailable - order may be cancelled or expired',
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        success: false,
        status: 'failed',
        error: 'Payment was cancelled or expired',
        message: 'PayPal order not found or cancelled',
        transactionId
      };
    }

    // Handle different order statuses
    if (orderStatus === 'CREATED') {
      // Order was created but not approved/paid by user
      await paymentRef.update({
        status: 'pending_payment',
        paypal_order_data: orderData,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        success: false,
        status: 'pending_payment',
        error: 'Payment not completed - still waiting for user to complete payment in PayPal',
        message: 'Payment not completed yet. Please complete the payment in PayPal first.',
        transactionId,
        approvalUrl: orderData.links?.find((link: any) => link.rel === 'approve')?.href
      };
    }

    if (orderStatus === 'APPROVED') {
      // Order was approved by user, now capture it
      debugLog('verifyPayPalPayment', 'Order approved, capturing payment');

      const captureResponse = await axios.post(
        `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const captureData = captureResponse.data;
      const captureStatus = captureData.status;
      const captureId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;

      debugLog('verifyPayPalPayment', 'PayPal capture response', { captureStatus, captureId });

      // Update payment based on capture status
      const updateData: any = {
        paypal_capture_id: captureId,
        paypal_capture_data: captureData,
        paypal_order_data: orderData,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      };

      if (captureStatus === 'COMPLETED' || captureStatus === 'PENDING') {
        updateData.status = 'completed';
        updateData.completed_at = admin.firestore.FieldValue.serverTimestamp();
        debugLog('verifyPayPalPayment', 'Payment completed successfully', { captureStatus });
        
        // Log PENDING status for P2P payments (common in sandbox)
        if (captureStatus === 'PENDING') {
          debugLog('verifyPayPalPayment', 'PENDING capture status - treating as completed for P2P payment');
        }
      } else {
        updateData.status = 'failed';
        debugLog('verifyPayPalPayment', 'Payment capture failed', { captureStatus });
      }

      // Update payment status immediately with faster write
      await paymentRef.update(updateData);
      debugLog('verifyPayPalPayment', 'Payment status updated in database', { status: updateData.status });

      return {
        success: captureStatus === 'COMPLETED' || captureStatus === 'PENDING',
        status: captureStatus,
        captureId,
        transactionId,
        message: captureStatus === 'PENDING' ? 'Payment completed (pending settlement)' : 'Payment completed'
      };
    }

    if (orderStatus === 'COMPLETED') {
      // Order already completed
      await paymentRef.update({
        status: 'completed',
        paypal_order_data: orderData,
        completed_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        success: true,
        status: 'COMPLETED',
        message: 'Payment already completed',
        transactionId
      };
    }

    // Handle other statuses (CANCELLED, etc.)
    await paymentRef.update({
      status: 'failed',
      paypal_order_data: orderData,
      error: `PayPal order status: ${orderStatus}`,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: false,
      status: orderStatus,
      error: `Payment was ${orderStatus ? orderStatus.toLowerCase() : 'cancelled'}`,
      message: `Payment ${orderStatus ? orderStatus.toLowerCase() : 'cancelled'}`,
      transactionId
    };

  } catch (error: any) {
    debugLog('verifyPayPalPayment', 'Error verifying payment', error);
    
    // Handle different types of errors with better messages
    let errorMessage = 'Unknown verification error';
    let userFriendlyMessage = 'Payment verification failed';
    
    if (error.response?.status === 404) {
      errorMessage = 'PayPal order not found or expired';
      userFriendlyMessage = 'Payment was cancelled or expired';
    } else if (error.response?.status === 422) {
      errorMessage = 'PayPal order cannot be captured (likely cancelled)';
      userFriendlyMessage = 'Payment was cancelled or not completed';
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
      userFriendlyMessage = 'Payment verification failed';
    } else if (error.message) {
      errorMessage = error.message;
      userFriendlyMessage = 'Payment verification failed';
    }
    
    // Update payment as failed with clear status
    try {
      await db.collection('payments').doc(transactionId).update({
        status: 'failed',
        error: errorMessage,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (updateError) {
      debugLog('verifyPayPalPayment', 'Error updating failed payment', updateError);
    }
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    return {
      success: false,
      error: userFriendlyMessage,
      details: errorMessage,
      transactionId
    };
  }
});

// Get Transaction Status (for debugging and monitoring)
export const getTransactionStatus = functions.https.onCall(async (data, context) => {
  debugLog('getTransactionStatus', 'Function called', { userId: context.auth?.uid, data });
  
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { transactionId } = data;

  if (!transactionId) {
    throw new functions.https.HttpsError('invalid-argument', 'Transaction ID required');
  }

  try {
    const paymentDoc = await db.collection('payments').doc(transactionId).get();

    if (!paymentDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Payment not found');
    }

    const payment = paymentDoc.data()!;

    // Verify user has access to this payment
    if (payment.parent_id !== context.auth.uid && payment.student_id !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Unauthorized access to payment');
    }

    debugLog('getTransactionStatus', 'Payment found', { transactionId, status: payment.status });

    return {
      success: true,
      transaction: {
        id: transactionId,
        status: payment.status,
        amountCents: payment.intent_cents,
        note: payment.note,
        createdAt: payment.created_at,
        completedAt: payment.completed_at,
        recipientEmail: payment.recipient_email
      }
    };

  } catch (error: any) {
    debugLog('getTransactionStatus', 'Error getting transaction', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', 'Failed to get transaction status');
  }
});

// Debug endpoint for testing PayPal connection
export const testPayPalConnection = functions
  .runWith({ secrets: [PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET] })
  .https.onCall(async (data, context) => {
  debugLog('testPayPalConnection', 'Function called', { userId: context.auth?.uid });
  
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const clientId = PAYPAL_CLIENT_ID.value();
    const clientSecret = PAYPAL_CLIENT_SECRET.value();
    
    const credentialsInfo = {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      clientIdLength: clientId ? clientId.length : 0,
      secretLength: clientSecret ? clientSecret.length : 0,
      baseUrl: PAYPAL_BASE_URL
    };

    debugLog('testPayPalConnection', 'Credentials check', credentialsInfo);

    await getPayPalAccessToken();
    
    debugLog('testPayPalConnection', 'PayPal connection successful');
    
    return {
      success: true,
      message: 'PayPal connection working',
      credentialsInfo
    };

  } catch (error: any) {
    debugLog('testPayPalConnection', 'PayPal connection failed', error);
    
    return {
      success: false,
      error: error.message,
      details: 'Failed to get access token from PayPal. Check your credentials or set up secrets.',
      setupInstructions: [
        '1. Go to https://developer.paypal.com/',
        '2. Create a sandbox application', 
        '3. Get your Client ID and Secret',
        '4. Run: firebase functions:secrets:set PAYPAL_CLIENT_ID',
        '5. Run: firebase functions:secrets:set PAYPAL_CLIENT_SECRET',
        '6. Run: firebase deploy --only functions'
      ]
    };
  }
});

// Send Push Notification
export const sendPushNotification = functions.https.onCall(async (data, context) => {
  debugLog('sendPushNotification', 'Function called', { userId: context.auth?.uid, data });
  
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { userId, type, title, body, notificationData } = data;

  // Validate input
  if (!userId || !type || !title || !body) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required notification data');
  }

  try {
    // Get user document to check push token and preferences
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const userData = userDoc.data()!;
    const pushToken = userData.pushToken;
    const preferences = userData.notificationPreferences;

    // Check if notifications are enabled for this user
    if (!preferences?.enabled) {
      debugLog('sendPushNotification', 'Notifications disabled for user', { userId });
      return { success: false, reason: 'notifications_disabled' };
    }

    // Check specific notification type preferences
    const typeEnabled = checkNotificationTypeEnabled(type, preferences);
    if (!typeEnabled) {
      debugLog('sendPushNotification', 'Notification type disabled for user', { userId, type });
      return { success: false, reason: 'notification_type_disabled' };
    }

    // Validate push token
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
      debugLog('sendPushNotification', 'Invalid or missing push token', { userId, pushToken });
      return { success: false, reason: 'invalid_push_token' };
    }

    // Create the notification message
    const message = {
      to: pushToken,
      sound: 'default' as const,
      title,
      body,
      data: {
        type,
        userId,
        ...notificationData
      },
      priority: (type === 'care_request' || type === 'support_received' ? 'high' : 'default') as 'high' | 'default'
    };

    debugLog('sendPushNotification', 'Sending notification', { message });

    // Send the notification
    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        debugLog('sendPushNotification', 'Error sending notification chunk', error);
      }
    }

    // Check for errors in tickets
    const hasErrors = tickets.some(ticket => ticket.status === 'error');
    
    if (hasErrors) {
      debugLog('sendPushNotification', 'Some notifications failed', { tickets });
    } else {
      debugLog('sendPushNotification', 'All notifications sent successfully', { ticketCount: tickets.length });
    }

    // Store notification in history
    await db.collection('notification_history').add({
      userId,
      type,
      title,
      body,
      data: notificationData,
      pushToken,
      tickets,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      success: !hasErrors
    });

    return {
      success: !hasErrors,
      tickets,
      ticketCount: tickets.length
    };

  } catch (error: any) {
    debugLog('sendPushNotification', 'Error sending notification', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
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

  const { to, type, emailData } = data;

  // Allow unauthenticated calls for password reset emails only
  // For email verification resends, allow authenticated users even if unverified
  if (!context.auth && type !== 'password_reset') {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // For email verification, ensure user can only resend for their own email
  if (type === 'email_verification' && context.auth) {
    try {
      const userRecord = await admin.auth().getUser(context.auth.uid);
      if (userRecord.email !== to) {
        throw new functions.https.HttpsError('permission-denied', 'Can only resend verification for your own email');
      }
    } catch (error: any) {
      debugLog('sendEmail', 'Error validating user email', { error: error.message });
      throw new functions.https.HttpsError('permission-denied', 'Invalid user verification');
    }
  }

  // Validate input
  if (!to || !type || !emailData) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required email data');
  }

  // Validate email type
  if (!['email_verification', 'password_reset', 'invitation', 'welcome'].includes(type)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid email type');
  }

  try {
    const apiKey = RESEND_API_KEY.value();
    
    if (!apiKey) {
      throw new functions.https.HttpsError('failed-precondition', 'Email service not configured');
    }
    
    // Clean the API key of any potential invisible characters
    const cleanApiKey = apiKey.trim().replace(/[\r\n\t]/g, '');
    debugLog('sendEmail', 'API key validation', { 
      hasKey: !!cleanApiKey, 
      keyLength: cleanApiKey.length,
      keyStart: cleanApiKey.substring(0, 5)
    });

    // Email templates
    const templates = {
      email_verification: {
        subject: 'Verify your Campus Life email',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Verify Your Email - Campus Life</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #ffffff; border-radius: 12px; padding: 40px; border: 1px solid #e2e8f0;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <div style="width: 64px; height: 64px; background: #60a5fa; border-radius: 12px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 24px;">CL</div>
                  <h1 style="color: #1e293b; margin: 0; font-size: 28px; font-weight: 900;">Campus Life</h1>
                  <p style="color: #64748b; margin: 10px 0 0 0; font-size: 16px;">Connecting families through wellness</p>
                </div>
                
                <h2 style="color: #1e293b; font-size: 20px; font-weight: 700; margin-bottom: 16px;">Hi ${emailData.name},</h2>
                
                <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">
                  Welcome to Campus Life! Please verify your email address to activate your account and start connecting with your family's wellness journey.
                </p>
                
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${emailData.verificationUrl}" style="background: #3b82f6; color: white; padding: 16px 24px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; display: inline-block;">Verify Email Address</a>
                </div>
                
                <p style="color: #64748b; font-size: 14px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
                  If you didn't create a Campus Life account, you can safely ignore this email.<br>
                  This verification link will expire in 24 hours for security.
                </p>
                
                <div style="text-align: center; margin-top: 32px; color: #94a3b8; font-size: 12px;">
                  <p>Campus Life<br>
                  <a href="mailto:help@ronaldli.ca" style="color: #60a5fa;">help@ronaldli.ca</a></p>
                </div>
              </div>
            </body>
          </html>
        `
      },
      password_reset: {
        subject: 'Reset your Campus Life password',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Reset Password - Campus Life</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #ffffff; border-radius: 12px; padding: 40px; border: 1px solid #e2e8f0;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <div style="width: 64px; height: 64px; background: #60a5fa; border-radius: 12px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 24px;">CL</div>
                  <h1 style="color: #1e293b; margin: 0; font-size: 28px; font-weight: 900;">Campus Life</h1>
                  <p style="color: #64748b; margin: 10px 0 0 0; font-size: 16px;">Connecting families through wellness</p>
                </div>
                
                <h2 style="color: #1e293b; font-size: 20px; font-weight: 700; margin-bottom: 16px;">Hi ${emailData.name},</h2>
                
                <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">
                  We received a request to reset your Campus Life password. Click the button below to create a new password.
                </p>
                
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${emailData.verificationUrl}" style="background: #dc2626; color: white; padding: 16px 24px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; display: inline-block;">Reset Password</a>
                </div>
                
                <p style="color: #64748b; font-size: 14px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
                  If you didn't request this password reset, you can safely ignore this email.<br>
                  This reset link will expire in 1 hour for security.
                </p>
                
                <div style="text-align: center; margin-top: 32px; color: #94a3b8; font-size: 12px;">
                  <p>Campus Life<br>
                  <a href="mailto:help@ronaldli.ca" style="color: #60a5fa;">help@ronaldli.ca</a></p>
                </div>
              </div>
            </body>
          </html>
        `
      },
      invitation: {
        subject: `${emailData.parentName} invited you to join ${emailData.familyName} on Campus Life`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Family Invitation - Campus Life</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #ffffff; border-radius: 12px; padding: 40px; border: 1px solid #e2e8f0;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <div style="width: 64px; height: 64px; background: #60a5fa; border-radius: 12px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 24px;">CL</div>
                  <h1 style="color: #1e293b; margin: 0; font-size: 28px; font-weight: 900;">Campus Life</h1>
                  <p style="color: #64748b; margin: 10px 0 0 0; font-size: 16px;">Connecting families through wellness</p>
                </div>
                
                <h2 style="color: #1e293b; font-size: 20px; font-weight: 700; margin-bottom: 16px;">Hi ${emailData.recipientName},</h2>
                
                <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">
                  <strong>${emailData.parentName}</strong> has invited you to join the <strong>${emailData.familyName}</strong> family on Campus Life!
                </p>
                
                <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">
                  Campus Life helps families stay connected during the college years through:
                </p>
                
                <ul style="color: #475569; font-size: 16px; margin-bottom: 24px;">
                  <li>🌟 Wellness tracking and support</li>
                  <li>💬 Easy communication</li>
                  <li>❤️ Family encouragement tools</li>
                </ul>
                
                <div style="background: #f1f5f9; padding: 24px; border-radius: 8px; margin: 24px 0; text-align: center;">
                  <p style="color: #475569; margin: 0 0 16px 0; font-size: 16px;">Your invite code:</p>
                  <div style="background: #white; border: 2px solid #3b82f6; padding: 16px; border-radius: 8px; font-family: 'Monaco', 'Menlo', monospace; font-size: 24px; font-weight: 700; color: #1e293b; letter-spacing: 2px;">${emailData.inviteCode}</div>
                </div>
                
                <p style="color: #475569; font-size: 16px; margin-bottom: 32px;">
                  To join, download the Campus Life app and use the invite code above when creating your student account.
                </p>
                
                <div style="text-align: center; margin-top: 32px; color: #94a3b8; font-size: 12px;">
                  <p>Campus Life<br>
                  <a href="mailto:help@ronaldli.ca" style="color: #60a5fa;">help@ronaldli.ca</a></p>
                </div>
              </div>
            </body>
          </html>
        `
      },
      welcome: {
        subject: `Welcome to Campus Life, ${emailData.recipientName}!`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Welcome to Campus Life</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #ffffff; border-radius: 12px; padding: 40px; border: 1px solid #e2e8f0;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <div style="width: 64px; height: 64px; background: #60a5fa; border-radius: 12px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 24px;">CL</div>
                  <h1 style="color: #1e293b; margin: 0; font-size: 28px; font-weight: 900;">Campus Life</h1>
                  <p style="color: #64748b; margin: 10px 0 0 0; font-size: 16px;">Connecting families through wellness</p>
                </div>
                
                <h2 style="color: #1e293b; font-size: 20px; font-weight: 700; margin-bottom: 16px;">Welcome, ${emailData.recipientName}!</h2>
                
                ${emailData.role === 'parent' ? `
                  <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">
                    You've successfully created the <strong>${emailData.familyName}</strong> family account on Campus Life.
                  </p>
                  
                  <div style="background: #f1f5f9; padding: 24px; border-radius: 8px; margin: 24px 0; text-align: center;">
                    <p style="color: #475569; margin: 0 0 16px 0; font-size: 16px;">Your family invite code:</p>
                    <div style="background: #white; border: 2px solid #3b82f6; padding: 16px; border-radius: 8px; font-family: 'Monaco', 'Menlo', monospace; font-size: 24px; font-weight: 700; color: #1e293b; letter-spacing: 2px;">${emailData.inviteCode}</div>
                  </div>
                  
                  <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">
                    Share this code with your college student so they can join your family account and start their wellness journey with you.
                  </p>
                ` : `
                  <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">
                    You've successfully joined the <strong>${emailData.familyName}</strong> family on Campus Life!
                  </p>
                `}
                
                <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">
                  Campus Life helps ${emailData.role === 'parent' ? 'families stay connected during the college years' : 'you stay connected with your family during college'} through:
                </p>
                
                <ul style="color: #475569; font-size: 16px; margin-bottom: 24px;">
                  <li>🌟 Wellness tracking tools</li>
                  <li>💬 Easy family communication</li>
                  <li>❤️ Support and encouragement features</li>
                  ${emailData.role === 'student' ? '<li>📊 Progress sharing with family</li>' : '<li>📊 Wellness insights and reports</li>'}
                </ul>
                
                <p style="color: #475569; font-size: 16px; margin-bottom: 32px;">
                  ${emailData.role === 'parent' ? 'Start by inviting your student to join your family account!' : 'Start by exploring the app and logging your first wellness entry!'}
                </p>
                
                <div style="text-align: center; margin-top: 32px; color: #94a3b8; font-size: 12px;">
                  <p>Campus Life<br>
                  <a href="mailto:help@ronaldli.ca" style="color: #60a5fa;">help@ronaldli.ca</a></p>
                </div>
              </div>
            </body>
          </html>
        `
      }
    };

    const template = templates[type as keyof typeof templates];
    
    debugLog('sendEmail', 'Sending email via Resend', { to, type, subject: template.subject });

    // Send email using Resend API
    const response = await axios.post('https://api.resend.com/emails', {
      from: 'Campus Life <noreply@ronaldli.ca>',
      to: [to],
      subject: template.subject,
      html: template.html
    }, {
      headers: {
        'Authorization': `Bearer ${cleanApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    debugLog('sendEmail', 'Email sent successfully', { messageId: response.data.id });

    return {
      success: true,
      messageId: response.data.id,
      type,
      to
    };

  } catch (error: any) {
    debugLog('sendEmail', 'Error sending email', error.response?.data || error.message);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    const errorMessage = error.response?.data?.message || error.message || 'Failed to send email';
    throw new functions.https.HttpsError('internal', `Email service error: ${errorMessage}`);
  }
});

// Verify Email Token via HTTP (for verification website)
export const verifyEmailHttp = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const { token } = req.body;
  
  if (!token) {
    res.status(400).json({ success: false, error: 'Token is required' });
    return;
  }

  try {
    // Get token document
    const tokenDoc = await db.collection('verification_tokens').doc(token).get();
    
    if (!tokenDoc.exists) {
      res.status(400).json({ success: false, error: 'Invalid token' });
      return;
    }

    const tokenData = tokenDoc.data() as any;
    
    // Check if token is valid
    if (tokenData.used || tokenData.type !== 'email_verification') {
      res.status(400).json({ success: false, error: 'Invalid or used token' });
      return;
    }

    // Check if token is expired
    if (tokenData.expires_at.toDate() < new Date()) {
      res.status(400).json({ success: false, error: 'Token expired' });
      return;
    }

    // Mark token as used
    await tokenDoc.ref.update({
      used: true,
      used_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // Mark user as verified using admin privileges
    await db.collection('users').doc(tokenData.user_id).update({
      email_verified: true,
      verified_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // Set custom claims
    await admin.auth().setCustomUserClaims(tokenData.user_id, {
      email_verified: true
    });

    res.status(200).json({
      success: true,
      userId: tokenData.user_id,
      message: 'Email verified successfully'
    });
    
  } catch (error: any) {
    debugLog('verifyEmailHttp', 'Error verifying email', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to verify email'
    });
  }
});

// Verify Password Reset Token via HTTP (for verification website)
export const verifyPasswordResetTokenHttp = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const { token } = req.body;
  
  if (!token) {
    res.status(400).json({ success: false, error: 'Token is required' });
    return;
  }

  try {
    // Get token document
    const tokenDoc = await db.collection('verification_tokens').doc(token).get();
    
    if (!tokenDoc.exists) {
      res.status(400).json({ success: false, error: 'Invalid token' });
      return;
    }

    const tokenData = tokenDoc.data() as any;
    
    // Check if token is valid
    if (tokenData.used || tokenData.type !== 'password_reset') {
      res.status(400).json({ success: false, error: 'Invalid or used token' });
      return;
    }

    // Check if token is expired
    if (tokenData.expires_at.toDate() < new Date()) {
      res.status(400).json({ success: false, error: 'Token expired' });
      return;
    }

    // Don't mark as used yet - just verify it's valid
    res.status(200).json({
      success: true,
      userId: tokenData.user_id,
      email: tokenData.email,
      message: 'Password reset token is valid'
    });
    
  } catch (error: any) {
    debugLog('verifyPasswordResetTokenHttp', 'Error verifying token', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to verify password reset token'
    });
  }
});

// Reset Password using Firebase Admin SDK (unauthenticated endpoint for password reset)
export const resetPasswordHttp = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const { token, newPassword } = req.body;
  
  debugLog('resetPassword', 'HTTP request received', { token: '[REDACTED]', hasPassword: !!newPassword });

  // Validate input
  if (!token || !newPassword) {
    res.status(400).json({ success: false, error: 'Missing token or password' });
    return;
  }

  // Validate password strength
  if (newPassword.length < 8) {
    res.status(400).json({ success: false, error: 'Password must be at least 8 characters long' });
    return;
  }

  try {
    // Get the verification token from Firestore
    const tokenDoc = await db.collection('verification_tokens').doc(token).get();
    
    if (!tokenDoc.exists) {
      res.status(404).json({ success: false, error: 'Invalid reset token' });
      return;
    }

    const tokenData = tokenDoc.data()!;
    
    // Check if token is valid and not expired
    if (tokenData.used || tokenData.type !== 'password_reset') {
      res.status(400).json({ success: false, error: 'Invalid or used reset token' });
      return;
    }

    if (tokenData.expires_at.toDate() < new Date()) {
      res.status(400).json({ success: false, error: 'Reset token has expired' });
      return;
    }

    debugLog('resetPassword', 'Token verified, updating password', { userId: tokenData.user_id });

    // Update user password using Firebase Admin Auth
    await admin.auth().updateUser(tokenData.user_id, {
      password: newPassword
    });

    // Mark token as used
    await db.collection('verification_tokens').doc(token).update({
      used: true,
      used_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // Clear any pending password reset flags from user document
    await db.collection('users').doc(tokenData.user_id).update({
      password_reset_pending: false,
      password_reset_token: null,
      password_reset_requested_at: null,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    debugLog('resetPassword', 'Password reset completed successfully', { userId: tokenData.user_id });

    // Send password reset confirmation email
    try {
      const userDoc = await db.collection('users').doc(tokenData.user_id).get();
      const userData = userDoc.data();
      
      if (userData && userData.email) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${functions.config().resend.api_key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Campus Life <noreply@campus-life.app>',
            to: userData.email,
            subject: 'Password Reset Confirmation - Campus Life',
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="text-align: center; margin-bottom: 40px;">
                  <div style="background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%); width: 80px; height: 80px; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 28px; margin-bottom: 20px;">CL</div>
                  <h1 style="color: #1e293b; margin: 0; font-size: 28px; font-weight: 900;">Password Reset Successful</h1>
                </div>
                
                <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 24px; border: 2px solid #d1fae5; margin-bottom: 32px;">
                  <h2 style="color: #10b981; margin: 0 0 12px 0; font-size: 20px; font-weight: 700;">✓ Your password has been successfully reset</h2>
                  <p style="color: #059669; margin: 0; font-size: 16px;">Your Campus Life account password was changed on ${new Date().toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}.</p>
                </div>
                
                <div style="background: #ffffff; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0; margin-bottom: 32px;">
                  <h3 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Security Notice</h3>
                  <p style="color: #64748b; margin: 0 0 12px 0; font-size: 16px; line-height: 1.6;">If you did not request this password reset, please contact our support team immediately at <strong>help@campus-life.app</strong></p>
                  <p style="color: #64748b; margin: 0; font-size: 16px; line-height: 1.6;">For your security, we recommend using a strong, unique password that you don't use for other accounts.</p>
                </div>
                
                <div style="text-align: center; padding-top: 32px; border-top: 1px solid #e2e8f0;">
                  <p style="color: #64748b; margin: 0; font-size: 14px;">
                    <strong>Campus Life</strong><br>
                    Connecting families through wellness
                  </p>
                  <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 12px;">
                    Having trouble? Contact support at help@campus-life.app
                  </p>
                </div>
              </div>
            `
          })
        });
        
        debugLog('resetPassword', 'Confirmation email sent', { email: userData.email });
      }
    } catch (emailError: any) {
      debugLog('resetPassword', 'Failed to send confirmation email', emailError);
      // Don't fail the password reset if email fails
    }

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error: any) {
    debugLog('resetPassword', 'Error resetting password', error);
    
    const errorMessage = error.message || 'Failed to reset password';
    res.status(500).json({
      success: false,
      error: `Password reset failed: ${errorMessage}`
    });
  }
});

// Send Password Change Confirmation Email via HTTP
export const sendPasswordChangeConfirmationHttp = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const { email, userId } = req.body;

  if (!email || !userId) {
    res.status(400).json({ success: false, error: 'Missing email or userId' });
    return;
  }

  try {
    // Get user data for full name
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userName = userData?.full_name || 'Campus Life User';

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${functions.config().resend.api_key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Campus Life <noreply@campus-life.app>',
        to: email,
        subject: 'Password Changed Successfully - Campus Life',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 40px;">
              <div style="background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%); width: 80px; height: 80px; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 28px; margin-bottom: 20px;">CL</div>
              <h1 style="color: #1e293b; margin: 0; font-size: 28px; font-weight: 900;">Password Changed</h1>
            </div>
            
            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 24px; border: 2px solid #d1fae5; margin-bottom: 32px;">
              <h2 style="color: #10b981; margin: 0 0 12px 0; font-size: 20px; font-weight: 700;">✓ Password successfully changed</h2>
              <p style="color: #059669; margin: 0; font-size: 16px;">Hi ${userName}, your Campus Life account password was changed from within the app on ${new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}.</p>
            </div>
            
            <div style="background: #ffffff; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0; margin-bottom: 32px;">
              <h3 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Security Notice</h3>
              <p style="color: #64748b; margin: 0 0 12px 0; font-size: 16px; line-height: 1.6;">If you did not make this change, please contact our support team immediately at <strong>help@campus-life.app</strong> or sign into your account and change your password.</p>
              <p style="color: #64748b; margin: 0; font-size: 16px; line-height: 1.6;">This notification helps keep your account secure by alerting you to important changes.</p>
            </div>
            
            <div style="text-align: center; padding-top: 32px; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; margin: 0; font-size: 14px;">
                <strong>Campus Life</strong><br>
                Connecting families through wellness
              </p>
              <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 12px;">
                Having trouble? Contact support at help@campus-life.app
              </p>
            </div>
          </div>
        `
      })
    });

    debugLog('sendPasswordChangeConfirmation', 'Password change confirmation email sent', { email });

    res.status(200).json({
      success: true,
      message: 'Password change confirmation email sent'
    });
  } catch (error: any) {
    debugLog('sendPasswordChangeConfirmation', 'Error sending confirmation email', error);
    
    const errorMessage = error.response?.data?.message || error.message || 'Failed to send confirmation email';
    res.status(500).json({
      success: false,
      error: `Email service error: ${errorMessage}`
    });
  }
});

// Complete Password Reset Request via HTTP (unauthenticated endpoint)
export const requestPasswordResetHttp = functions
  .runWith({ secrets: [RESEND_API_KEY] })
  .https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const { email } = req.body;
  
  debugLog('requestPasswordReset', 'HTTP request received', { 
    email: email || 'missing'
  });

  // Validate input
  if (!email) {
    res.status(400).json({ success: false, error: 'Email is required' });
    return;
  }

  try {
    // Check if user exists with this email
    const usersQuery = await db.collection('users').where('email', '==', email).get();
    
    if (usersQuery.empty) {
      // Don't reveal if email exists or not for security
      res.status(200).json({ success: true });
      return;
    }
    
    const userDoc = usersQuery.docs[0];
    const userData = userDoc.data();
    
    // Generate secure verification token
    const token = await admin.firestore().collection('temp').doc().id + '-' + Date.now();
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)); // 24 hours
    
    // Invalidate any existing password reset tokens for this user
    const existingTokens = await db.collection('verification_tokens')
      .where('user_id', '==', userDoc.id)
      .where('type', '==', 'password_reset')
      .where('used', '==', false)
      .get();
      
    const invalidationPromises = existingTokens.docs.map(tokenDoc => 
      tokenDoc.ref.update({ 
        used: true, 
        invalidated_at: admin.firestore.FieldValue.serverTimestamp(),
        invalidated_reason: 'new_token_requested'
      })
    );
    
    if (invalidationPromises.length > 0) {
      await Promise.all(invalidationPromises);
      debugLog('requestPasswordReset', `Invalidated ${invalidationPromises.length} existing tokens for user ${userDoc.id}`);
    }

    // Create new verification token
    const verificationToken = {
      token,
      user_id: userDoc.id,
      email,
      type: 'password_reset',
      expires_at: expiresAt,
      used: false,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('verification_tokens').doc(token).set(verificationToken);
    
    // Generate verification URL
    const verificationUrl = `https://campus-life-auth-website.vercel.app/verify/password_reset/${token}`;
    
    // Send password reset email using Resend
    const apiKey = RESEND_API_KEY.value();
    
    if (!apiKey) {
      throw new Error('Email service not configured');
    }
    
    const cleanApiKey = apiKey.trim().replace(/[\r\n\t]/g, '');
    
    const template = {
      subject: 'Reset your Campus Life password',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Password - Campus Life</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #ffffff; border-radius: 12px; padding: 40px; border: 1px solid #e2e8f0;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="width: 64px; height: 64px; background: #60a5fa; border-radius: 12px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 24px;">CL</div>
                <h1 style="color: #1e293b; margin: 0; font-size: 28px; font-weight: 900;">Campus Life</h1>
                <p style="color: #64748b; margin: 10px 0 0 0; font-size: 16px;">Connecting families through wellness</p>
              </div>
              
              <h2 style="color: #1e293b; font-size: 20px; font-weight: 700; margin-bottom: 16px;">Hi ${userData.full_name || 'there'},</h2>
              
              <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">
                We received a request to reset your Campus Life password. Click the button below to create a new password.
              </p>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${verificationUrl}" style="background: #dc2626; color: white; padding: 16px 24px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; display: inline-block;">Reset Password</a>
              </div>
              
              <p style="color: #64748b; font-size: 14px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
                If you didn't request this password reset, you can safely ignore this email.<br>
                This reset link will expire in 24 hours for security.
              </p>
              
              <div style="text-align: center; margin-top: 32px; color: #94a3b8; font-size: 12px;">
                <p>Campus Life<br>
                <a href="mailto:help@ronaldli.ca" style="color: #60a5fa;">help@ronaldli.ca</a></p>
              </div>
            </div>
          </body>
        </html>
      `
    };
    
    debugLog('requestPasswordReset', 'Sending email via Resend', { to: email, subject: template.subject });

    // Send email using Resend API
    const response = await axios.post('https://api.resend.com/emails', {
      from: 'Campus Life <noreply@ronaldli.ca>',
      to: [email],
      subject: template.subject,
      html: template.html
    }, {
      headers: {
        'Authorization': `Bearer ${cleanApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    debugLog('requestPasswordReset', 'Email sent successfully', { 
      messageId: response.data.id,
      to: email
    });

    res.status(200).json({
      success: true,
      messageId: response.data.id
    });
    
  } catch (error: any) {
    debugLog('requestPasswordReset', 'Error processing request', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process password reset request'
    });
  }
});

// Send Password Reset Email via HTTP (unauthenticated endpoint)
export const sendPasswordResetEmailHttp = functions
  .runWith({ secrets: [RESEND_API_KEY] })
  .https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const { to, emailData } = req.body;
  
  debugLog('sendPasswordResetEmail', 'HTTP request received', { 
    to: to || 'missing',
    hasEmailData: !!emailData
  });

  // Validate input
  if (!to || !emailData) {
    res.status(400).json({ success: false, error: 'Missing required email data' });
    return;
  }

  try {
    const apiKey = RESEND_API_KEY.value();
    
    if (!apiKey) {
      throw new functions.https.HttpsError('failed-precondition', 'Email service not configured');
    }
    
    // Clean the API key of any potential invisible characters
    const cleanApiKey = apiKey.trim().replace(/[\r\n\t]/g, '');
    debugLog('sendPasswordResetEmail', 'API key validation', { 
      hasKey: !!cleanApiKey, 
      keyLength: cleanApiKey.length,
      keyStart: cleanApiKey.substring(0, 5)
    });

    // Password reset email template
    const template = {
      subject: 'Reset your Campus Life password',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Password - Campus Life</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #ffffff; border-radius: 12px; padding: 40px; border: 1px solid #e2e8f0;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="width: 64px; height: 64px; background: #60a5fa; border-radius: 12px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 24px;">CL</div>
                <h1 style="color: #1e293b; margin: 0; font-size: 28px; font-weight: 900;">Campus Life</h1>
                <p style="color: #64748b; margin: 10px 0 0 0; font-size: 16px;">Connecting families through wellness</p>
              </div>
              
              <h2 style="color: #1e293b; font-size: 20px; font-weight: 700; margin-bottom: 16px;">Hi ${emailData.name},</h2>
              
              <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">
                We received a request to reset your Campus Life password. Click the button below to create a new password.
              </p>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${emailData.verificationUrl}" style="background: #dc2626; color: white; padding: 16px 24px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; display: inline-block;">Reset Password</a>
              </div>
              
              <p style="color: #64748b; font-size: 14px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
                If you didn't request this password reset, you can safely ignore this email.<br>
                This reset link will expire in 24 hours for security.
              </p>
              
              <div style="text-align: center; margin-top: 32px; color: #94a3b8; font-size: 12px;">
                <p>Campus Life<br>
                <a href="mailto:help@ronaldli.ca" style="color: #60a5fa;">help@ronaldli.ca</a></p>
              </div>
            </div>
          </body>
        </html>
      `
    };
    
    debugLog('sendPasswordResetEmail', 'Sending email via Resend', { to, subject: template.subject });

    // Send email using Resend API
    const response = await axios.post('https://api.resend.com/emails', {
      from: 'Campus Life <noreply@ronaldli.ca>',
      to: [to],
      subject: template.subject,
      html: template.html
    }, {
      headers: {
        'Authorization': `Bearer ${cleanApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    debugLog('sendPasswordResetEmail', 'Email sent successfully', { messageId: response.data.id });

    res.status(200).json({
      success: true,
      messageId: response.data.id,
      to
    });
  } catch (error: any) {
    debugLog('sendPasswordResetEmail', 'Error sending email', error.response?.data || error.message);
    
    const errorMessage = error.response?.data?.message || error.message || 'Failed to send email';
    res.status(500).json({
      success: false,
      error: `Email service error: ${errorMessage}`
    });
  }
});

// SECURE: Server-side family creation to avoid client-side Firestore rule issues
export const createFamilyServerSide = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { familyName, parentId } = data;

  // Validate input
  if (!familyName || !parentId || parentId !== context.auth.uid) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid family creation data');
  }

  try {
    // Generate secure invite code
    const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    const familyData = {
      name: familyName,
      inviteCode,
      parentIds: [parentId],
      studentIds: [],
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Create family document with admin privileges (bypasses Firestore rules)
    const familyRef = await db.collection('families').add(familyData);

    // Update parent's profile with family ID (with admin privileges)
    await db.collection('users').doc(parentId).update({
      family_id: familyRef.id,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // Set custom claims immediately (with admin privileges)
    await admin.auth().setCustomUserClaims(parentId, {
      email_verified: context.auth.token.email_verified || false,
      admin: true, // Required for server operations
      family_id: familyRef.id,
      user_type: 'parent',
      family_joined_at: Math.floor(Date.now() / 1000),
      initialized: Date.now(),
    });

    functions.logger.info('Family created successfully', {
      familyId: familyRef.id,
      parentId,
      familyName
    });

    return {
      success: true,
      familyId: familyRef.id,
      inviteCode,
      message: 'Family created successfully'
    };

  } catch (error: any) {
    functions.logger.error('Error creating family server-side', { parentId, error: error.message });
    throw new functions.https.HttpsError('internal', `Failed to create family: ${error.message}`);
  }
});

// SECURE: Server-side family joining to avoid client-side Firestore rule issues
export const joinFamilyServerSide = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { inviteCode, studentId } = data;

  // Validate input
  if (!inviteCode || !studentId || studentId !== context.auth.uid) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid family join data');
  }

  try {
    // Find family by invite code (with admin privileges)
    const familyQuery = await db.collection('families')
      .where('inviteCode', '==', inviteCode)
      .limit(1)
      .get();

    if (familyQuery.empty) {
      throw new functions.https.HttpsError('not-found', 'Invalid invite code');
    }

    const familyDoc = familyQuery.docs[0];
    const familyData = familyDoc.data();

    // Check if student is already in the family
    if (familyData.studentIds && familyData.studentIds.includes(studentId)) {
      throw new functions.https.HttpsError('already-exists', 'Student is already a member of this family');
    }

    // Add student to family (with admin privileges)
    const updatedStudentIds = [...(familyData.studentIds || []), studentId];
    await familyDoc.ref.update({
      studentIds: updatedStudentIds,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update student's profile with family ID (with admin privileges)
    await db.collection('users').doc(studentId).update({
      family_id: familyDoc.id,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // Set custom claims immediately (with admin privileges)
    await admin.auth().setCustomUserClaims(studentId, {
      email_verified: context.auth.token.email_verified || false,
      admin: true, // Required for server operations
      family_id: familyDoc.id,
      user_type: 'student',
      family_joined_at: Math.floor(Date.now() / 1000),
      initialized: Date.now(),
    });

    functions.logger.info('Student joined family successfully', {
      familyId: familyDoc.id,
      studentId,
      familyName: familyData.name
    });

    return {
      success: true,
      familyId: familyDoc.id,
      familyName: familyData.name,
      message: 'Successfully joined family'
    };

  } catch (error: any) {
    functions.logger.error('Error joining family server-side', { studentId, error: error.message });

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError('internal', `Failed to join family: ${error.message}`);
  }
});