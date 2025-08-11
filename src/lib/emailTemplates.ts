// Email templates for different verification types
export const emailTemplates = {
  emailVerification: {
    subject: 'Verify your Campus Life account',
    html: (name: string, verificationUrl: string) => `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Welcome to Campus Life!</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #667eea; margin-top: 0;">Hi ${name}!</h2>
            
            <p>Thanks for signing up for Campus Life. We're excited to help you and your family stay connected and track wellness together.</p>
            
            <p>To get started, please verify your email address by clicking the button below:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 5px; 
                        font-weight: bold;
                        display: inline-block;">
                Verify My Email
              </a>
            </div>
            
            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
              <strong>Can't click the button?</strong><br>
              Copy and paste this link into your browser:<br>
              <a href="${verificationUrl}" style="color: #667eea; word-break: break-all;">${verificationUrl}</a>
            </p>
            
            <p style="color: #666; font-size: 12px; margin-top: 20px;">
              This link will expire in 24 hours. If you didn't create an account with Campus Life, you can safely ignore this email.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
            <p>Campus Life - Connecting Families Through Wellness</p>
          </div>
        </body>
      </html>
    `,
    text: (name: string, verificationUrl: string) => `
      Hi ${name}!

      Welcome to Campus Life! Thanks for signing up.

      To verify your email address and activate your account, please visit:
      ${verificationUrl}

      This link will expire in 24 hours.

      If you didn't create an account with Campus Life, you can safely ignore this email.

      Campus Life Team
    `
  },

  passwordReset: {
    subject: 'Reset your Campus Life password',
    html: (name: string, verificationUrl: string) => `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Password Reset Request</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #667eea; margin-top: 0;">Hi ${name}!</h2>
            
            <p>We received a request to reset the password for your Campus Life account.</p>
            
            <p>If you made this request, click the button below to reset your password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 5px; 
                        font-weight: bold;
                        display: inline-block;">
                Reset My Password
              </a>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>Security Note:</strong> If you didn't request a password reset, please ignore this email. Your password will not be changed.
              </p>
            </div>
            
            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
              <strong>Can't click the button?</strong><br>
              Copy and paste this link into your browser:<br>
              <a href="${verificationUrl}" style="color: #667eea; word-break: break-all;">${verificationUrl}</a>
            </p>
            
            <p style="color: #666; font-size: 12px; margin-top: 20px;">
              This link will expire in 24 hours for security reasons.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
            <p>Campus Life - Connecting Families Through Wellness</p>
          </div>
        </body>
      </html>
    `,
    text: (name: string, verificationUrl: string) => `
      Hi ${name}!

      We received a request to reset the password for your Campus Life account.

      If you made this request, please visit the following link to reset your password:
      ${verificationUrl}

      If you didn't request a password reset, please ignore this email. Your password will not be changed.

      This link will expire in 24 hours for security reasons.

      Campus Life Team
    `
  }
};

// Email service configuration for different providers
export const emailServiceConfig = {
  // SendGrid configuration
  sendgrid: {
    apiUrl: 'https://api.sendgrid.com/v3/mail/send',
    headers: (apiKey: string) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    payload: (to: string, subject: string, html: string, text: string) => ({
      personalizations: [{
        to: [{ email: to }]
      }],
      from: { 
        email: process.env.EXPO_PUBLIC_FROM_EMAIL || 'noreply@campus-life.app',
        name: 'Campus Life'
      },
      subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html }
      ]
    })
  },

  // AWS SES configuration
  awsSes: {
    // Would require AWS SDK integration
    region: process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1',
    // Implementation would go here
  },

  // Resend configuration (modern alternative)
  resend: {
    apiUrl: 'https://api.resend.com/emails',
    headers: (apiKey: string) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    payload: (to: string, subject: string, html: string, text: string) => ({
      from: process.env.EXPO_PUBLIC_FROM_EMAIL || 'Campus Life <noreply@campus-life.app>',
      to: [to],
      subject,
      html,
      text
    })
  }
};