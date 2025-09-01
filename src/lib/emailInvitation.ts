import { httpsCallable } from 'firebase/functions';

export interface InvitationEmailData {
  recipientEmail: string;
  recipientName: string;
  parentName: string;
  familyName: string;
  inviteCode: string;
}

export const sendInvitationEmail = async (
  recipientEmail: string,
  recipientName: string,
  parentName: string,
  familyName: string,
  inviteCode: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('📧 Sending invitation email to:', recipientName, 'at', recipientEmail);
    
    // Dynamically import Firebase functions to ensure proper initialization
    const { functions } = await import('./firebase');
    
    const sendEmail = httpsCallable(functions, 'sendEmail');
    const result = await sendEmail({
      to: recipientEmail,
      type: 'invitation',
      emailData: {
        recipientName,
        parentName,
        familyName,
        inviteCode
      }
    });

    if (result.data && (result.data as any).success) {
      console.log('✅ Invitation email sent successfully');
      return { success: true };
    } else {
      console.error('❌ Invitation email failed:', (result.data as any)?.error);
      return { success: false, error: (result.data as any)?.error || 'Failed to send invitation email' };
    }
  } catch (error: any) {
    console.error('❌ Error sending invitation email:', error);
    
    // Handle specific Firebase function not found error
    if (error.code === 'functions/not-found') {
      return { 
        success: false, 
        error: 'Email service temporarily unavailable. Please share the invite code manually: ' + inviteCode
      };
    }
    
    return { 
      success: false, 
      error: error.message || 'Failed to send invitation email. You can share the invite code manually: ' + inviteCode
    };
  }
};

export const sendWelcomeEmail = async (
  recipientEmail: string,
  recipientName: string,
  role: 'parent' | 'student',
  familyName: string,
  inviteCode?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('📧 Sending welcome email to:', recipientEmail);
    
    // Dynamically import Firebase functions to ensure proper initialization
    const { functions } = await import('./firebase');
    
    const sendEmail = httpsCallable(functions, 'sendEmail');
    const result = await sendEmail({
      to: recipientEmail,
      type: 'welcome',
      emailData: {
        recipientName,
        role,
        familyName,
        inviteCode
      }
    });

    if (result.data && (result.data as any).success) {
      console.log('✅ Welcome email sent successfully');
      return { success: true };
    } else {
      console.error('❌ Welcome email failed:', (result.data as any)?.error);
      return { success: false, error: (result.data as any)?.error || 'Failed to send welcome email' };
    }
  } catch (error: any) {
    console.error('❌ Error sending welcome email:', error);
    
    // Handle specific Firebase function not found error
    if (error.code === 'functions/not-found') {
      console.log('📧 Welcome email service not available, but account was created successfully');
      return { success: true }; // Don't fail account creation for missing email service
    }
    
    // For welcome emails, we don't want to fail the whole registration process
    console.log('📧 Welcome email failed, but account was created successfully');
    return { success: true };
  }
};