/**
 * DEBUG SCRIPT: Test Parent Registration Flow Step by Step
 * Run with: node debug-registration.js
 */

const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser } = require('firebase/auth');
const { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc } = require('firebase/firestore');
const { getFunctions, httpsCallable } = require('firebase/functions');

// Firebase config (same as app)
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
const db = getFirestore(app);
const functions = getFunctions(app);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function debugRegistration() {
  const testEmail = `debug-test-${Date.now()}@test.com`;
  const testPassword = 'TestPassword123!';
  const testName = 'Debug Test User';
  const testFamilyName = 'Debug Test Family';

  console.log('\n🧪 DEBUG: Starting Parent Registration Flow Test');
  console.log(`📧 Test Email: ${testEmail}`);

  let user = null;

  try {
    // STEP 1: Create Firebase Auth User
    console.log('\n1️⃣ Creating Firebase Auth user...');
    const userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
    user = userCredential.user;
    console.log(`✅ User created with UID: ${user.uid}`);

    // STEP 2: Wait for onUserCreated to complete
    console.log('\n2️⃣ Waiting for onUserCreated trigger...');

    let attempts = 0;
    const maxAttempts = 30;
    let customClaims = null;

    while (attempts < maxAttempts) {
      try {
        const token = await user.getIdTokenResult(true);
        console.log(`📋 Custom claims (attempt ${attempts + 1}):`, token.claims);

        if (token.claims.initialized) {
          console.log('✅ onUserCreated completed');
          customClaims = token.claims;
          break;
        }

        await sleep(1000);
        attempts++;
      } catch (error) {
        console.log(`⚠️ Error getting token (attempt ${attempts + 1}):`, error.message);
        attempts++;
        await sleep(1000);
      }
    }

    if (!customClaims?.initialized) {
      throw new Error('onUserCreated did not complete in time');
    }

    // STEP 3: Check if user document was created server-side
    console.log('\n3️⃣ Checking user document in Firestore...');
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      console.log('✅ User document exists:', userDoc.data());
    } else {
      console.log('❌ User document does not exist!');
    }

    // STEP 4: Try to update user document (should work)
    console.log('\n4️⃣ Trying to update user document...');
    try {
      await updateDoc(userDocRef, {
        full_name: testName,
        user_type: 'parent',
        updated_at: new Date()
      });
      console.log('✅ User document updated successfully');
    } catch (error) {
      console.log('❌ Failed to update user document:', error.message);
      console.log('Error code:', error.code);
    }

    // STEP 5: Try to create profile document (might fail)
    console.log('\n5️⃣ Checking profiles collection rules...');
    try {
      const profileRef = doc(db, 'profiles', user.uid);
      await setDoc(profileRef, {
        id: user.uid,
        email: testEmail,
        full_name: testName,
        user_type: 'parent',
        created_at: new Date()
      });
      console.log('✅ Profile document created successfully');
    } catch (error) {
      console.log('❌ Failed to create profile document:', error.message);
      console.log('Error code:', error.code);
    }

    // STEP 6: Test createFamilyServerSide function
    console.log('\n6️⃣ Testing createFamilyServerSide function...');
    try {
      const createFamilyFunction = httpsCallable(functions, 'createFamilyServerSide');
      const result = await createFamilyFunction({
        familyName: testFamilyName,
        parentId: user.uid
      });
      console.log('✅ Family created successfully:', result.data);
    } catch (error) {
      console.log('❌ Failed to create family:', error.message);
      console.log('Error code:', error.code);
      console.log('Error details:', error.details);
    }

    // STEP 7: Check final token state
    console.log('\n7️⃣ Final token state...');
    const finalToken = await user.getIdTokenResult(true);
    console.log('📋 Final custom claims:', finalToken.claims);

  } catch (error) {
    console.log('\n❌ Registration flow failed:', error.message);
    console.log('Error code:', error.code);
  } finally {
    // CLEANUP: Delete test user
    if (user) {
      console.log('\n🧹 Cleaning up test user...');
      try {
        await deleteUser(user);
        console.log('✅ Test user deleted');
      } catch (error) {
        console.log('⚠️ Could not delete test user:', error.message);
        console.log(`Please manually delete user: ${user.uid}`);
      }
    }
  }
}

// Run the debug test
debugRegistration().then(() => {
  console.log('\n🏁 Debug test completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Debug test crashed:', error);
  process.exit(1);
});