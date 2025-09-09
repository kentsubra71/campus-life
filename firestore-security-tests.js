// Firestore Security Rules Tests
// Run with: firebase emulators:exec --only firestore "npm test"

const firebase = require('@firebase/rules-unit-testing');
const fs = require('fs');

const PROJECT_ID = 'campus-life-test';
const RULES_FILE = './firestore-security-rules-NEW.rules';

let testEnv;

beforeAll(async () => {
  testEnv = await firebase.initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(RULES_FILE, 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// Helper function to create authenticated context
function authedApp(uid, tokenOverrides = {}) {
  return testEnv.authenticatedContext(uid, {
    email_verified: true,
    family_id: 'family1',
    user_type: 'student',
    ...tokenOverrides,
  }).firestore();
}

function unauthenticatedApp() {
  return testEnv.unauthenticatedContext().firestore();
}

describe('Critical Security Tests', () => {
  
  // CRITICAL: Test family isolation bypass attempts
  test('CRITICAL: Prevent cross-family data access', async () => {
    const studentFamily1 = authedApp('student1', { 
      family_id: 'family1', 
      user_type: 'student' 
    });
    const studentFamily2 = authedApp('student2', { 
      family_id: 'family2', 
      user_type: 'student' 
    });

    // Student1 creates wellness entry
    await studentFamily1.collection('wellness_entries').doc('entry1').set({
      user_id: 'student1',
      date: '2023-10-01',
      sleep_ranking: 1,
      nutrition_ranking: 2,
      academics_ranking: 3,
      social_ranking: 4,
      overall_mood: 7
    });

    // Student2 should NOT be able to read student1's data
    await firebase.assertFails(
      studentFamily2.collection('wellness_entries').doc('entry1').get()
    );
  });

  // CRITICAL: Test privilege escalation prevention
  test('CRITICAL: Prevent user_type escalation', async () => {
    const student = authedApp('student1', { 
      family_id: 'family1', 
      user_type: 'student' 
    });

    // Should fail: Student trying to escalate to parent
    await firebase.assertFails(
      student.collection('users').doc('student1').update({
        user_type: 'parent'
      })
    );
  });

  // CRITICAL: Test payment amount manipulation
  test('CRITICAL: Prevent payment amount manipulation', async () => {
    const parent = authedApp('parent1', { 
      family_id: 'family1', 
      user_type: 'parent' 
    });

    // Should fail: Excessive payment amount
    await firebase.assertFails(
      parent.collection('payments').doc('payment1').set({
        parent_id: 'parent1',
        student_id: 'student1',
        amount_cents: 100000, // $1000 > $500 limit
        provider: 'paypal',
        status: 'pending'
      })
    );
  });

  // CRITICAL: Test family member limit bypass
  test('CRITICAL: Prevent family limit bypass', async () => {
    const parent = authedApp('parent1', { 
      family_id: 'family1', 
      user_type: 'parent' 
    });

    // Create family with 10 students (limit)
    const studentIds = Array.from({length: 11}, (_, i) => `student${i}`);

    // Should fail: Exceeding 10 student limit
    await firebase.assertFails(
      parent.collection('families').doc('family1').set({
        name: 'Test Family',
        created_by: 'parent1',
        parentIds: ['parent1'],
        studentIds: studentIds, // 11 students > 10 limit
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      })
    );
  });

  // CRITICAL: Test unauthenticated access
  test('CRITICAL: Block unauthenticated access', async () => {
    const unauthed = unauthenticatedApp();

    await firebase.assertFails(
      unauthed.collection('users').doc('user1').get()
    );

    await firebase.assertFails(
      unauthed.collection('payments').doc('payment1').get()
    );
  });

  // CRITICAL: Test sensitive field protection
  test('CRITICAL: Protect payment status field', async () => {
    const student = authedApp('student1', { 
      family_id: 'family1', 
      user_type: 'student' 
    });

    // Should fail: Student cannot create payments
    await firebase.assertFails(
      student.collection('payments').doc('payment1').set({
        parent_id: 'parent1',
        student_id: 'student1',
        amount_cents: 1000,
        provider: 'paypal',
        status: 'completed' // Only server should set this
      })
    );
  });

});

// Run tests with detailed output
describe('Payment Security Tests', () => {
  test('Valid parent payment creation', async () => {
    const parent = authedApp('parent1', { 
      family_id: 'family1', 
      user_type: 'parent' 
    });

    await firebase.assertSucceeds(
      parent.collection('payments').doc('payment1').set({
        parent_id: 'parent1',
        student_id: 'student1',
        amount_cents: 2500, // $25
        provider: 'paypal',
        status: 'pending'
      })
    );
  });

  test('Block payment updates (server-only)', async () => {
    const parent = authedApp('parent1', { 
      family_id: 'family1', 
      user_type: 'parent' 
    });

    // Even parents cannot update payments (server-only)
    await firebase.assertFails(
      parent.collection('payments').doc('payment1').update({
        status: 'completed'
      })
    );
  });
});

console.log('🔒 Running Firestore Security Rules Tests...');
console.log('⚠️  CRITICAL: Review all test failures immediately');