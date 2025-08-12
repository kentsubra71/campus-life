import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { app } from './firebase';

// Initialize Firebase Functions
const functions = getFunctions(app);

// Connect to emulator in development (DISABLED for now to use deployed functions)
// if (__DEV__) {
//   try {
//     connectFunctionsEmulator(functions, 'localhost', 5001);
//   } catch (error) {
//     console.log('Functions emulator already connected or not available');
//   }
// }

// Debug logging
const debugLog = (functionName: string, message: string, data?: any) => {
  console.log(`🔍 [PayPalP2P.${functionName}] ${message}`, data || '');
};

// Interface definitions
export interface PayPalOrderResult {
  success: boolean;
  transactionId?: string;
  orderId?: string;
  approvalUrl?: string;
  error?: string;
}

export interface PayPalVerificationResult {
  success: boolean;
  status?: string;
  captureId?: string;
  transactionId?: string;
  error?: string;
}

export interface TransactionStatus {
  success: boolean;
  transaction?: {
    id: string;
    status: string;
    amountCents: number;
    note: string;
    createdAt: any;
    completedAt?: any;
    recipientEmail: string;
  };
  error?: string;
}

export interface PayPalTestResult {
  success: boolean;
  message?: string;
  error?: string;
  baseUrl?: string;
  hasCredentials?: boolean;
}

// Create PayPal Order for P2P Payment
export const createPayPalP2POrder = async (
  studentId: string,
  amountCents: number,
  note?: string
): Promise<PayPalOrderResult> => {
  debugLog('createPayPalP2POrder', 'Creating PayPal order', { studentId, amountCents, note });
  
  try {
    const createOrder = httpsCallable(functions, 'createPayPalOrder');
    const result = await createOrder({
      studentId,
      amountCents,
      note
    });

    const data = result.data as PayPalOrderResult;
    debugLog('createPayPalP2POrder', 'Order created successfully', data);
    
    return data;
  } catch (error: any) {
    debugLog('createPayPalP2POrder', 'Error creating order', error);
    return {
      success: false,
      error: error.message || 'Failed to create PayPal order'
    };
  }
};

// Verify and Capture PayPal Payment
export const verifyPayPalP2PPayment = async (
  transactionId: string,
  orderId: string,
  payerID?: string
): Promise<PayPalVerificationResult> => {
  debugLog('verifyPayPalP2PPayment', 'Verifying PayPal payment', { transactionId, orderId, payerID });
  
  try {
    const verifyPayment = httpsCallable(functions, 'verifyPayPalPayment');
    const result = await verifyPayment({
      transactionId,
      orderId,
      payerID
    });

    const data = result.data as PayPalVerificationResult;
    debugLog('verifyPayPalP2PPayment', 'Payment verified', data);
    
    return data;
  } catch (error: any) {
    debugLog('verifyPayPalP2PPayment', 'Error verifying payment', error);
    return {
      success: false,
      error: error.message || 'Failed to verify PayPal payment'
    };
  }
};

// Get Transaction Status
export const getTransactionStatus = async (transactionId: string): Promise<TransactionStatus> => {
  debugLog('getTransactionStatus', 'Getting transaction status', { transactionId });
  
  try {
    const getStatus = httpsCallable(functions, 'getTransactionStatus');
    const result = await getStatus({ transactionId });

    const data = result.data as TransactionStatus;
    debugLog('getTransactionStatus', 'Status retrieved', data);
    
    return data;
  } catch (error: any) {
    debugLog('getTransactionStatus', 'Error getting status', error);
    return {
      success: false,
      error: error.message || 'Failed to get transaction status'
    };
  }
};

// Test PayPal Connection (for debugging)
export const testPayPalConnection = async (): Promise<PayPalTestResult> => {
  debugLog('testPayPalConnection', 'Testing PayPal connection');
  
  try {
    const testConnection = httpsCallable(functions, 'testPayPalConnection');
    
    debugLog('testPayPalConnection', 'Calling Firebase function...');
    const result = await testConnection({});
    
    debugLog('testPayPalConnection', 'Raw function result', result);
    debugLog('testPayPalConnection', 'Function result data', result.data);

    const data = result.data as PayPalTestResult;
    debugLog('testPayPalConnection', 'Parsed result data', data);
    
    return data;
  } catch (error: any) {
    debugLog('testPayPalConnection', 'Error testing connection', {
      message: error.message,
      code: error.code,
      details: error.details,
      stack: error.stack,
      fullError: error
    });
    
    return {
      success: false,
      error: error.message || 'Failed to test PayPal connection',
      details: `Error code: ${error.code}, Details: ${error.details}`
    };
  }
};

// Helper function to parse PayPal return URL
export const parsePayPalReturnUrl = (url: string): { orderId?: string; payerID?: string; transactionId?: string } => {
  debugLog('parsePayPalReturnUrl', 'Parsing return URL', { url });
  
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);
    
    const result = {
      orderId: params.get('token') || undefined,
      payerID: params.get('PayerID') || undefined,
      transactionId: params.get('transactionId') || undefined
    };
    
    debugLog('parsePayPalReturnUrl', 'Parsed URL params', result);
    return result;
  } catch (error) {
    debugLog('parsePayPalReturnUrl', 'Error parsing URL', error);
    return {};
  }
};

// Helper function to format amount for display
export const formatPaymentAmount = (amountCents: number): string => {
  return `$${(amountCents / 100).toFixed(2)}`;
};

// Helper function to validate PayPal email
export const isValidPayPalEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};