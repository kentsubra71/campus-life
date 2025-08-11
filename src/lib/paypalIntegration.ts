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
  const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials'
  });
  
  const data = await response.json();
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

// Verify PayPal payment and update our records
export const verifyPayPalPayment = async (
  paymentId: string,
  orderId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Capture the payment
    const captured = await capturePayPalPayment(orderId);
    
    if (!captured) {
      return { success: false, error: 'Payment capture failed' };
    }
    
    // Update our payment record
    await updateDoc(doc(db, 'payments', paymentId), {
      status: 'completed',
      provider_transaction_id: orderId,
      completed_at: Timestamp.now(),
      verification_method: 'paypal_api'
    });
    
    return { success: true };
    
  } catch (error: any) {
    console.error('PayPal verification error:', error);
    return { success: false, error: error.message };
  }
};