"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPasswordResetEmailHttp = exports.sendPasswordChangeConfirmationHttp = exports.resetPasswordHttp = exports.sendEmail = exports.sendPushNotification = exports.testPayPalConnection = exports.getTransactionStatus = exports.verifyPayPalPayment = exports.createPayPalOrder = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios_1 = require("axios");
const expo_server_sdk_1 = require("expo-server-sdk");
const params_1 = require("firebase-functions/params");
// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
// Initialize Expo SDK for push notifications
const expo = new expo_server_sdk_1.Expo();
// Secure secret definitions using Firebase Secret Manager
const PAYPAL_CLIENT_ID = (0, params_1.defineSecret)('PAYPAL_CLIENT_ID');
const PAYPAL_CLIENT_SECRET = (0, params_1.defineSecret)('PAYPAL_CLIENT_SECRET');
const RESEND_API_KEY = (0, params_1.defineSecret)('RESEND_API_KEY');
// PayPal Configuration
const PAYPAL_BASE_URL = 'https://api-m.sandbox.paypal.com'; // Use production URL for live app
// Debug logging function - updated for payments collection
const debugLog = (functionName, message, data) => {
    console.log(`🔍 [${functionName}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
};
// Get PayPal Access Token (now secure with secrets)
const getPayPalAccessToken = async () => {
    var _a;
    debugLog('getPayPalAccessToken', 'Requesting PayPal access token');
    try {
        const clientId = PAYPAL_CLIENT_ID.value();
        const clientSecret = PAYPAL_CLIENT_SECRET.value();
        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const response = await axios_1.default.post(`${PAYPAL_BASE_URL}/v1/oauth2/token`, 'grant_type=client_credentials', {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        debugLog('getPayPalAccessToken', 'Access token received successfully');
        return response.data.access_token;
    }
    catch (error) {
        debugLog('getPayPalAccessToken', 'Error getting access token', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
        throw new Error('Failed to get PayPal access token');
    }
};
// Create PayPal Order for P2P Payment
exports.createPayPalOrder = functions
    .runWith({ secrets: [PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET] })
    .https.onCall(async (data, context) => {
    var _a, _b;
    debugLog('createPayPalOrder', 'Function called', { userId: (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid, data });
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
        const studentData = studentDoc.data();
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
        const response = await axios_1.default.post(`${PAYPAL_BASE_URL}/v2/checkout/orders`, orderData, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });
        const orderId = response.data.id;
        const approvalUrl = (_b = response.data.links.find((link) => link.rel === 'approve')) === null || _b === void 0 ? void 0 : _b.href;
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
    }
    catch (error) {
        debugLog('createPayPalOrder', 'Error creating order', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to create payment order');
    }
});
// Verify and Capture PayPal Payment
exports.verifyPayPalPayment = functions
    .runWith({ secrets: [PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET] })
    .https.onCall(async (data, context) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    debugLog('verifyPayPalPayment', 'Function called', { userId: (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid, data });
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { transactionId, orderId, payerID } = data;
    if (!transactionId || !orderId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing transaction or order ID');
    }
    // Declare paymentRef outside try block so it's accessible in catch block
    let paymentRef = null;
    try {
        // Try transactions collection first (P2P payments), then payments collection (regular payments)
        paymentRef = db.collection('transactions').doc(transactionId);
        let paymentDoc = await paymentRef.get();
        let isP2P = true;
        if (!paymentDoc.exists) {
            // Fallback to payments collection for regular payments
            paymentRef = db.collection('payments').doc(transactionId);
            paymentDoc = await paymentRef.get();
            isP2P = false;
        }
        if (!paymentDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Payment not found in either transactions or payments collection');
        }
        const payment = paymentDoc.data();
        // Verify user owns this payment (different field names for P2P vs regular payments)
        const parentId = isP2P ? payment.parentId : payment.parent_id;
        if (parentId !== context.auth.uid) {
            throw new functions.https.HttpsError('permission-denied', 'Unauthorized access to payment');
        }
        debugLog('verifyPayPalPayment', 'Verifying PayPal order', { orderId, payerID });
        // Get PayPal access token
        const accessToken = await getPayPalAccessToken();
        // First, check the current order status
        const orderResponse = await axios_1.default.get(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}`, {
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
                paypalOrderData: orderData,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return {
                success: false,
                status: 'pending_payment',
                message: 'Payment not completed yet. Please complete the payment in PayPal first.',
                transactionId,
                approvalUrl: (_c = (_b = orderData.links) === null || _b === void 0 ? void 0 : _b.find((link) => link.rel === 'approve')) === null || _c === void 0 ? void 0 : _c.href
            };
        }
        if (orderStatus === 'APPROVED') {
            // Order was approved by user, now capture it
            debugLog('verifyPayPalPayment', 'Order approved, capturing payment');
            const captureResponse = await axios_1.default.post(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {}, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            const captureData = captureResponse.data;
            const captureStatus = captureData.status;
            const captureId = (_h = (_g = (_f = (_e = (_d = captureData.purchase_units) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.payments) === null || _f === void 0 ? void 0 : _f.captures) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.id;
            debugLog('verifyPayPalPayment', 'PayPal capture response', { captureStatus, captureId });
            // Update payment based on capture status (use different field names for P2P vs regular payments)
            const updateData = {
                paypalCaptureId: captureId,
                paypalCaptureData: captureData,
                paypalOrderData: orderData,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            if (captureStatus === 'COMPLETED' || captureStatus === 'PENDING') {
                updateData.status = 'completed';
                updateData.completedAt = admin.firestore.FieldValue.serverTimestamp();
                debugLog('verifyPayPalPayment', 'Payment completed successfully', { captureStatus });
                // Log PENDING status for P2P payments (common in sandbox)
                if (captureStatus === 'PENDING') {
                    debugLog('verifyPayPalPayment', 'PENDING capture status - treating as completed for P2P payment');
                }
            }
            else {
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
                paypalOrderData: orderData,
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
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
            paypalOrderData: orderData,
            error: `PayPal order status: ${orderStatus}`,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return {
            success: false,
            status: orderStatus,
            message: `Payment ${orderStatus.toLowerCase()}`,
            transactionId
        };
    }
    catch (error) {
        debugLog('verifyPayPalPayment', 'Error verifying payment', error);
        const errorMessage = ((_k = (_j = error.response) === null || _j === void 0 ? void 0 : _j.data) === null || _k === void 0 ? void 0 : _k.message) || error.message;
        // Update payment as failed
        try {
            // Use the correct reference that was already determined (if it exists)
            if (paymentRef) {
                await paymentRef.update({
                    status: 'failed',
                    error: errorMessage,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        }
        catch (updateError) {
            debugLog('verifyPayPalPayment', 'Error updating failed payment', updateError);
        }
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', `Failed to verify payment: ${errorMessage}`);
    }
});
// Get Transaction Status (for debugging and monitoring)
exports.getTransactionStatus = functions.https.onCall(async (data, context) => {
    var _a;
    debugLog('getTransactionStatus', 'Function called', { userId: (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid, data });
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
        const payment = paymentDoc.data();
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
    }
    catch (error) {
        debugLog('getTransactionStatus', 'Error getting transaction', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to get transaction status');
    }
});
// Debug endpoint for testing PayPal connection
exports.testPayPalConnection = functions
    .runWith({ secrets: [PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET] })
    .https.onCall(async (data, context) => {
    var _a;
    debugLog('testPayPalConnection', 'Function called', { userId: (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid });
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
    }
    catch (error) {
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
exports.sendPushNotification = functions.https.onCall(async (data, context) => {
    var _a;
    debugLog('sendPushNotification', 'Function called', { userId: (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid, data });
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
        const userData = userDoc.data();
        const pushToken = userData.pushToken;
        const preferences = userData.notificationPreferences;
        // Check if notifications are enabled for this user
        if (!(preferences === null || preferences === void 0 ? void 0 : preferences.enabled)) {
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
        if (!pushToken || !expo_server_sdk_1.Expo.isExpoPushToken(pushToken)) {
            debugLog('sendPushNotification', 'Invalid or missing push token', { userId, pushToken });
            return { success: false, reason: 'invalid_push_token' };
        }
        // Create the notification message
        const message = {
            to: pushToken,
            sound: 'default',
            title,
            body,
            data: Object.assign({ type,
                userId }, notificationData),
            priority: (type === 'care_request' || type === 'support_received' ? 'high' : 'default')
        };
        debugLog('sendPushNotification', 'Sending notification', { message });
        // Send the notification
        const chunks = expo.chunkPushNotifications([message]);
        const tickets = [];
        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            }
            catch (error) {
                debugLog('sendPushNotification', 'Error sending notification chunk', error);
            }
        }
        // Check for errors in tickets
        const hasErrors = tickets.some(ticket => ticket.status === 'error');
        if (hasErrors) {
            debugLog('sendPushNotification', 'Some notifications failed', { tickets });
        }
        else {
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
    }
    catch (error) {
        debugLog('sendPushNotification', 'Error sending notification', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', `Failed to send notification: ${error.message}`);
    }
});
// Helper function to check notification type preferences
function checkNotificationTypeEnabled(type, preferences) {
    if (!preferences)
        return true;
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
exports.sendEmail = functions
    .runWith({ secrets: [RESEND_API_KEY] })
    .https.onCall(async (data, context) => {
    var _a, _b, _c, _d;
    debugLog('sendEmail', 'Function called', {
        userId: (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid,
        hasAuth: !!context.auth,
        data: Object.assign(Object.assign({}, data), { verificationUrl: '[REDACTED]' })
    });
    const { to, type, emailData } = data;
    // Allow unauthenticated calls for password reset emails only
    if (!context.auth && type !== 'password_reset') {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
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
        const template = templates[type];
        debugLog('sendEmail', 'Sending email via Resend', { to, type, subject: template.subject });
        // Send email using Resend API
        const response = await axios_1.default.post('https://api.resend.com/emails', {
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
    }
    catch (error) {
        debugLog('sendEmail', 'Error sending email', ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        const errorMessage = ((_d = (_c = error.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) || error.message || 'Failed to send email';
        throw new functions.https.HttpsError('internal', `Email service error: ${errorMessage}`);
    }
});
// Reset Password using Firebase Admin SDK (unauthenticated endpoint for password reset)
exports.resetPasswordHttp = functions.https.onRequest(async (req, res) => {
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
        const tokenData = tokenDoc.data();
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
        }
        catch (emailError) {
            debugLog('resetPassword', 'Failed to send confirmation email', emailError);
            // Don't fail the password reset if email fails
        }
        res.status(200).json({
            success: true,
            message: 'Password reset successfully'
        });
    }
    catch (error) {
        debugLog('resetPassword', 'Error resetting password', error);
        const errorMessage = error.message || 'Failed to reset password';
        res.status(500).json({
            success: false,
            error: `Password reset failed: ${errorMessage}`
        });
    }
});
// Send Password Change Confirmation Email via HTTP
exports.sendPasswordChangeConfirmationHttp = functions.https.onRequest(async (req, res) => {
    var _a, _b;
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
        const userName = (userData === null || userData === void 0 ? void 0 : userData.full_name) || 'Campus Life User';
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
    }
    catch (error) {
        debugLog('sendPasswordChangeConfirmation', 'Error sending confirmation email', error);
        const errorMessage = ((_b = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || error.message || 'Failed to send confirmation email';
        res.status(500).json({
            success: false,
            error: `Email service error: ${errorMessage}`
        });
    }
});
// Send Password Reset Email via HTTP (unauthenticated endpoint)
exports.sendPasswordResetEmailHttp = functions
    .runWith({ secrets: [RESEND_API_KEY] })
    .https.onRequest(async (req, res) => {
    var _a, _b, _c;
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
        const response = await axios_1.default.post('https://api.resend.com/emails', {
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
    }
    catch (error) {
        debugLog('sendPasswordResetEmail', 'Error sending email', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
        const errorMessage = ((_c = (_b = error.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || error.message || 'Failed to send email';
        res.status(500).json({
            success: false,
            error: `Email service error: ${errorMessage}`
        });
    }
});
//# sourceMappingURL=index.js.map