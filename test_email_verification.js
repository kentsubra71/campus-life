// Quick test script for email verification function
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFunctions, httpsCallable } = require('firebase/functions');

const firebaseConfig = {
  apiKey: "AIzaSyC8j70Zk-rxngvd6eOHlrsQ0dIePKj4nks",
  authDomain: "campus-life-b0fd3.firebaseapp.com",
  projectId: "campus-life-b0fd3",
  storageBucket: "campus-life-b0fd3.firebasestorage.app",
  messagingSenderId: "1028408297935",
  appId: "1:1028408297935:web:45a5f47a3a2d14f7482aba"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app);

async function testEmailVerification() {
  try {
    console.log("🔐 Please provide credentials for testing:");
    console.log("This script will test the resendVerificationEmail Cloud Function");

    // You can replace these with test credentials
    const email = "test@example.com";
    const password = "your-password";

    console.log(`\n🔐 Signing in as: ${email}`);
    await signInWithEmailAndPassword(auth, email, password);
    console.log("✅ Signed in successfully");

    console.log("\n📧 Testing resendVerificationEmail function...");
    const resendVerificationEmail = httpsCallable(functions, 'resendVerificationEmail');

    const result = await resendVerificationEmail({});
    console.log("✅ Function call successful:", result.data);

  } catch (error) {
    console.error("❌ Test failed:", error.code, "-", error.message);

    if (error.code === 'functions/already-exists') {
      console.log("ℹ️  This means the email is already verified (expected for some accounts)");
    } else if (error.code === 'functions/unauthenticated') {
      console.log("ℹ️  Authentication failed - check credentials");
    } else if (error.code === 'functions/internal') {
      console.log("ℹ️  Internal error - likely the Resend API key issue");
    }
  }
}

console.log("🧪 Email Verification Test Script");
console.log("==================================");
console.log("This script tests the resendVerificationEmail Cloud Function");
console.log("\nTo run this test:");
console.log("1. Update the email/password variables above");
console.log("2. Run: node test_email_verification.js");
console.log("3. Check the console output for results\n");

// Uncomment to run the test
// testEmailVerification();