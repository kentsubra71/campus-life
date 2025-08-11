import { emailTemplates } from './emailTemplates';

const RESEND_API_KEY = 're_Ebxr6u7s_2bcVGbXb8JdWpoiRpMXse2En';
const FROM_EMAIL = 'Campus Life <noreply@ronaldli.ca>'; // Using verified domain

export interface EmailData {
  to: string;
  type: 'email_verification' | 'password_reset';
  data: {
    name: string;
    verificationUrl: string;
    token: string;
  };
}

// Send email using Resend API
export const sendEmailWithResend = async (emailData: EmailData): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> => {
  try {
    const { to, type, data } = emailData;
    
    let subject: string;
    let html: string;
    let text: string;
    
    if (type === 'email_verification') {
      subject = emailTemplates.emailVerification.subject;
      html = emailTemplates.emailVerification.html(data.name, data.verificationUrl);
      text = emailTemplates.emailVerification.text(data.name, data.verificationUrl);
    } else if (type === 'password_reset') {
      subject = emailTemplates.passwordReset.subject;
      html = emailTemplates.passwordReset.html(data.name, data.verificationUrl);
      text = emailTemplates.passwordReset.text(data.name, data.verificationUrl);
    } else {
      return { success: false, error: 'Invalid email type' };
    }

    const payload = {
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
      text
    };

    console.log('Sending email via Resend:', { to, subject, type });

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = await response.text();
      }
      
      console.error('Resend API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        payload
      });
      
      const errorMessage = typeof errorData === 'object' ? 
        (errorData.message || errorData.error || 'Unknown API error') : 
        errorData || response.statusText;
        
      throw new Error(`Resend API error (${response.status}): ${errorMessage}`);
    }

    const result = await response.json();
    console.log('✅ Email sent successfully:', result);

    return {
      success: true,
      messageId: result.id
    };
  } catch (error: any) {
    console.error('❌ Failed to send email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Test function to verify Resend integration
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
        verificationUrl: 'https://your-website.com/verify/email_verification/test-token-123',
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