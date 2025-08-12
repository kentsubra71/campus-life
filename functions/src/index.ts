import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { config } from 'dotenv';

// Load environment variables
config();

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// PayPal Configuration - prioritize environment variables over functions.config()
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || functions.config().paypal?.client_id;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || functions.config().paypal?.client_secret;
const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || functions.config().paypal?.base_url || 'https://api-m.sandbox.paypal.com';

// Debug logging function
const debugLog = (functionName: string, message: string, data?: any) => {
  console.log(`🔍 [${functionName}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

// Get PayPal Access Token
const getPayPalAccessToken = async (): Promise<string> => {
  debugLog('getPayPalAccessToken', 'Requesting PayPal access token');
  
  try {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    
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
export const createPayPalOrder = functions.https.onCall(async (data, context) => {
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

    const response = await axios.post(`${PAYPAL_BASE_URL}/v2/checkout/orders`, orderData, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const orderId = response.data.id;
    const approvalUrl = response.data.links.find((link: any) => link.rel === 'approve')?.href;

    debugLog('createPayPalOrder', 'PayPal order created', { orderId, approvalUrl });

    // Create transaction record in Firestore
    const transactionData = {
      parentId: context.auth.uid,
      studentId,
      paypalOrderId: orderId,
      amountCents,
      note: note || '',
      recipientEmail,
      status: 'created',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const transactionRef = await db.collection('transactions').add(transactionData);

    debugLog('createPayPalOrder', 'Transaction record created', { transactionId: transactionRef.id });

    return {
      success: true,
      transactionId: transactionRef.id,
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
export const verifyPayPalPayment = functions.https.onCall(async (data, context) => {
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
    // Get transaction record
    const transactionRef = db.collection('transactions').doc(transactionId);
    const transactionDoc = await transactionRef.get();

    if (!transactionDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Transaction not found');
    }

    const transaction = transactionDoc.data()!;

    // Verify user owns this transaction
    if (transaction.parentId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Unauthorized access to transaction');
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
      await transactionRef.update({
        status: 'pending_payment',
        paypalOrderData: orderData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
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

      // Update transaction based on capture status
      const updateData: any = {
        paypalCaptureId: captureId,
        paypalCaptureData: captureData,
        paypalOrderData: orderData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (captureStatus === 'COMPLETED') {
        updateData.status = 'completed';
        updateData.completedAt = admin.firestore.FieldValue.serverTimestamp();
        debugLog('verifyPayPalPayment', 'Payment completed successfully');
      } else {
        updateData.status = 'failed';
        debugLog('verifyPayPalPayment', 'Payment capture failed', { captureStatus });
      }

      await transactionRef.update(updateData);

      return {
        success: captureStatus === 'COMPLETED',
        status: captureStatus,
        captureId,
        transactionId
      };
    }

    if (orderStatus === 'COMPLETED') {
      // Order already completed
      await transactionRef.update({
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
    await transactionRef.update({
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

  } catch (error: any) {
    debugLog('verifyPayPalPayment', 'Error verifying payment', error);
    
    const errorMessage = error.response?.data?.message || error.message;
    
    // Update transaction as failed
    try {
      await db.collection('transactions').doc(transactionId).update({
        status: 'failed',
        error: errorMessage,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (updateError) {
      debugLog('verifyPayPalPayment', 'Error updating failed transaction', updateError);
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
    const transactionDoc = await db.collection('transactions').doc(transactionId).get();

    if (!transactionDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Transaction not found');
    }

    const transaction = transactionDoc.data()!;

    // Verify user has access to this transaction
    if (transaction.parentId !== context.auth.uid && transaction.studentId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Unauthorized access to transaction');
    }

    debugLog('getTransactionStatus', 'Transaction found', { transactionId, status: transaction.status });

    return {
      success: true,
      transaction: {
        id: transactionId,
        status: transaction.status,
        amountCents: transaction.amountCents,
        note: transaction.note,
        createdAt: transaction.createdAt,
        completedAt: transaction.completedAt,
        recipientEmail: transaction.recipientEmail
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
export const testPayPalConnection = functions.https.onCall(async (data, context) => {
  debugLog('testPayPalConnection', 'Function called', { userId: context.auth?.uid });
  
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

  } catch (error: any) {
    debugLog('testPayPalConnection', 'PayPal connection failed', error);
    
    return {
      success: false,
      error: error.message,
      credentialsInfo,
      details: 'Failed to get access token from PayPal. Check your credentials.'
    };
  }
});