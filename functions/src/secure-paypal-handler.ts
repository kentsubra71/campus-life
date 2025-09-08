import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { CallableRequest } from 'firebase-functions/v2/https';
import crypto from 'crypto';
import axios from 'axios';

// CRITICAL: Environment validation - only check when actually used
function validatePayPalEnvironment() {
  const requiredEnvVars = [
    'PAYPAL_CLIENT_ID',
    'PAYPAL_CLIENT_SECRET',
    'PAYPAL_WEBHOOK_ID',
    'PAYPAL_ENVIRONMENT' // 'sandbox' or 'live'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`CRITICAL: Missing required environment variable: ${envVar}`);
    }
  }
}

const PAYPAL_API_BASE = process.env.PAYPAL_ENVIRONMENT === 'live' 
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource_type: string;
  resource: any;
  create_time: string;
  summary: string;
}

interface PaymentRecord {
  id: string;
  parent_id: string;
  student_id: string;
  amount_cents: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  paypal_order_id?: string;
  provider: string;
  created_at: admin.firestore.Timestamp;
  updated_at: admin.firestore.Timestamp;
}

// CRITICAL: Webhook signature verification
function verifyWebhookSignature(
  payload: string,
  signature: string,
  webhookId: string
): boolean {
  try {
    const elements = signature.split(',');
    const sigElements: { [key: string]: string } = {};
    
    for (const element of elements) {
      const [key, value] = element.split('=');
      sigElements[key] = value;
    }
    
    const timestamp = sigElements.t;
    const sig1 = sigElements.v1;
    
    if (!timestamp || !sig1) {
      functions.logger.error('Missing timestamp or signature');
      return false;
    }
    
    // CRITICAL: Check timestamp to prevent replay attacks (5 minutes)
    const timestampNum = parseInt(timestamp);
    const now = Math.floor(Date.now() / 1000);
    if (now - timestampNum > 300) {
      functions.logger.error('Webhook timestamp too old', { timestamp, now });
      return false;
    }
    
    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.PAYPAL_WEBHOOK_SECRET!)
      .update(timestamp + '.' + payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(sig1, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    functions.logger.error('Signature verification failed', { error });
    return false;
  }
}

// CRITICAL: Server-to-server payment verification
async function verifyPaymentWithPayPal(orderId: string): Promise<any> {
  validatePayPalEnvironment();
  
  try {
    // Get OAuth token
    const authResponse = await axios.post(
      `${PAYPAL_API_BASE}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        headers: {
          'Accept': 'application/json',
          'Accept-Language': 'en_US',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        auth: {
          username: process.env.PAYPAL_CLIENT_ID!,
          password: process.env.PAYPAL_CLIENT_SECRET!,
        },
        timeout: 10000,
      }
    );

    const accessToken = authResponse.data.access_token;

    // Verify order details
    const orderResponse = await axios.get(
      `${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    return orderResponse.data;
  } catch (error) {
    functions.logger.error('PayPal verification failed', { orderId, error });
    throw new Error('PayPal verification failed');
  }
}

// CRITICAL: Idempotent payment processing
async function processPaymentUpdate(
  paymentId: string,
  newStatus: string,
  paypalOrderId: string,
  webhookEventId: string
): Promise<void> {
  const db = admin.firestore();
  
  // CRITICAL: Use transaction for atomicity
  await db.runTransaction(async (transaction) => {
    const paymentRef = db.collection('payments').doc(paymentId);
    const paymentDoc = await transaction.get(paymentRef);
    
    if (!paymentDoc.exists) {
      functions.logger.error('Payment not found', { paymentId });
      throw new Error('Payment not found');
    }
    
    const payment = paymentDoc.data() as PaymentRecord;
    
    // CRITICAL: Idempotency check
    const idempotencyRef = db.collection('webhook_events').doc(webhookEventId);
    const idempotencyDoc = await transaction.get(idempotencyRef);
    
    if (idempotencyDoc.exists) {
      functions.logger.info('Webhook already processed', { webhookEventId });
      return;
    }
    
    // CRITICAL: Verify payment belongs to legitimate family
    const userRef = db.collection('users').doc(payment.parent_id);
    const userDoc = await transaction.get(userRef);
    
    if (!userDoc.exists || userDoc.data()?.user_type !== 'parent') {
      functions.logger.error('Invalid payment parent', { paymentId, parentId: payment.parent_id });
      throw new Error('Invalid payment parent');
    }
    
    // CRITICAL: Verify PayPal order matches our records
    const paypalOrder = await verifyPaymentWithPayPal(paypalOrderId);
    const paypalAmountCents = Math.round(parseFloat(paypalOrder.purchase_units[0].amount.value) * 100);
    
    if (paypalAmountCents !== payment.amount_cents) {
      functions.logger.error('Amount mismatch', { 
        paymentId, 
        ourAmount: payment.amount_cents, 
        paypalAmount: paypalAmountCents 
      });
      throw new Error('Payment amount mismatch');
    }
    
    // Update payment status
    transaction.update(paymentRef, {
      status: newStatus,
      paypal_order_id: paypalOrderId,
      paypal_verification_data: {
        verified_at: admin.firestore.FieldValue.serverTimestamp(),
        paypal_order_status: paypalOrder.status,
        amount_verified: paypalAmountCents,
      },
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    // Record webhook processing (idempotency)
    transaction.set(idempotencyRef, {
      event_id: webhookEventId,
      payment_id: paymentId,
      processed_at: admin.firestore.FieldValue.serverTimestamp(),
      status: newStatus,
    });
    
    // CRITICAL: Fraud detection logging
    const fraudScore = calculateFraudScore(payment, paypalOrder);
    if (fraudScore > 50) {
      functions.logger.error('HIGH FRAUD RISK DETECTED', {
        paymentId,
        parentId: payment.parent_id,
        fraudScore,
        paypalOrderId,
        amount: payment.amount_cents,
      });
      
      // Create fraud alert
      transaction.set(db.collection('fraud_alerts').doc(), {
        payment_id: paymentId,
        parent_id: payment.parent_id,
        fraud_score: fraudScore,
        detected_at: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending_review',
      });
    }
    
    functions.logger.info('Payment processed successfully', {
      paymentId,
      newStatus,
      fraudScore,
    });
  });
}

// CRITICAL: Fraud detection algorithm
function calculateFraudScore(payment: PaymentRecord, paypalOrder: any): number {
  let score = 0;
  
  // High amount transactions
  if (payment.amount_cents > 10000) score += 20; // > $100
  if (payment.amount_cents > 25000) score += 30; // > $250
  
  // Rapid transactions (implement based on user history)
  // TODO: Add user transaction history analysis
  
  // Unusual patterns
  const hour = new Date().getHours();
  if (hour < 6 || hour > 23) score += 10; // Late night transactions
  
  // PayPal specific checks
  if (paypalOrder.payer?.payer_info?.country_code !== 'US') score += 15;
  
  return Math.min(score, 100);
}

// CRITICAL: Main webhook handler
export const verifyPayPalPayment = functions.https.onRequest({
  timeoutSeconds: 30,
  memory: '512MiB',
  maxInstances: 10,
}, async (req, res) => {
  try {
    validatePayPalEnvironment();
  } catch (error) {
    functions.logger.error('PayPal environment not configured', { error });
    res.status(500).send('PayPal not configured');
    return;
  }
  // CRITICAL: Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }
  
  try {
    const signature = req.get('paypal-transmission-sig');
    const webhookId = req.get('paypal-transmission-id');
    const payload = JSON.stringify(req.body);
    
    if (!signature || !webhookId) {
      functions.logger.error('Missing PayPal headers');
      res.status(400).send('Missing required headers');
      return;
    }
    
    // CRITICAL: Verify webhook signature
    if (!verifyWebhookSignature(payload, signature, webhookId)) {
      functions.logger.error('Invalid webhook signature');
      res.status(401).send('Unauthorized');
      return;
    }
    
    const event: PayPalWebhookEvent = req.body;
    functions.logger.info('Processing PayPal webhook', { 
      eventType: event.event_type,
      eventId: event.id 
    });
    
    // Process different event types
    switch (event.event_type) {
      case 'CHECKOUT.ORDER.APPROVED':
        await processPaymentUpdate(
          event.resource.custom_id, // Our payment ID
          'processing',
          event.resource.id,
          event.id
        );
        break;
        
      case 'PAYMENT.CAPTURE.COMPLETED':
        await processPaymentUpdate(
          event.resource.custom_id,
          'completed',
          event.resource.supplementary_data?.related_ids?.order_id || event.resource.id,
          event.id
        );
        break;
        
      case 'PAYMENT.CAPTURE.DENIED':
        await processPaymentUpdate(
          event.resource.custom_id,
          'failed',
          event.resource.supplementary_data?.related_ids?.order_id || event.resource.id,
          event.id
        );
        break;
        
      default:
        functions.logger.info('Unhandled webhook event', { eventType: event.event_type });
    }
    
    res.status(200).send('OK');
    
  } catch (error) {
    functions.logger.error('Webhook processing failed', { error });
    res.status(500).send('Internal server error');
  }
});

// CRITICAL: Payment status verification endpoint (for client polling)
export const getPaymentStatus = functions.https.onCall({
  timeoutSeconds: 10,
}, async (request: CallableRequest) => {
  const { data, auth } = request;
  // CRITICAL: Authenticate user
  if (!auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }
  
  const { paymentId } = data;
  if (!paymentId) {
    throw new functions.https.HttpsError('invalid-argument', 'Payment ID required');
  }
  
  try {
    const db = admin.firestore();
    const paymentDoc = await db.collection('payments').doc(paymentId).get();
    
    if (!paymentDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Payment not found');
    }
    
    const payment = paymentDoc.data() as PaymentRecord;
    
    // CRITICAL: Verify user has access to this payment
    if (payment.parent_id !== auth.uid && payment.student_id !== auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied');
    }
    
    return {
      id: payment.id,
      status: payment.status,
      amount_cents: payment.amount_cents,
      updated_at: payment.updated_at,
    };
    
  } catch (error) {
    functions.logger.error('Payment status check failed', { paymentId, error });
    throw new functions.https.HttpsError('internal', 'Status check failed');
  }
});