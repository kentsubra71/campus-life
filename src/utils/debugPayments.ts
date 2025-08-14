import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { immediateVerifyPendingPayPalPayments } from '../lib/paypalIntegrationImmediate';

/**
 * Debug function to check current payment status and run immediate verification
 */
export const debugPaymentStatus = async (userId: string): Promise<{
  pendingPayments: any[];
  verifiedCount: number;
  totalPayments: number;
}> => {
  console.log('🔍 DEBUG: Checking payment status for user:', userId);
  
  try {
    // Get all payments for user
    const allPaymentsQuery = query(
      collection(db, 'payments'),
      where('parent_id', '==', userId)
    );
    const allPaymentsSnapshot = await getDocs(allPaymentsQuery);
    
    // Get pending PayPal payments
    const pendingQuery = query(
      collection(db, 'payments'),
      where('parent_id', '==', userId),
      where('provider', '==', 'paypal'),
      where('status', '==', 'initiated')
    );
    const pendingSnapshot = await getDocs(pendingQuery);
    
    const pendingPayments = pendingSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      created_at: doc.data().created_at?.toDate(),
    }));
    
    console.log('📊 Payment Status Summary:');
    console.log(`   Total payments: ${allPaymentsSnapshot.size}`);
    console.log(`   Pending PayPal: ${pendingSnapshot.size}`);
    console.log('   Pending payments:', pendingPayments);
    
    // Run immediate verification
    console.log('🚀 Running immediate verification...');
    const verifiedCount = await immediateVerifyPendingPayPalPayments(userId);
    
    return {
      pendingPayments,
      verifiedCount,
      totalPayments: allPaymentsSnapshot.size
    };
    
  } catch (error) {
    console.error('❌ Debug payment status error:', error);
    return {
      pendingPayments: [],
      verifiedCount: 0,
      totalPayments: 0
    };
  }
};