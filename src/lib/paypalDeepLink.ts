import { Linking, Alert } from 'react-native';
import { db } from './firebase';
import { collection, addDoc, Timestamp, doc, getDoc } from 'firebase/firestore';

export interface PayPalDeepLinkResult {
  success: boolean;
  paymentId?: string;
  paypalUrl?: string;
  error?: string;
  devMode?: boolean;
}

export interface PayPalMeInfo {
  handle: string;
  email?: string;
}

// Generate PayPal.Me URL
export const generatePayPalMeUrl = (handle: string, amountCents: number): string => {
  const amount = (amountCents / 100).toFixed(2);

  // Clean handle (remove @ symbol if present, convert to lowercase)
  const cleanHandle = handle.replace(/^@/, '').toLowerCase().trim();

  if (!cleanHandle) {
    throw new Error('Invalid PayPal handle');
  }

  return `https://www.paypal.com/paypalme/${cleanHandle}/${amount}`;
};

// Validate PayPal.Me handle format
export const isValidPayPalHandle = (handle: string): boolean => {
  if (!handle || typeof handle !== 'string') return false;

  const cleanHandle = handle.replace(/^@/, '').trim();

  // PayPal.Me handles: 3-20 characters, start/end with alphanumeric, allow letters/numbers/hyphens/underscores/periods
  // Must not start or end with special characters (-, _, .)
  const handleRegex = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,18}[a-zA-Z0-9]$/;

  // Special case: single character handles (3 chars minimum, so this covers 3+ chars)
  if (cleanHandle.length < 3) return false;

  // Single/double character handles don't need the complex regex
  if (cleanHandle.length <= 2) {
    return /^[a-zA-Z0-9]{1,2}$/.test(cleanHandle);
  }

  return handleRegex.test(cleanHandle);
};

// Get student's PayPal.Me information
export const getStudentPayPalInfo = async (studentId: string): Promise<PayPalMeInfo | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', studentId));

    if (!userDoc.exists()) {
      throw new Error('Student not found');
    }

    const userData = userDoc.data();
    let paypalHandle = userData.paypal_me_handle;

    // Development mode: Provide a default handle if none exists
    if (DEV_MODE && !paypalHandle) {
      const firstName = userData.name?.split(' ')[0]?.toLowerCase() || 'student';
      paypalHandle = `${firstName}dev`;
      console.log(`🚧 Dev Mode: Using default PayPal handle "${paypalHandle}" for testing`);
    }

    if (!paypalHandle) {
      return null;
    }

    return {
      handle: paypalHandle,
      email: userData.email || userData.paypal_email
    };
  } catch (error) {
    console.error('Error getting student PayPal info:', error);
    throw new Error('Failed to get student PayPal information');
  }
};

// Development mode configuration
//const DEV_MODE = __DEV__; // React Native development mode
const DEV_MODE = false;

// Create deep link payment record and open PayPal
export const createDeepLinkPayment = async (
  parentId: string,
  studentId: string,
  amountCents: number,
  note: string = ''
): Promise<PayPalDeepLinkResult> => {
  try {
    // Get student's PayPal.Me handle
    const paypalInfo = await getStudentPayPalInfo(studentId);

    if (!paypalInfo) {
      return {
        success: false,
        error: 'PayPal Not Set Up - The student needs to add their PayPal.Me handle in their profile. They can do this by going to Profile → Payment Setup → "Set Up PayPal" button.'
      };
    }

    // Validate handle
    if (!isValidPayPalHandle(paypalInfo.handle)) {
      return {
        success: false,
        error: `Invalid PayPal Handle - The student's PayPal handle "${paypalInfo.handle}" is invalid. It must be 3-20 characters, start and end with letters/numbers, and can contain letters, numbers, hyphens, dots, and underscores. Ask them to update it in Profile → Payment Setup.`
      };
    }

    // Generate PayPal.Me URL
    const paypalUrl = generatePayPalMeUrl(paypalInfo.handle, amountCents);

    // Create payment record in Firestore
    const paymentData = {
      parent_id: parentId,
      student_id: studentId,

      // Amount fields - maintain compatibility with old system
      amount_cents: amountCents, // New deep link format
      intent_cents: amountCents, // Legacy format for compatibility

      note: note || '',
      payment_method: 'paypal_deep_link',
      provider: 'paypal', // For compatibility with existing components
      status: 'initiated',

      // Deep link specific data
      paypal_me_handle: paypalInfo.handle,
      paypal_me_url: paypalUrl,
      recipient_email: paypalInfo.email,

      // Development mode flag
      dev_mode: DEV_MODE,

      // Timestamps - maintain compatibility
      created_at: Timestamp.now(),
      updated_at: Timestamp.now()
      // confirmed_at and student_confirmed_at will be added during attestation/confirmation flows
    };

    const paymentRef = await addDoc(collection(db, 'payments'), paymentData);

    // Development mode: Show mock PayPal flow
    if (DEV_MODE) {
      const shouldOpenPayPal = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Dev Mode - Mock PayPal',
          `Would open PayPal to send ${formatPaymentAmount(amountCents)} to @${paypalInfo.handle}\n\nURL: ${paypalUrl}\n\nSimulate opening PayPal?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Simulate PayPal', onPress: () => resolve(true) }
          ]
        );
      });

      if (!shouldOpenPayPal) {
        return {
          success: false,
          error: 'User cancelled mock PayPal flow'
        };
      }

      // In dev mode, we still return success but mark as dev mode
      return {
        success: true,
        paymentId: paymentRef.id,
        paypalUrl,
        devMode: true
      };
    }

    // Production mode: Open actual PayPal.Me URL
    const canOpen = await Linking.canOpenURL(paypalUrl);
    if (!canOpen) {
      return {
        success: false,
        error: 'Unable to open PayPal. Please ensure PayPal app is installed or try again.'
      };
    }

    await Linking.openURL(paypalUrl);

    return {
      success: true,
      paymentId: paymentRef.id,
      paypalUrl
    };

  } catch (error: any) {
    console.error('Error creating deep link payment:', error);
    return {
      success: false,
      error: error.message || 'Failed to create payment link'
    };
  }
};

// Helper to format amount for display
export const formatPaymentAmount = (amountCents: number): string => {
  return `$${(amountCents / 100).toFixed(2)}`;
};

// Helper to parse PayPal.Me URL and extract amount
export const parsePayPalMeUrl = (url: string): { handle?: string; amount?: number } => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(part => part);

    if (pathParts.length >= 2 && pathParts[0] === 'paypalme') {
      const handle = pathParts[1];
      const amount = pathParts[2] ? parseFloat(pathParts[2]) : undefined;

      return { handle, amount };
    }

    return {};
  } catch (error) {
    console.error('Error parsing PayPal.Me URL:', error);
    return {};
  }
};

// Test PayPal.Me handle (for profile setup)
export const testPayPalMeHandle = (handle: string): { valid: boolean; error?: string; exampleUrl?: string } => {
  if (!handle) {
    return { valid: false, error: 'Handle is required' };
  }

  if (!isValidPayPalHandle(handle)) {
    return {
      valid: false,
      error: 'Handle must be 3-20 characters, start/end with letters/numbers, can contain letters, numbers, hyphens, dots, underscores'
    };
  }

  const cleanHandle = handle.replace(/^@/, '').toLowerCase().trim();
  const exampleUrl = `https://www.paypal.com/paypalme/${cleanHandle}/10.00`;

  return {
    valid: true,
    exampleUrl
  };
};