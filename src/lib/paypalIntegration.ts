import { db } from './firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';

// PayPal API configuration
const PAYPAL_BASE_URL = process.env.EXPO_PUBLIC_PAYPAL_ENVIRONMENT === 'production' 
  ? 'https://api.paypal.com' 
  : 'https://api.sandbox.paypal.com';

const PAYPAL_CLIENT_ID = process.env.EXPO_PUBLIC_PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.EXPO_PUBLIC_PAYPAL_CLIENT_SECRET;

// Get PayPal access token
export const getPayPalAccessToken = async (): Promise<string> => {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal credentials not configured');
  }
  
  const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials'
  });
  
  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`PayPal auth failed (${response.status}): ${errorData}`);
  }
  
  const data = await response.json();
  if (!data.access_token) {
    throw new Error('PayPal auth response missing access token');
  }
  
  return data.access_token;
};

// Create PayPal order
export const createPayPalOrder = async (
  amount_cents: number,
  recipient_email: string,
  payment_id: string,
  note: string = ''
): Promise<{ orderId: string; approvalUrl: string }> => {
  const accessToken = await getPayPalAccessToken();
  const dollars = (amount_cents / 100).toFixed(2);
  
  const orderData = {
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: 'USD',
        value: dollars
      },
      payee: {
        email_address: recipient_email
      },
      description: note || `Campus Life payment: $${dollars}`,
      custom_id: payment_id
    }],
    application_context: {
      brand_name: 'Campus Life',
      locale: 'en-US',
      landing_page: 'BILLING',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'PAY_NOW',
      return_url: `https://campus-life-auth-website.vercel.app/api/paypalReturn?paymentId=${payment_id}`,
      cancel_url: `https://campus-life-auth-website.vercel.app/api/paypalReturn?paymentId=${payment_id}&status=cancelled`
    }
  };
  
  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(orderData)
  });
  
  const order = await response.json();
  
  if (!response.ok) {
    throw new Error(`PayPal order creation failed: ${order.message}`);
  }
  
  const approvalUrl = order.links.find((link: any) => link.rel === 'approve')?.href;
  
  // Store the PayPal Order ID in our payment record for later verification
  const { updateDoc, doc } = await import('firebase/firestore');
  const { db } = await import('./firebase');
  
  try {
    await updateDoc(doc(db, 'payments', payment_id), {
      paypal_order_id: order.id
    });
    console.log('✅ Stored PayPal Order ID in payment record:', order.id);
  } catch (error) {
    console.error('⚠️  Failed to store PayPal Order ID:', error);
  }

  return {
    orderId: order.id,
    approvalUrl
  };
};

// Capture PayPal payment
export const capturePayPalPayment = async (orderId: string): Promise<boolean> => {
  const accessToken = await getPayPalAccessToken();
  
  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'Prefer': 'return=representation'
    }
  });
  
  const result = await response.json();
  
  return response.ok && result.status === 'COMPLETED';
};

