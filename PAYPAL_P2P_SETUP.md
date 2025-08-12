# PayPal P2P Payment System Setup Guide

This guide explains how to set up and test the new PayPal P2P (peer-to-peer) payment system.

## Overview

The new system enables direct PayPal-to-PayPal transfers between parents and students using:
- **PayPal Orders API v2** for creating and capturing payments
- **Firebase Cloud Functions** for secure server-side processing
- **Real-time verification** of payment completion
- **Personal PayPal accounts** (no business account required)

## 🏗️ Architecture

```
Parent App → Firebase Function → PayPal API → Student PayPal Account
     ↓              ↓               ↓
Transaction    Order Created    Payment Made
  Logged      & Tracked        & Verified
```

## 🔧 Setup Instructions

### 1. PayPal Developer Setup

1. **Create PayPal Developer Account**
   - Go to [PayPal Developer](https://developer.paypal.com/)
   - Sign in with your PayPal account
   - Create a new application

2. **Create Sandbox Accounts**
   - Create 2 sandbox accounts (Personal type):
     - Parent account (sender)
     - Student account (recipient)
   - Note down their emails and passwords

3. **Get API Credentials**
   - In your app dashboard, get:
     - `Client ID`
     - `Client Secret`
   - Set mode to **Sandbox** for testing

### 2. Firebase Functions Configuration

**Option A: Using Firebase CLI**
```bash
cd functions
firebase functions:config:set paypal.client_id="YOUR_CLIENT_ID"
firebase functions:config:set paypal.client_secret="YOUR_CLIENT_SECRET"
firebase functions:config:set paypal.base_url="https://api-m.sandbox.paypal.com"
```

**Option B: Environment Variables (Local Testing)**
Create `functions/.env` file:
```env
PAYPAL_CLIENT_ID=YOUR_CLIENT_ID
PAYPAL_CLIENT_SECRET=YOUR_CLIENT_SECRET
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
```

### 3. Firebase Functions Deployment

```bash
# Install dependencies
cd functions
npm install

# Build TypeScript
npm run build

# Deploy functions
firebase deploy --only functions
```

### 4. User Profile Setup

Each student must have a PayPal email in their profile:
```javascript
// In Firestore users collection
{
  id: "student_id",
  email: "student@example.com",
  paypal_email: "student.sandbox@example.com", // ← Required
  // ... other fields
}
```

## 🧪 Testing Guide

### Step 1: Test PayPal Connection

1. Open Campus Life app as a parent
2. Navigate to **PayPal Test Screen** (add to navigation for testing)
3. Run "Test Connection" - should return success

### Step 2: Create Test Order

1. In PayPal Test Screen, click "Create Test Order"
2. Should return:
   - `orderId` (PayPal order ID)
   - `transactionId` (our internal ID)
   - `approvalUrl` (PayPal checkout URL)

### Step 3: Complete Payment Flow

1. **Create Payment**: Use normal payment flow with PayPal selected
2. **PayPal Checkout**: Opens PayPal sandbox login
3. **Login**: Use parent sandbox account credentials
4. **Pay**: Complete payment to student account
5. **Return**: Should redirect back to app
6. **Verify**: Payment automatically verified and marked complete

### Step 4: Debug Payment Issues

Use the debug logging throughout:
```
🔍 [SendPayment] Starting payment process
🔍 [PayPalP2P.createOrder] Creating order
🔍 [PayPalTest] Connection test result
```

## 🔍 Testing Points & Debug Features

### Built-in Debug Tools

1. **PayPal Test Screen** (`/PayPalTest`)
   - Test connection to PayPal API
   - Create test orders
   - Check transaction status
   - View detailed logs

2. **Console Logging**
   - All functions include detailed `debugLog` calls
   - Track order creation, verification, and errors
   - Monitor API responses

3. **Test Buttons**
   - "Debug: Test Success" button in payment alerts
   - Simulates successful PayPal return
   - Bypasses actual PayPal completion

### Manual Testing Steps

1. **Connection Test**
   ```
   PayPal Test → Test Connection → Should show success
   ```

2. **Order Creation**
   ```
   Send Payment → Select PayPal → Create order → Check logs
   ```

3. **Payment Verification**
   ```
   Complete PayPal → Return to app → Auto-verify → Check status
   ```

## 🚨 Troubleshooting

### Common Issues

**❌ "PayPal connection failed"**
- Check Client ID and Secret are set correctly
- Verify base URL is correct for sandbox
- Check Firebase Functions are deployed

**❌ "Student PayPal email not found"**
- Ensure student profile has `paypal_email` field
- Email must be valid PayPal sandbox account

**❌ "Payment verification failed"**
- Check PayPal order was actually completed
- Verify order ID matches between creation and verification
- Check Firebase Functions logs for detailed error

**❌ Deep link not working**
- Ensure app scheme is registered: `campuslife://`
- Check return URL configuration in PayPal

### Debug Commands

```bash
# Check function logs
firebase functions:log

# Test locally with emulator
firebase emulators:start --only functions

# Check Firestore security rules
firebase firestore:rules:get
```

## 📊 Transaction Data Structure

```typescript
interface Transaction {
  id: string;
  parentId: string;           // Firebase Auth UID
  studentId: string;          // Firebase Auth UID
  paypalOrderId: string;      // PayPal order ID
  amountCents: number;        // Amount in cents
  note: string;               // Payment note
  recipientEmail: string;     // Student PayPal email
  status: 'created' | 'completed' | 'failed';
  createdAt: Timestamp;
  completedAt?: Timestamp;
  paypalCaptureId?: string;   // PayPal capture ID
  paypalCaptureData?: any;    // Full PayPal response
}
```

## 🔐 Security Features

1. **Server-side API calls**: No PayPal credentials in client
2. **User authentication**: Firebase Auth required
3. **Family verification**: Only family members can transact
4. **Transaction logging**: All payments tracked in Firestore
5. **Firestore rules**: Strict read/write permissions

## 🎯 Production Checklist

Before going live:

- [ ] Replace sandbox URLs with production
- [ ] Update PayPal app to live mode
- [ ] Set production Client ID/Secret
- [ ] Test with real PayPal accounts
- [ ] Update Firestore security rules
- [ ] Remove debug buttons and test screens
- [ ] Add proper error handling
- [ ] Set up monitoring and alerts

## 📱 User Experience

### For Parents:
1. Select student and amount
2. Choose PayPal as payment method
3. Redirected to PayPal login
4. Complete payment with their account
5. Return to app automatically
6. Payment verified and recorded

### For Students:
1. Receive real money in PayPal account
2. See payment notification in app
3. View payment history
4. No manual confirmation needed

This system provides a seamless, secure, and verifiable way for family payments using personal PayPal accounts!