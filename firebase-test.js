// Basic Firebase test to check auth and permissions
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

// Firebase config - using your project
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log('🔥 Firebase Test Starting...');

onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log('✅ User is authenticated:', {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified
    });

    // Test 1: Try to read own user document
    console.log('\n🧪 TEST 1: Reading own user document...');
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        console.log('✅ Own user document read SUCCESS:', userDoc.data());
      } else {
        console.log('❌ Own user document does not exist');
      }
    } catch (error) {
      console.error('❌ Own user document read FAILED:', error);
    }

    // Test 2: Try to query payments
    console.log('\n🧪 TEST 2: Querying payments...');
    try {
      const paymentsQuery = query(
        collection(db, 'payments'),
        where('parent_id', '==', user.uid)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      console.log('✅ Payments query SUCCESS:', paymentsSnapshot.size, 'documents');
    } catch (error) {
      console.error('❌ Payments query FAILED:', error);
    }

    // Test 3: Try to query messages
    console.log('\n🧪 TEST 3: Querying messages...');
    try {
      const messagesQuery = query(
        collection(db, 'messages'),
        where('from_user_id', '==', user.uid)
      );
      const messagesSnapshot = await getDocs(messagesQuery);
      console.log('✅ Messages query SUCCESS:', messagesSnapshot.size, 'documents');
    } catch (error) {
      console.error('❌ Messages query FAILED:', error);
    }

    // Test 4: Try to query support requests
    console.log('\n🧪 TEST 4: Querying support requests...');
    try {
      // First get user's family_id
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const familyId = userDoc.data()?.family_id;
      
      if (familyId) {
        const supportQuery = query(
          collection(db, 'support_requests'),
          where('family_id', '==', familyId)
        );
        const supportSnapshot = await getDocs(supportQuery);
        console.log('✅ Support requests query SUCCESS:', supportSnapshot.size, 'documents');
      } else {
        console.log('❌ No family_id found in user document');
      }
    } catch (error) {
      console.error('❌ Support requests query FAILED:', error);
    }

  } else {
    console.log('❌ User is NOT authenticated');
  }
});