// Check PayPal order status
export const checkPayPalOrderStatus = async (orderId: string): Promise<{ success: boolean; status?: string; error?: string }> => {
  try {
    if (!orderId) {
      return { success: false, error: 'Order ID is required' };
    }
    
    const accessToken = await getPayPalAccessToken();
    
    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      }
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      
      // Handle 404 errors more gracefully (expired orders)
      if (response.status === 404) {
        console.log(`💀 PayPal order ${orderId} expired/not found (404) - this is normal for old orders`);
        return { success: false, error: `PayPal order expired` };
      }
      
      console.error(`PayPal API error (${response.status}):`, errorData);
      return { success: false, error: `HTTP ${response.status}: ${errorData}` };
    }
    
    let order;
    try {
      const responseText = await response.text();
      if (!responseText || responseText.trim() === '') {
        return { success: false, error: 'Empty response from PayPal API' };
      }
      order = JSON.parse(responseText);
    } catch (parseError) {
      console.error('PayPal JSON parse error:', parseError);
      return { success: false, error: 'Invalid response format from PayPal API' };
    }
    
    if (!order.status) {
      console.error('PayPal order response missing status:', order);
      return { success: false, error: 'Order response missing status' };
    }
    
    return { 
      success: true, 
      status: order.status // CREATED, APPROVED, COMPLETED, etc.
    };
    
  } catch (error: any) {
    console.error('PayPal order status check error:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
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
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      console.warn('⚠️ PayPal not configured - skipping auto-verification');
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
      
      // Check PayPal order status
      console.log(`🔍 Checking PayPal status for payment ${paymentDoc.id} with Order ID: ${payment.paypal_order_id}`);
      const statusResult = await checkPayPalOrderStatus(payment.paypal_order_id);
      
      console.log(`📊 PayPal status result:`, statusResult);
      
      if (statusResult.success && (statusResult.status === 'COMPLETED' || statusResult.status === 'APPROVED')) {
        console.log(`✅ Found ${statusResult.status} PayPal payment: ${paymentDoc.id}`);
        
        // For APPROVED payments, we need to capture them first, then verify
        // For COMPLETED payments, just verify
        const verifyResult = await verifyPayPalPayment(paymentDoc.id, payment.paypal_order_id);
        
        console.log(`🔧 Verification result:`, verifyResult);
        
        if (verifyResult.success) {
          verifiedCount++;
          console.log(`🎉 Auto-verified payment: ${paymentDoc.id}`);
        } else {
          console.error(`❌ Verification failed for ${paymentDoc.id}:`, verifyResult.error);
        }
      } else if (!statusResult.success && statusResult.error?.includes('expired')) {
        // Handle expired orders - PayPal order not found (expired or invalid)
        console.log(`🗑️ PayPal order ${payment.paypal_order_id} expired - marking payment as failed.`);
        
        try {
          // Mark the payment as failed since the PayPal order no longer exists
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
      
      // No delays - check all payments as fast as possible
      // Removed artificial rate limiting delays
    }
    
    return verifiedCount;
    
  } catch (error: any) {
    console.error('Auto-verify error:', error);
    return 0;
  }
};

// Verify PayPal payment and update our records
export const verifyPayPalPayment = async (
  paymentId: string,
  orderId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Capture the payment
    const captured = await capturePayPalPayment(orderId);
    
    if (!captured) {
      console.log(`⚠️ Payment capture failed for ${paymentId} - likely expired or already captured`);
      return { success: false, error: 'Payment capture failed - order may be expired' };
    }
    
    // Update our payment record
    try {
      await updateDoc(doc(db, 'payments', paymentId), {
        status: 'completed',
        provider_transaction_id: orderId,
        completed_at: Timestamp.now(),
        verification_method: 'paypal_api'
      });
      console.log('✅ Payment document updated successfully');
    } catch (updateError: any) {
      console.error('❌ Failed to update payment document:', updateError);
      // Check if it's a permission error
      if (updateError.code === 'permission-denied') {
        console.log('🔧 Permission denied - user may not be properly authenticated');
        return { success: false, error: 'Authentication required. Please log in and try again.' };
      }
      throw updateError; // Re-throw other errors
    }
    
    // Send push notification to student about payment received
    try {
      const { getUserProfile } = await import('./firebase');
      const { pushNotificationService, NotificationTemplates } = await import('../services/pushNotificationService');
      
      // Get payment details to find student and amount
      const { doc: firestoreDoc, getDoc } = await import('firebase/firestore');
      const paymentDoc = await getDoc(firestoreDoc(db, 'payments', paymentId));
      
      if (paymentDoc.exists()) {
        const paymentData = paymentDoc.data();
        const studentId = paymentData.student_id;
        const parentId = paymentData.parent_id;
        const amount = `$${(paymentData.intent_cents / 100).toFixed(2)}`;
        
        // Get parent name for notification
        const parentProfile = await getUserProfile(parentId);
        const parentName = parentProfile?.full_name || 'Your parent';
        
        // Send notification to student
        const studentProfile = await getUserProfile(studentId);
        if (studentProfile?.pushToken) {
          const notification = {
            ...NotificationTemplates.paymentReceived(amount, parentName),
            userId: studentId
          };
          
          console.log('📱 Sending payment received notification to student:', studentId);
          await pushNotificationService.sendPushNotification(notification);
        }
        
        // Send payment status notification to parent
        const parentProfile2 = await getUserProfile(parentId);
        if (parentProfile2?.pushToken) {
          const statusNotification = {
            ...NotificationTemplates.paymentStatus('completed', amount),
            userId: parentId
          };
          
          console.log('📱 Sending payment status notification to parent:', parentId);
          await pushNotificationService.sendPushNotification(statusNotification);
        }
      }
    } catch (notifError) {
      console.error('📱 Failed to send payment notification:', notifError);
      // Don't fail the payment verification if push notification fails
    }
    
    return { success: true };
    
  } catch (error: any) {
    console.error('PayPal verification error:', error);
    return { success: false, error: error.message };
  }
};