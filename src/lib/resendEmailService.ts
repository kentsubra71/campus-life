import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

// Initialize Firebase Functions
const functions = getFunctions(app);

export interface EmailData {
  to: string;
  type: 'email_verification' | 'password_reset';
  data: {
    name: string;
    verificationUrl: string;
    token: string;
  };
}

// Send email using secure Cloud Function (API key is now server-side)
export const sendEmailWithResend = async (emailData: EmailData): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> => {
  try {
    console.log('📧 Sending email via secure Cloud Function:', { to: emailData.to, type: emailData.type });
    
    // Call the Firebase Cloud Function instead of direct API call
    const sendEmail = httpsCallable(functions, 'sendEmail');
    
    const result = await sendEmail({
      to: emailData.to,
      type: emailData.type,
      emailData: emailData.data
    });

    const data = result.data as any;
    console.log('✅ Email sent via Cloud Function:', data);

    return {
      success: data.success,
      messageId: data.messageId,
      error: data.error
    };
  } catch (error: any) {
    console.error('❌ Failed to send email via Cloud Function:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Test function to verify Resend integration via Cloud Function
export const testResendIntegration = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const testEmail: EmailData = {
      to: 'test@example.com', // Replace with your email for testing
      type: 'email_verification',
      data: {
        name: 'Test User',
        verificationUrl: 'https://campus-life-verification.vercel.app/verify/email_verification/test-token-123',
        token: 'test-token-123'
      }
    };

    const result = await sendEmailWithResend(testEmail);
    return result;
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
};

// Batch email sending for multiple recipients
export const sendBatchEmails = async (emails: EmailData[]): Promise<{
  totalSent: number;
  totalFailed: number;
  results: Array<{ email: string; success: boolean; error?: string; messageId?: string }>;
}> => {
  const results = await Promise.allSettled(
    emails.map(async (emailData) => {
      const result = await sendEmailWithResend(emailData);
      return {
        email: emailData.to,
        ...result
      };
    })
  );

  const processedResults = results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        email: emails[index].to,
        success: false,
        error: result.reason?.message || 'Unknown error'
      };
    }
  });

  const totalSent = processedResults.filter(r => r.success).length;
  const totalFailed = processedResults.filter(r => !r.success).length;

  return {
    totalSent,
    totalFailed,
    results: processedResults
  };
};