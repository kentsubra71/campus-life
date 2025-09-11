import { db } from './firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

// Firebase function references
const createPayPalOrderFunction = httpsCallable(functions, 'createPayPalOrder');
const verifyPayPalPaymentFunction = httpsCallable(functions, 'verifyPayPalPayment');
const testPayPalConnectionFunction = httpsCallable(functions, 'testPayPalConnection');

interface PayPalOrderResponse {
  orderId: string;
  approvalUrl: string;
}

interface PayPalVerificationResponse {
  success: boolean;
  status?: string;
  message?: string;
  paymentId?: string;
  error?: string;
}

// Create PayPal order using Firebase Functions
export const createPayPalOrder = async (
  amount_cents: number,
  recipient_email: string,
  payment_id: string,
  note: string = ''
): Promise<PayPalOrderResponse> => {
  try {
    console.log('🔵 Creating PayPal order via Firebase Functions...', {
      amount_cents,
      recipient_email,
      payment_id,
      note
    });

    const result = await createPayPalOrderFunction({
      amount_cents,
      recipient_email,
      payment_id,
      note
    });

    const data = result.data as any;
    
    if (!data.orderId || !data.approvalUrl) {
      throw new Error(data.error || 'Invalid response from PayPal order creation');
    }

    // Store PayPal Order ID in our database
    try {
      await updateDoc(doc(db, 'payments', payment_id), {
        paypal_order_id: data.orderId,
        updated_at: Timestamp.now()
      });
    } catch (dbError) {
      console.warn('Failed to store PayPal Order ID:', dbError);
    }

    console.log('✅ PayPal order created successfully:', {
      orderId: data.orderId,
      approvalUrl: data.approvalUrl
    });

    return {
      orderId: data.orderId,
      approvalUrl: data.approvalUrl
    };

  } catch (error: any) {
    console.error('❌ PayPal order creation failed:', error);
    throw new Error(error.message || 'Failed to create PayPal order');
  }
};

// Verify PayPal payment using Firebase Functions
export const verifyPayPalPayment = async (
  paymentId: string,
  orderId: string
): Promise<boolean> => {
  try {
    console.log('🔍 Verifying PayPal payment via Firebase Functions...', {
      paymentId,
      orderId
    });

    const result = await verifyPayPalPaymentFunction({
      paymentId,
      orderId
    });

    const data = result.data as PayPalVerificationResponse;
    
    if (!data.success) {
      console.error('❌ PayPal payment verification failed:', data.message || data.error);
      return false;
    }

    console.log('✅ PayPal payment verified successfully:', data.message);
    return true;

  } catch (error: any) {
    console.error('❌ PayPal verification error:', error);
    return false;
  }
};

// Test PayPal connection
export const testPayPalConnection = async (): Promise<boolean> => {
  try {
    console.log('🧪 Testing PayPal connection via Firebase Functions...');

    const result = await testPayPalConnectionFunction();
    const data = result.data as any;
    
    if (data.success) {
      console.log('✅ PayPal connection test successful');
      return true;
    } else {
      console.error('❌ PayPal connection test failed:', data.error);
      return false;
    }

  } catch (error: any) {
    console.error('❌ PayPal connection test error:', error);
    return false;
  }
};

// Auto-verify pending PayPal payments using Firebase Functions
export const autoVerifyPendingPayPalPayments = async (userId: string): Promise<number> => {
  if (!userId) {
    throw new Error('User ID required');
  }

  const { collection, query, where, getDocs } = await import('firebase/firestore');

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

    console.log(`🔍 Auto-verifying ${snapshot.size} pending PayPal payments via Firebase Functions...`);

    for (const paymentDoc of snapshot.docs) {
      const payment = paymentDoc.data();

      if (!payment.paypal_order_id) {
        continue;
      }

      const verified = await verifyPayPalPayment(paymentDoc.id, payment.paypal_order_id);

      if (verified) {
        verifiedCount++;
        console.log(`✅ Auto-verified payment: ${paymentDoc.id}`);
      }
    }

    return verifiedCount;

  } catch (error: any) {
    console.error('Auto-verify error:', error);
    throw error;
  }
};

// Check PayPal order status (placeholder - you might want to add this Firebase function)
export const checkPayPalOrderStatus = async (orderId: string): Promise<string> => {
  // This would need a corresponding Firebase Function
  // For now, return unknown
  console.warn('checkPayPalOrderStatus not implemented with Firebase Functions');
  return 'unknown';
};