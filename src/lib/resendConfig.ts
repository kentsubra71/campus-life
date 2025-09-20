// Separate configuration file for Resend API
// This file ensures the Resend API key is properly loaded without modifying existing email verification code

export const RESEND_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_RESEND_API_KEY,
  apiUrl: 'https://api.resend.com/emails',
  fromEmail: 'Campus Life <noreply@campuslifeapp.com>',
};

// Helper function to check if Resend is properly configured
export const isResendConfigured = (): boolean => {
  return !!RESEND_CONFIG.apiKey;
};

// Log configuration status (for debugging)
console.log('Resend API configured:', isResendConfigured() ? '✅' : '❌');