import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function initializeCollections() {
  try {
    console.log('Initializing Firestore collections...');
    
    // 1. Create families collection
    console.log('Creating families collection...');
    const familyData = {
      name: 'Sample Family',
      inviteCode: 'FAMILY123',
      parentIds: ['parent_123'],
      studentIds: ['student_456'],
      created_at: Timestamp.now(),
      updated_at: Timestamp.now()
    };
    
    const familyRef = await addDoc(collection(db, 'families'), familyData);
    console.log('Family document created with ID:', familyRef.id);
    
    // 2. Create wellness_entries collection
    console.log('Creating wellness_entries collection...');
    const wellnessData = {
      user_id: 'student_456',
      mood: 7,
      stress_level: 4,
      sleep_hours: 8,
      exercise_minutes: 30,
      notes: 'Feeling good today, had a good workout',
      created_at: Timestamp.now()
    };
    
    const wellnessRef = await addDoc(collection(db, 'wellness_entries'), wellnessData);
    console.log('Wellness entry created with ID:', wellnessRef.id);
    
    // 3. Create rewards collection
    console.log('Creating rewards collection...');
    const rewardData = {
      user_id: 'student_456',
      points: 100,
      reason: 'Completed weekly wellness check-in',
      created_at: Timestamp.now()
    };
    
    const rewardRef = await addDoc(collection(db, 'rewards'), rewardData);
    console.log('Reward entry created with ID:', rewardRef.id);
    
    console.log('All collections initialized successfully!');
    
  } catch (error) {
    console.error('Error initializing collections:', error);
  }
}

// Run the initialization
initializeCollections();