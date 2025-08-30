"use strict";
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushNotification = exports.testPayPalConnection = exports.getTransactionStatus = exports.verifyPayPalPayment = exports.createPayPalOrder = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios_1 = require("axios");
const dotenv_1 = require("dotenv");
const expo_server_sdk_1 = require("expo-server-sdk");
// Load environment variables
(0, dotenv_1.config)();
// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
// Initialize Expo SDK for push notifications
const expo = new expo_server_sdk_1.Expo();
// PayPal Configuration - prioritize environment variables over functions.config()
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || ((_a = functions.config().paypal) === null || _a === void 0 ? void 0 : _a.client_id);
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || ((_b = functions.config().paypal) === null || _b === void 0 ? void 0 : _b.client_secret);
const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || ((_c = functions.config().paypal) === null || _c === void 0 ? void 0 : _c.base_url) || 'https://api-m.sandbox.paypal.com';
// Debug logging function - updated for payments collection
const debugLog = (functionName, message, data) => {
    console.log(`🔍 [${functionName}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
};
// Get PayPal Access Token
const getPayPalAccessToken = async () => {
    var _a;
    debugLog('getPayPalAccessToken', 'Requesting PayPal access token');
    try {
        const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
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
exports.createPayPalOrder = functions.https.onCall(async (data, context) => {
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
        const recipientEmail = studentData.paypal_email || studentData.email;
        if (!recipientEmail) {
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
        // Update the PayPal order with custom return URLs that include our payment ID
        const updateData = {
            op: 'replace',
            path: '/application_context/return_url',
            value: `https://campus-life-verification.vercel.app/api/paypal-success?paymentId=${paymentRef.id}`
        };
        try {
            await axios_1.default.patch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}`, [updateData], {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            debugLog('createPayPalOrder', 'Updated return URL with payment ID', { paymentId: paymentRef.id });
        }
        catch (patchError) {
            debugLog('createPayPalOrder', 'Failed to update return URL, using default', patchError);
        }
        debugLog('createPayPalOrder', 'Payment record created', { paymentId: paymentRef.id });
        return {
            success: true,
            transactionId: paymentRef.id,
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
exports.verifyPayPalPayment = functions.https.onCall(async (data, context) => {
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
    try {
        // Get payment record
        const paymentRef = db.collection('payments').doc(transactionId);
        const paymentDoc = await paymentRef.get();
        if (!paymentDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Payment not found');
        }
        const payment = paymentDoc.data();
        // Verify user owns this payment
        if (payment.parent_id !== context.auth.uid) {
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
                paypal_order_data: orderData,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
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
            // Update payment based on capture status
            const updateData = {
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
            }
            else {
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
    }
    catch (error) {
        debugLog('verifyPayPalPayment', 'Error verifying payment', error);
        const errorMessage = ((_k = (_j = error.response) === null || _j === void 0 ? void 0 : _j.data) === null || _k === void 0 ? void 0 : _k.message) || error.message;
        // Update payment as failed
        try {
            await db.collection('payments').doc(transactionId).update({
                status: 'failed',
                error: errorMessage,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
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
exports.testPayPalConnection = functions.https.onCall(async (data, context) => {
    var _a;
    debugLog('testPayPalConnection', 'Function called', { userId: (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid });
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const credentialsInfo = {
        hasClientId: !!PAYPAL_CLIENT_ID,
        hasClientSecret: !!PAYPAL_CLIENT_SECRET,
        clientIdLength: PAYPAL_CLIENT_ID ? PAYPAL_CLIENT_ID.length : 0,
        secretLength: PAYPAL_CLIENT_SECRET ? PAYPAL_CLIENT_SECRET.length : 0,
        baseUrl: PAYPAL_BASE_URL
    };
    debugLog('testPayPalConnection', 'Credentials check', credentialsInfo);
    // Check if we have placeholder or real credentials
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET ||
        PAYPAL_CLIENT_ID === 'test_client_id' ||
        PAYPAL_CLIENT_SECRET === 'test_client_secret') {
        return {
            success: false,
            error: 'PayPal credentials not configured. Please set real PayPal sandbox credentials.',
            details: 'You need to set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to your actual PayPal sandbox app credentials.',
            credentialsInfo,
            setupInstructions: [
                '1. Go to https://developer.paypal.com/',
                '2. Create a sandbox application',
                '3. Get your Client ID and Secret',
                '4. Update functions/.env file with real credentials',
                '5. Run: firebase deploy --only functions'
            ]
        };
    }
    try {
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
            credentialsInfo,
            details: 'Failed to get access token from PayPal. Check your credentials.'
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
        default:
            return true;
    }
}
//# sourceMappingURL=index.js.map