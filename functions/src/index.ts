import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { Expo } from 'expo-server-sdk';
import { defineSecret } from 'firebase-functions/params';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Initialize Expo SDK for push notifications
const expo = new Expo();

// Secure secret definitions using Firebase Secret Manager
const PAYPAL_CLIENT_ID = defineSecret('PAYPAL_CLIENT_ID');
const PAYPAL_CLIENT_SECRET = defineSecret('PAYPAL_CLIENT_SECRET');
const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

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
        return_url: `https://campus-life-verification.vercel.app/api/paypal-success`,
        cancel_url: `https://campus-life-verification.vercel.app/api/paypal-cancel`,
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
      intent_cents: amountCents,
      note: note || '',
      recipient_email: recipientEmail,
      status: 'initiated',
      provider: 'paypal',
      completion_method: 'direct_paypal',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      idempotency_key: `paypal_${orderId}_${Date.now()}`
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
    const orderStatus = orderData.status;

    debugLog('verifyPayPalPayment', 'PayPal order status', { orderStatus, orderData });

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

      await paymentRef.update(updateData);

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
      message: `Payment ${orderStatus.toLowerCase()}`,
      transactionId
    };

  } catch (error: any) {
    debugLog('verifyPayPalPayment', 'Error verifying payment', error);
    
    const errorMessage = error.response?.data?.message || error.message;
    
    // Update payment as failed
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
    
    throw new functions.https.HttpsError('internal', `Failed to verify payment: ${errorMessage}`);
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
  debugLog('sendEmail', 'Function called', { userId: context.auth?.uid, data: { ...data, verificationUrl: '[REDACTED]' } });
  
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { to, type, emailData } = data;

  // Validate input
  if (!to || !type || !emailData) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required email data');
  }

  // Validate email type
  if (!['email_verification', 'password_reset'].includes(type)) {
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