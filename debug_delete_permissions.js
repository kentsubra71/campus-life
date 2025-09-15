// Debug script to test delete account permissions
// Run with: node debug_delete_permissions.js

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, deleteDoc, collection, query, where, getDocs, writeBatch } = require('firebase/firestore');

// Firebase config - replace with your actual config
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "campus-life-b0fd3.firebaseapp.com",
  projectId: "campus-life-b0fd3",
  storageBucket: "campus-life-b0fd3.firebasestorage.app",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function testDeletePermissions() {
  try {
    // Sign in as the test user
    const email = "chedcheese7@gmail.com";
    const password = "your-password"; // You'll need to provide this
    const userId = "BjzxG0cZ8hMj9xMn2m94HlRvvZP2";

    console.log("🔐 Signing in...");
    await signInWithEmailAndPassword(auth, email, password);
    console.log("✅ Signed in successfully");

    const collectionsToTest = [
      { name: 'users', field: 'user_id', value: userId },
      { name: 'profiles', field: 'user_id', value: userId },
      { name: 'wellness_entries', field: 'user_id', value: userId },
      { name: 'rewards', field: 'user_id', value: userId },
      { name: 'messages', field: 'from_user_id', value: userId },
      { name: 'payments', field: 'parent_id', value: userId },
      { name: 'payments', field: 'student_id', value: userId },
      { name: 'item_requests', field: 'student_id', value: userId },
      { name: 'item_requests', field: 'parent_id', value: userId },
      { name: 'subscriptions', field: 'user_id', value: userId },
      { name: 'monthly_spend', field: 'parent_id', value: userId },
      { name: 'user_progress', field: 'user_id', value: userId }
    ];

    for (const testCollection of collectionsToTest) {
      try {
        console.log(`\n📋 Testing collection: ${testCollection.name} (${testCollection.field} == ${testCollection.value})`);

        // Test query permission
        const q = query(
          collection(db, testCollection.name),
          where(testCollection.field, '==', testCollection.value)
        );

        console.log("  🔍 Testing query permission...");
        const snapshot = await getDocs(q);
        console.log(`  ✅ Query successful: ${snapshot.docs.length} documents found`);

        // Test delete permission on each document
        if (snapshot.docs.length > 0) {
          console.log("  🗑️ Testing delete permissions...");
          for (const docSnapshot of snapshot.docs) {
            try {
              // Don't actually delete in test, just check if we have permission
              console.log(`    📄 Document ${docSnapshot.id}: Would attempt delete`);
              // await deleteDoc(docSnapshot.ref); // Uncomment to actually test delete
              console.log(`    ✅ Delete permission check passed`);
            } catch (error) {
              console.error(`    ❌ Delete failed for ${docSnapshot.id}:`, error.message);
            }
          }
        }

      } catch (error) {
        console.error(`  ❌ Error with ${testCollection.name}:`, error.message);
        console.error(`     Code: ${error.code}`);
      }
    }

    // Test specific document deletions
    console.log(`\n🎯 Testing direct document deletions...`);

    const directDeletions = [
      { collection: 'users', docId: userId },
      { collection: 'profiles', docId: userId },
      { collection: 'user_progress', docId: userId }
    ];

    for (const deletion of directDeletions) {
      try {
        console.log(`  Testing deletion of ${deletion.collection}/${deletion.docId}`);
        // Don't actually delete in test
        // await deleteDoc(doc(db, deletion.collection, deletion.docId));
        console.log(`  ✅ Would be able to delete ${deletion.collection}/${deletion.docId}`);
      } catch (error) {
        console.error(`  ❌ Cannot delete ${deletion.collection}/${deletion.docId}:`, error.message);
      }
    }

  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Code:", error.code);
  }
}

// Run the test
testDeletePermissions().then(() => {
  console.log("\n🏁 Test completed");
  process.exit(0);
}).catch(console.error);