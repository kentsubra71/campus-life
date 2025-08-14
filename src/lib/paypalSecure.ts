import { db } from './firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';

// Only expose client ID - server secret is hidden
const PAYPAL_CLIENT_ID = process.env.EXPO_PUBLIC_PAYPAL_CLIENT_ID;
const PAYPAL_ENVIRONMENT = process.env.EXPO_PUBLIC_PAYPAL_ENVIRONMENT || 'sandbox';

// Server endpoint for secure PayPal operations
const SERVER_BASE_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'https://campus-life-auth-website.vercel.app';

interface PayPalOrderResponse {
  success: boolean;
  orderId?: string;
  approvalUrl?: string;
  error?: string;
}

interface PayPalStatusResponse {
  success: boolean;
  status?: string;
  error?: string;
}

// Create PayPal order via secure server endpoint
export const createSecurePayPalOrder = async (
  amount_cents: number,
  recipient_email: string,
  payment_id: string,
  note: string = ''
): Promise<PayPalOrderResponse> => {
  try {
    if (!PAYPAL_CLIENT_ID) {
      throw new Error('PayPal not configured');
    }

    // Validate inputs
    if (amount_cents <= 0 || amount_cents > 10000000) { // Max $100,000
      throw new Error('Invalid payment amount');
    }

    if (!recipient_email || !recipient_email.includes('@')) {
      throw new Error('Valid recipient email required');
    }

    const response = await fetch(`${SERVER_BASE_URL}/api/paypal/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount_cents,
        recipient_email,
        payment_id,
        note,
        environment: PAYPAL_ENVIRONMENT
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to create PayPal order' };
    }

    // Store PayPal Order ID in our database
    try {
      await updateDoc(doc(db, 'payments', payment_id), {
        paypal_order_id: data.orderId
      });
    } catch (dbError) {
      console.warn('Failed to store PayPal Order ID:', dbError);
    }

    return {
      success: true,
      orderId: data.orderId,
      approvalUrl: data.approvalUrl
    };

  } catch (error: any) {
    console.error('PayPal order creation error:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
};

// Check PayPal order status via secure server endpoint
export const checkSecurePayPalStatus = async (orderId: string): Promise<PayPalStatusResponse> => {
  try {
    if (!orderId) {
      return { success: false, error: 'Order ID required' };
    }

    const response = await fetch(`${SERVER_BASE_URL}/api/paypal/check-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId,
        environment: PAYPAL_ENVIRONMENT
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to check PayPal status' };
    }

    return {
      success: true,
      status: data.status
    };

  } catch (error: any) {
    console.error('PayPal status check error:', error);
    return { success: false, error: error.message || 'Network error' };
  }
};

// Verify and capture PayPal payment via secure server endpoint
export const verifySecurePayPalPayment = async (
  paymentId: string,
  orderId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch(`${SERVER_BASE_URL}/api/paypal/capture-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId,
        environment: PAYPAL_ENVIRONMENT
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return { success: false, error: data.message || 'Payment capture failed' };
    }

    // Update our payment record
    await updateDoc(doc(db, 'payments', paymentId), {
      status: 'completed',
      provider_transaction_id: orderId,
      completed_at: Timestamp.now(),
      verification_method: 'paypal_server_api'
    });

    return { success: true };

  } catch (error: any) {
    console.error('PayPal verification error:', error);
    return { success: false, error: error.message || 'Verification failed' };
  }
};

// Auto-verify completed PayPal payments using secure endpoints
export const autoVerifySecurePayPalPayments = async (userId: string): Promise<number> => {
  if (!userId) {
    throw new Error('User ID required');
  }

  if (!PAYPAL_CLIENT_ID) {
    console.warn('PayPal not configured - skipping verification');
    return 0;
  }

  const { collection, query, where, getDocs } = await import('firebase/firestore');
  const { db } = await import('./firebase');

  try {
    // Get pending PayPal payments
    const q = query(
      collection(db, 'payments'),
      where('parent_id', '==', userId),
      where('provider', '==', 'paypal'),
      where('status', '==', 'initiated')
    );

    const snapshot = await getDocs(q);
    let verifiedCount = 0;

    console.log(`🔍 Checking ${snapshot.size} pending PayPal payments via secure server...`);

    for (const paymentDoc of snapshot.docs) {
      const payment = paymentDoc.data();

      if (!payment.paypal_order_id) {
        continue;
      }

      const statusResult = await checkSecurePayPalStatus(payment.paypal_order_id);

      if (statusResult.success && (statusResult.status === 'COMPLETED' || statusResult.status === 'APPROVED')) {
        const verifyResult = await verifySecurePayPalPayment(paymentDoc.id, payment.paypal_order_id);

        if (verifyResult.success) {
          verifiedCount++;
          console.log(`✅ Auto-verified payment: ${paymentDoc.id}`);
        }
      } else if (!statusResult.success && statusResult.error?.includes('404')) {
        // Mark expired orders as failed
        try {
          await updateDoc(doc(db, 'payments', paymentDoc.id), {
            status: 'failed',
            error_message: 'PayPal order expired',
            updated_at: Timestamp.now()
          });
          console.log(`⚠️ Marked expired payment as failed: ${paymentDoc.id}`);
        } catch (updateError) {
          console.error('Failed to update expired payment:', updateError);
        }
      }
    }

    return verifiedCount;

  } catch (error: any) {
    console.error('Secure auto-verify error:', error);
    throw error; // Re-throw to be handled by caller
  }
};

// Get PayPal configuration for client-side
export const getPayPalConfig = () => ({
  clientId: PAYPAL_CLIENT_ID,
  environment: PAYPAL_ENVIRONMENT,
  isConfigured: !!PAYPAL_CLIENT_ID
});