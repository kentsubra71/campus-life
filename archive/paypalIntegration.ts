import { db } from './firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';

// PayPal client ID is safe to expose (not a secret)
const PAYPAL_CLIENT_ID = process.env.EXPO_PUBLIC_PAYPAL_CLIENT_ID;

// SECURITY: Client secrets and server-side operations are handled by Cloud Functions
// The client should NOT have access to PayPal secrets or make direct API calls

// Create PayPal order using secure Cloud Function
export const createPayPalOrder = async (
  studentId: string,
  amountCents: number,
  note: string = ''
): Promise<{ success: boolean; transactionId?: string; paymentId?: string; orderId?: string; approvalUrl?: string; error?: string }> => {
  try {
    // Import Firebase functions dynamically
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const { initializeApp, getApps } = await import('firebase/app');
    
    // Get Firebase app instance
    let app;
    if (getApps().length === 0) {
      const { firebaseConfig } = await import('./firebase');
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    
    const functions = getFunctions(app);
    const createPayPalOrderFunction = httpsCallable(functions, 'createPayPalOrder');
    
    console.log('📞 Calling createPayPalOrder Cloud Function:', { studentId, amountCents, note });
    
    const result = await createPayPalOrderFunction({
      studentId,
      amountCents,
      note
    });
    
    console.log('✅ Cloud Function result:', result.data);
    
    return result.data as { 
      success: boolean; 
      transactionId?: string; 
      paymentId?: string; 
      orderId?: string; 
      approvalUrl?: string; 
      error?: string;
    };
    
  } catch (error: any) {
    console.error('❌ PayPal order creation failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to create PayPal order'
    };
  }
};

// Verify PayPal payment using secure Cloud Function
export const verifyPayPalPayment = async (
  transactionId: string, 
  orderId: string, 
  payerID?: string
): Promise<{ success: boolean; status?: string; message?: string; error?: string }> => {
  try {
    // Import Firebase functions dynamically
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const { initializeApp, getApps } = await import('firebase/app');
    
    // Get Firebase app instance
    let app;
    if (getApps().length === 0) {
      const { firebaseConfig } = await import('./firebase');
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    
    const functions = getFunctions(app);
    const verifyPayPalPaymentFunction = httpsCallable(functions, 'verifyPayPalPayment');
    
    console.log('📞 Calling verifyPayPalPayment Cloud Function:', { transactionId, orderId, payerID });
    
    const result = await verifyPayPalPaymentFunction({
      transactionId,
      orderId,
      payerID
    });
    
    console.log('✅ Verification result:', result.data);
    
    return result.data as { 
      success: boolean; 
      status?: string; 
      message?: string; 
      error?: string;
    };
    
  } catch (error: any) {
    console.error('❌ PayPal verification failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to verify PayPal payment'
    };
  }
};

// Get transaction status using secure Cloud Function
export const getTransactionStatus = async (transactionId: string): Promise<{ success: boolean; transaction?: any; error?: string }> => {
  try {
    if (!transactionId) {
      return { success: false, error: 'Transaction ID is required' };
    }
    
    // Import Firebase functions dynamically
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const { initializeApp, getApps } = await import('firebase/app');
    
    // Get Firebase app instance
    let app;
    if (getApps().length === 0) {
      const { firebaseConfig } = await import('./firebase');
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    
    const functions = getFunctions(app);
    const getTransactionStatusFunction = httpsCallable(functions, 'getTransactionStatus');
    
    console.log('📞 Calling getTransactionStatus Cloud Function:', { transactionId });
    
    const result = await getTransactionStatusFunction({
      transactionId
    });
    
    console.log('✅ Transaction status result:', result.data);
    
    return result.data as { 
      success: boolean; 
      transaction?: any; 
      error?: string;
    };
    
  } catch (error: any) {
    console.error('❌ Get transaction status failed:', error);
    return { success: false, error: error.message || 'Failed to get transaction status' };
  }
};

// Auto-verify completed PayPal payments by checking stored Order IDs
export const autoVerifyPendingPayPalPayments = async (userId: string): Promise<number> => {
  if (!userId) {
    throw new Error('User ID is required for PayPal verification');
  }
  
  const { collection, query, where, getDocs } = await import('firebase/firestore');
  const { db } = await import('./firebase');
  
  try {
    // Check if PayPal is properly configured before proceeding
    if (!PAYPAL_CLIENT_ID) {
      console.warn('⚠️ PayPal client ID not configured - skipping auto-verification');
      return 0;
    }
    
    // Get all pending PayPal payments for this user that have Order IDs
    const q = query(
      collection(db, 'payments'),
      where('parent_id', '==', userId),
      where('provider', '==', 'paypal'),
      where('status', '==', 'initiated')
    );
    
    const snapshot = await getDocs(q);
    let verifiedCount = 0;
    
    console.log(`🔍 Checking ${snapshot.size} pending PayPal payments...`);
    
    // Check ALL payments - no artificial limits
    const paymentsToCheck = snapshot.docs;
    
    console.log(`🔍 Checking ALL ${snapshot.size} pending PayPal payments...`);
    
    for (const paymentDoc of paymentsToCheck) {
      const payment = paymentDoc.data();
      
      // Skip if no PayPal Order ID stored
      if (!payment.paypal_order_id) {
        console.log(`⏭️  Skipping payment ${paymentDoc.id} - no PayPal Order ID`);
        continue;
      }
      
      // Use Cloud Function to verify PayPal payment
      console.log(`🔍 Verifying PayPal payment ${paymentDoc.id} with Order ID: ${payment.paypal_order_id}`);
      const verifyResult = await verifyPayPalPayment(paymentDoc.id, payment.paypal_order_id);
      
      console.log(`📊 PayPal verification result:`, verifyResult);
      
      if (verifyResult.success) {
        verifiedCount++;
        console.log(`🎉 Auto-verified payment: ${paymentDoc.id}`);
      } else if (verifyResult.error?.includes('expired') || 
                 verifyResult.error?.includes('not found') || 
                 verifyResult.error?.includes('cancelled') ||
                 verifyResult.error?.includes('not completed')) {
        // Handle expired/cancelled orders - PayPal order not found, expired, or cancelled
        const reason = verifyResult.error.includes('cancelled') || verifyResult.error.includes('not completed') 
          ? 'cancelled by user' 
          : 'expired or not found';
        console.log(`🗑️ PayPal order ${payment.paypal_order_id} ${reason} - marking payment as failed.`);
        
        try {
          // Mark the payment as failed since the PayPal order no longer exists or was cancelled
          await updateDoc(doc(db, 'payments', paymentDoc.id), {
            status: 'failed',
            error_message: `PayPal payment ${reason}`,
            updated_at: Timestamp.now()
          });
          console.log(`⚠️ Marked payment ${paymentDoc.id} as failed due to ${reason}`);
        } catch (updateError) {
          console.error(`❌ Failed to update payment status:`, updateError);
        }
      } else {
        console.log(`⏳ Payment ${paymentDoc.id} verification pending: ${verifyResult.message || 'Unknown'}`);
        const errorMsg = verifyResult.error || 'No error details provided';
        console.error(`❌ Verification error for ${paymentDoc.id}:`, errorMsg);
      }
      
      // No delays - check all payments as fast as possible
      // Removed artificial rate limiting delays
    }
    
    return verifiedCount;
    
  } catch (error: any) {
    console.error('Auto-verify error:', error);
    return 0;
  }
};

// The old verifyPayPalPayment function has been replaced with a Cloud Function version above
// All PayPal API operations are now handled securely on the server-side