// Quick working test for email verification
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

async function quickTest() {
  try {
    // Use one of the test accounts you mentioned
    const email = "shewannaprayinjapan@gmail.com"; // Jane Doe
    const password = "Ronald12"; // You'll need to provide the actual password

    console.log("🔐 Signing in...");
    await signInWithEmailAndPassword(auth, email, password);
    console.log("✅ Signed in successfully");

    console.log("📧 Testing email verification resend...");
    const resendVerificationEmail = httpsCallable(functions, 'resendVerificationEmail');

    const result = await resendVerificationEmail({});
    console.log("✅ SUCCESS:", result.data.message);
    console.log("📬 Check your email inbox!");

  } catch (error) {
    console.error("❌ ERROR:", error.code, "-", error.message);

    if (error.code === 'functions/already-exists') {
      console.log("ℹ️  Email is already verified - this is expected for verified accounts");
    } else if (error.code === 'auth/wrong-password') {
      console.log("ℹ️  Wrong password - update the password in the script");
    } else if (error.code === 'auth/user-not-found') {
      console.log("ℹ️  User not found - check the email address");
    }
  }
}

console.log("🧪 Quick Email Verification Test");
console.log("=================================");
quickTest().then(() => {
  console.log("\n🏁 Test completed");
  process.exit(0);
}).catch(console.error);