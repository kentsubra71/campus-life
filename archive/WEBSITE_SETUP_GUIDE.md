# 🌐 How to Create Your Verification Website

This guide shows you how to deploy your email verification website using **Vercel** (free and easy).

## 📁 Files Created

I've created a complete website in the `verification-website/` folder:

```
verification-website/
├── index.html          # Main verification page
├── api/
│   └── verifyToken.js   # Token verification API
├── vercel.json         # Vercel configuration
└── package.json        # Dependencies
```

## 🚀 Deploy to Vercel (Free)

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Login to Vercel
```bash
vercel login
```

### Step 3: Deploy the Website
```bash
cd verification-website
vercel --prod
```

**That's it!** Vercel will give you a URL like: `https://campus-life-verify.vercel.app`

## 🔧 Configuration

### Step 1: Set Environment Variables in Vercel

Go to your Vercel dashboard → Project → Settings → Environment Variables

Add these variables:
```
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
```

### Step 2: Update Email Verification URL

In your React Native app, update this file:
`src/lib/emailVerification.ts`

Change line 102:
```typescript
const verificationUrl = `https://your-actual-vercel-url.vercel.app/verify/${type}/${token}`;
```

Replace with your real Vercel URL.

## 🎯 Alternative: Static Hosting

If you prefer other hosting options:

### **Option A: Netlify**
1. Drag the `verification-website` folder to [netlify.com/drop](https://app.netlify.com/drop)
2. Done! You get a URL instantly

### **Option B: GitHub Pages**
1. Create a new GitHub repository
2. Upload the files
3. Enable GitHub Pages in repository settings

### **Option C: Firebase Hosting**
```bash
cd verification-website
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## 📱 Test the Flow

1. **Sign up in your app** with a real email address
2. **Check your email** for the verification link
3. **Click the link** → Should open the website
4. **Website should verify** and redirect back to app

## 🔗 Deep Linking Setup

Add this to your `app.json`:
```json
{
  "expo": {
    "scheme": "campuslife",
    "ios": {
      "bundleIdentifier": "com.yourname.campuslife"
    },
    "android": {
      "package": "com.yourname.campuslife"
    }
  }
}
```

## 🛠 Troubleshooting

### Website doesn't verify tokens
1. Check Vercel environment variables
2. Make sure Firebase config is correct
3. Check browser console for errors

### App doesn't open from website
1. Make sure scheme is configured in `app.json`
2. Test deep link: `campuslife://verified`
3. Install app first, then test

### Email not sending
1. Check Resend API key in the app code
2. Verify the "from" email domain with Resend
3. Check console logs for Resend errors

## 🎨 Customize the Website

You can modify:
- **Colors**: Change the gradient in `index.html`
- **Logo**: Replace the 📚 emoji with your logo
- **Text**: Update all messaging to match your brand
- **Domain**: Use a custom domain in Vercel settings

## 📊 Monitor Usage

- **Vercel Dashboard**: See website visits and API calls
- **Resend Dashboard**: See email delivery rates
- **Firebase Console**: Monitor token creation/verification

## 💡 Pro Tips

1. **Custom Domain**: Add your own domain in Vercel (e.g., `verify.campus-life.app`)
2. **Analytics**: Add Google Analytics to track verification success rates
3. **Error Tracking**: Add Sentry for error monitoring
4. **A/B Testing**: Try different email templates with Resend tags

Your verification system is now **completely independent** of Firebase Dynamic Links and will work forever! 🚀