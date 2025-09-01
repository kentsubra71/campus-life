// Firebase Cloud Functions Template
// Deploy this to your Firebase Functions when ready

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// You'll need to set up an email service like SendGrid, Mailgun, or use Gmail SMTP
// For now, this is a template that logs the email content

exports.sendInvitationEmail = functions.https.onCall(async (data, context) => {
  try {
    const {
      recipientEmail,
      recipientName,
      parentName,
      familyName,
      inviteCode,
      type
    } = data;

    // Verify the user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Log the email details (replace with actual email sending logic)
    console.log('📧 Invitation Email Request:', {
      to: recipientEmail,
      recipientName,
      parentName,
      familyName,
      inviteCode,
      type
    });

    // Email content template
    const emailContent = `
      Hi ${recipientName},

      ${parentName} has invited you to join the ${familyName} family on CampusLife!
      
      CampusLife helps families stay connected during the college years through:
      • Wellness tracking and support
      • Easy communication
      • Family encouragement tools

      To join, download the CampusLife app and use this invite code: ${inviteCode}

      Best regards,
      The CampusLife Team
    `;

    // TODO: Replace this with actual email sending logic
    // Example with SendGrid:
    /*
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(functions.config().sendgrid.key);
    
    const msg = {
      to: recipientEmail,
      from: 'noreply@campuslifeapp.com',
      subject: `${parentName} invited you to join ${familyName} on CampusLife`,
      text: emailContent,
      html: emailContent.replace(/\n/g, '<br>')
    };
    
    await sgMail.send(msg);
    */

    console.log('✅ Email would be sent:', emailContent);
    
    return { 
      success: true,
      message: 'Invitation email sent successfully'
    };

  } catch (error) {
    console.error('❌ Error sending invitation email:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send invitation email');
  }
});

exports.sendWelcomeEmail = functions.https.onCall(async (data, context) => {
  try {
    const {
      recipientEmail,
      recipientName,
      role,
      familyName,
      inviteCode,
      type
    } = data;

    // Verify the user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Log the email details (replace with actual email sending logic)
    console.log('📧 Welcome Email Request:', {
      to: recipientEmail,
      recipientName,
      role,
      familyName,
      inviteCode,
      type
    });

    // Welcome email content based on role
    const emailContent = role === 'parent' 
      ? `
        Hi ${recipientName},

        Welcome to CampusLife! You've successfully created the ${familyName} family account.

        Your family invite code is: ${inviteCode}
        Share this code with your college student so they can join your family account.

        CampusLife helps families stay connected during the college years through wellness tracking, communication tools, and support features.

        Best regards,
        The CampusLife Team
      `
      : `
        Hi ${recipientName},

        Welcome to CampusLife! You've successfully joined the ${familyName} family.

        CampusLife helps you stay connected with your family during college through:
        • Wellness tracking tools
        • Easy family communication
        • Support and encouragement features

        Start by exploring the app and logging your first wellness entry!

        Best regards,
        The CampusLife Team
      `;

    // TODO: Replace with actual email sending logic
    console.log('✅ Welcome email would be sent:', emailContent);
    
    return { 
      success: true,
      message: 'Welcome email sent successfully'
    };

  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send welcome email');
  }
});

// Instructions for deployment:
// 1. Set up Firebase Functions in your project: `firebase init functions`
// 2. Install dependencies: `npm install firebase-functions firebase-admin`
// 3. Add email service dependencies (e.g., `npm install @sendgrid/mail`)
// 4. Configure email service API keys using: `firebase functions:config:set sendgrid.key="your-api-key"`
// 5. Deploy functions: `firebase deploy --only functions`