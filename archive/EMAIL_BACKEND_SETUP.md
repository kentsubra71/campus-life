# Email Verification Backend Setup - Future-Proof Solution

This guide explains how to set up a **permanent email verification system** that won't be affected by Firebase Dynamic Links deprecation.

## Architecture Overview

```
Mobile App -> Your Backend API -> Email Service -> User's Email
                ↓
            Verification URL -> Your Website -> Mobile App (Deep Link)
```

## Required Components

### 1. Backend API Endpoints

Create these endpoints on your backend (Node.js/Python/Go/etc):

#### POST `/send-email`
```javascript
// Example Node.js/Express endpoint
app.post('/send-email', async (req, res) => {
  const { to, type, data } = req.body;
  
  try {
    let emailContent;
    
    if (type === 'email_verification') {
      emailContent = {
        subject: 'Verify your Campus Life account',
        html: emailTemplates.emailVerification.html(data.name, data.verificationUrl),
        text: emailTemplates.emailVerification.text(data.name, data.verificationUrl)
      };
    } else if (type === 'password_reset') {
      emailContent = {
        subject: 'Reset your Campus Life password', 
        html: emailTemplates.passwordReset.html(data.name, data.verificationUrl),
        text: emailTemplates.passwordReset.text(data.name, data.verificationUrl)
      };
    }
    
    await sendEmail(to, emailContent.subject, emailContent.html, emailContent.text);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### 2. Email Service Integration

#### Option A: SendGrid (Most Popular)
```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async (to, subject, html, text) => {
  const msg = {
    to,
    from: 'noreply@campus-life.app',
    subject,
    text,
    html,
  };
  
  await sgMail.send(msg);
};
```

#### Option B: Resend (Modern Alternative)
```javascript
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (to, subject, html, text) => {
  await resend.emails.send({
    from: 'Campus Life <noreply@campus-life.app>',
    to: [to],
    subject,
    html,
    text,
  });
};
```

#### Option C: AWS SES (Scalable)
```javascript
const AWS = require('aws-sdk');
const ses = new AWS.SES({ region: 'us-east-1' });

const sendEmail = async (to, subject, html, text) => {
  const params = {
    Source: 'noreply@campus-life.app',
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject },
      Body: {
        Html: { Data: html },
        Text: { Data: text }
      }
    }
  };
  
  await ses.sendEmail(params).promise();
};
```

### 3. Verification Website

Create a simple website (can be static) to handle verification links:

#### `/verify/email_verification/[token]` page
```html
<!DOCTYPE html>
<html>
<head>
    <title>Email Verification - Campus Life</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
    <div id="app">
        <div class="container">
            <h1>Verifying your email...</h1>
            <div id="loading">Please wait while we verify your email address.</div>
            <div id="success" style="display: none;">
                <h2>✅ Email verified successfully!</h2>
                <p>Your account is now active. Opening Campus Life app...</p>
                <a href="campuslife://verified" class="button">Open App</a>
            </div>
            <div id="error" style="display: none;">
                <h2>❌ Verification failed</h2>
                <p id="error-message">The verification link is invalid or expired.</p>
                <a href="campuslife://verification-failed" class="button">Return to App</a>
            </div>
        </div>
    </div>

    <script>
        const token = window.location.pathname.split('/').pop();
        
        // Call your Firebase function to verify the token
        fetch(`https://your-backend.com/verify-token/${token}`, {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            document.getElementById('loading').style.display = 'none';
            
            if (data.success) {
                document.getElementById('success').style.display = 'block';
                // Redirect to app after 3 seconds
                setTimeout(() => {
                    window.location.href = 'campuslife://verified';
                }, 3000);
            } else {
                document.getElementById('error').style.display = 'block';
                document.getElementById('error-message').textContent = data.error || 'Verification failed';
            }
        })
        .catch(error => {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('error').style.display = 'block';
        });
    </script>
</body>
</html>
```

### 4. Deep Linking Setup

#### Add to your `app.json`:
```json
{
  "expo": {
    "scheme": "campuslife",
    "ios": {
      "associatedDomains": ["applinks:your-website.com"]
    },
    "android": {
      "intentFilters": [{
        "action": "VIEW",
        "data": {
          "scheme": "campuslife"
        },
        "category": ["BROWSABLE", "DEFAULT"]
      }]
    }
  }
}
```

#### Handle deep links in your app:
```typescript
import * as Linking from 'expo-linking';

// In your main App component
useEffect(() => {
  const handleDeepLink = (url: string) => {
    if (url.includes('campuslife://verified')) {
      // Handle successful verification
      Alert.alert('Success', 'Email verified successfully!');
      // Refresh user data or navigate
    } else if (url.includes('campuslife://verification-failed')) {
      // Handle verification failure
      Alert.alert('Error', 'Email verification failed. Please try again.');
    }
  };

  // Handle app opened via deep link
  Linking.getInitialURL().then((url) => {
    if (url) handleDeepLink(url);
  });

  // Handle deep links when app is running
  const subscription = Linking.addEventListener('url', ({ url }) => {
    handleDeepLink(url);
  });

  return () => subscription?.remove();
}, []);
```

## Environment Variables

Add to your `.env`:
```
# Your backend API
EXPO_PUBLIC_EMAIL_SERVICE_URL=https://your-backend.com/send-email
EXPO_PUBLIC_EMAIL_SERVICE_KEY=your-api-key

# Email service (choose one)
SENDGRID_API_KEY=your-sendgrid-key
RESEND_API_KEY=your-resend-key
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret

# From email address  
EXPO_PUBLIC_FROM_EMAIL=noreply@campus-life.app
```

## Deployment Options

### Quick Setup (Recommended)
1. **Vercel/Netlify** for the verification website
2. **Railway/Render** for the backend API
3. **SendGrid/Resend** for email service

### Production Setup
1. **AWS/Google Cloud** for full infrastructure
2. **Custom domain** for professional emails
3. **CDN** for faster global access

## Security Considerations

1. **Rate limiting** on email endpoints
2. **Token expiration** (24 hours max)
3. **HTTPS everywhere**
4. **Input validation** on all endpoints
5. **CORS configuration** for your domain only

## Testing

```bash
# Test email sending
curl -X POST https://your-backend.com/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "type": "email_verification", 
    "data": {
      "name": "Test User",
      "verificationUrl": "https://your-website.com/verify/email_verification/test-token"
    }
  }'
```

## Migration Timeline

1. **Phase 1** (Now): Implement custom system alongside Firebase
2. **Phase 2** (Before Aug 2025): Test thoroughly and switch to custom system
3. **Phase 3** (After Aug 2025): Remove Firebase Dynamic Links dependency

This solution will work **permanently** and gives you full control over the email verification process!