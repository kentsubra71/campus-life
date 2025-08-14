import { db } from './firebase';
import { doc, updateDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { checkPayPalOrderStatus, verifyPayPalPayment } from './paypalIntegration';

/**
 * IMMEDIATE PayPal verification - runs without delays for testing
 * This is a faster version of autoVerifyPendingPayPalPayments for debugging
 */
export const immediateVerifyPendingPayPalPayments = async (userId: string): Promise<number> => {
  if (!userId) {
    throw new Error('User ID is required for PayPal verification');
  }
  
  try {
    console.log('🚀 IMMEDIATE PayPal verification starting...');
    
    // Get all pending PayPal payments for this user that have Order IDs
    const q = query(
      collection(db, 'payments'),
      where('parent_id', '==', userId),
      where('provider', '==', 'paypal'),
      where('status', '==', 'initiated')
    );
    
    const snapshot = await getDocs(q);
    let verifiedCount = 0;
    
    console.log(`🔍 Found ${snapshot.size} pending PayPal payments for immediate verification`);
    
    // Check ALL payments immediately (no rate limiting for debugging)
    for (const paymentDoc of snapshot.docs) {
      const payment = paymentDoc.data();
      
      // Skip if no PayPal Order ID stored
      if (!payment.paypal_order_id) {
        console.log(`⏭️ Skipping payment ${paymentDoc.id} - no PayPal Order ID`);
        continue;
      }
      
      // Check PayPal order status immediately
      console.log(`🔍 IMMEDIATE CHECK: payment ${paymentDoc.id} with Order ID: ${payment.paypal_order_id}`);
      const statusResult = await checkPayPalOrderStatus(payment.paypal_order_id);
      
      console.log(`📊 PayPal status result:`, statusResult);
      
      if (statusResult.success && (statusResult.status === 'COMPLETED' || statusResult.status === 'APPROVED')) {
        console.log(`✅ Found ${statusResult.status} PayPal payment: ${paymentDoc.id}`);
        
        const verifyResult = await verifyPayPalPayment(paymentDoc.id, payment.paypal_order_id);
        
        console.log(`🔧 Verification result:`, verifyResult);
        
        if (verifyResult.success) {
          verifiedCount++;
          console.log(`🎉 IMMEDIATELY verified payment: ${paymentDoc.id}`);
        } else {
          console.error(`❌ Verification failed for ${paymentDoc.id}:`, verifyResult.error);
        }
      } else if (!statusResult.success && statusResult.error?.includes('404')) {
        // Handle 404 - PayPal order not found (expired or invalid)
        console.log(`🗑️ PayPal order ${payment.paypal_order_id} not found (404) - likely expired. Marking payment as failed.`);
        
        try {
          await updateDoc(doc(db, 'payments', paymentDoc.id), {
            status: 'failed',
            error_message: 'PayPal order expired or not found',
            updated_at: Timestamp.now()
          });
          console.log(`⚠️ Marked payment ${paymentDoc.id} as failed due to expired PayPal order`);
        } catch (updateError) {
          console.error(`❌ Failed to update payment status:`, updateError);
        }
      } else {
        console.log(`⏳ Payment ${paymentDoc.id} still pending on PayPal: ${statusResult.status || 'Unknown'}`);
        if (!statusResult.success) {
          console.error(`❌ Error checking PayPal status:`, statusResult.error);
        }
      }
      
      // NO DELAYS - run all checks immediately for debugging
    }
    
    console.log(`🏁 IMMEDIATE verification complete: ${verifiedCount} verified, 0 delays used`);
    return verifiedCount;
    
  } catch (error: any) {
    console.error('❌ IMMEDIATE verification error:', error);
    return 0;
  }
};