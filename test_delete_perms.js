// Test delete permissions using web SDK to match client behavior
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, collection, query, where, getDocs } = require('firebase/firestore');

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

async function testCollectionAccess() {
  const userId = "BjzxG0cZ8hMj9xMn2m94HlRvvZP2";
  const email = "chedcheese7@gmail.com";

  console.log("🚀 Starting permission test for user:", userId);

  // Test each collection that delete account tries to access
  const collections = [
    { name: 'users', field: null, docId: userId },
    { name: 'profiles', field: null, docId: userId },
    { name: 'wellness_entries', field: 'user_id', value: userId },
    { name: 'rewards', field: 'user_id', value: userId },
    { name: 'messages', field: 'from_user_id', value: userId },
    { name: 'payments', field: 'parent_id', value: userId },
    { name: 'payments', field: 'student_id', value: userId },
    { name: 'item_requests', field: 'student_id', value: userId },
    { name: 'item_requests', field: 'parent_id', value: userId },
    { name: 'subscriptions', field: 'user_id', value: userId },
    { name: 'monthly_spend', field: 'parent_id', value: userId },
    { name: 'transactions', field: 'parentId', value: userId },
    { name: 'transactions', field: 'studentId', value: userId },
    { name: 'user_progress', field: null, docId: userId }
  ];

  for (const test of collections) {
    try {
      console.log(`\n📋 Testing ${test.name}${test.field ? ` (${test.field} == ${test.value})` : ` doc ${test.docId}`}`);

      if (test.field) {
        // Test query
        const q = query(collection(db, test.name), where(test.field, '==', test.value));
        const snapshot = await getDocs(q);
        console.log(`  ✅ Query successful: ${snapshot.docs.length} docs`);
      } else {
        // Test direct doc access
        console.log(`  ✅ Would access doc: ${test.name}/${test.docId}`);
      }
    } catch (error) {
      console.error(`  ❌ FAILED: ${error.code} - ${error.message}`);
    }
  }
}

// For testing without auth (to see what happens)
testCollectionAccess().catch(console.error);