import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, getDocs, orderBy, Timestamp, limit } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Types
export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  user_type: 'student' | 'parent';
  family_id?: string;
  email_verified: boolean;
  verification_token?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface WellnessEntry {
  id?: string;
  user_id: string;
  mood: number;
  stress_level: number;
  sleep_hours: number;
  exercise_minutes: number;
  notes?: string;
  created_at: Timestamp;
}

export interface RewardEntry {
  id?: string;
  user_id: string;
  points: number;
  reason: string;
  created_at: Timestamp;
}

export interface Family {
  id: string;
  name: string;
  inviteCode: string;
  parentIds: string[];
  studentIds: string[];
  created_at: Timestamp;
  updated_at: Timestamp;
}

// Auth functions
export const signUpUser = async (email: string, password: string, fullName: string, userType: 'student' | 'parent') => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update display name
    await updateProfile(user, { displayName: fullName });

    // Create user profile in Firestore with email verification status
    const userProfile: UserProfile = {
      id: user.uid,
      email: user.email!,
      full_name: fullName,
      user_type: userType,
      email_verified: false, // Will be set to true after custom verification
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    };

    await setDoc(doc(db, 'users', user.uid), userProfile);
    
    // Also create profile for students with extended data
    if (userType === 'student') {
      await setDoc(doc(db, 'profiles', user.uid), {
        id: user.uid,
        email: user.email!,
        full_name: fullName,
        user_type: userType,
        email_verified: false, // Will be set to true after custom verification
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
        profile_completed: false,
        emergency_contact: '',
        phone: '',
        school: '',
        major: '',
        graduation_year: new Date().getFullYear().toString()
      });
    }

    // Use custom email verification system (future-proof)
    const { createVerificationToken, sendVerificationEmail } = await import('./emailVerification');
    
    const tokenResult = await createVerificationToken(user.uid, email, 'email_verification');
    if (tokenResult.error) {
      console.error('Failed to create verification token:', tokenResult.error);
      return { user, error: null, emailSent: false };
    }
    
    const emailResult = await sendVerificationEmail(email, fullName, tokenResult.token, 'email_verification');
    
    return { 
      user, 
      error: null, 
      emailSent: emailResult.success,
      verificationToken: tokenResult.token 
    };
  } catch (error: any) {
    return { user: null, error: error.message, emailSent: false };
  }
};

export const signInUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
};

export const getCurrentUser = () => {
  return auth.currentUser;
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Database functions
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error: any) {
    if (error.code === 'permission-denied' || error.code === 'not-found') {
      console.log(`User profile not accessible for user ${userId}`);
      return null;
    }
    console.error('Error getting user profile:', error);
    return null;
  }
};

export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>) => {
  try {
    const docRef = doc(db, 'users', userId);
    await setDoc(docRef, { ...updates, updated_at: Timestamp.now() }, { merge: true });
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
};

// Wellness functions
export const addWellnessEntry = async (entry: Omit<WellnessEntry, 'id' | 'created_at'>) => {
  try {
    const wellnessEntry = {
      ...entry,
      created_at: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, 'wellness_entries'), wellnessEntry);
    return { id: docRef.id, error: null };
  } catch (error: any) {
    return { id: null, error: error.message };
  }
};

export const getWellnessEntries = async (userId: string, limitCount: number = 50): Promise<WellnessEntry[]> => {
  try {
    // Use proper orderBy with limit for better performance
    const q = query(
      collection(db, 'wellness_entries'),
      where('user_id', '==', userId),
      orderBy('created_at', 'desc'),
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    } as WellnessEntry));
  } catch (error: any) {
    // If orderBy fails due to missing index, fallback to client-side sorting
    if (error.code === 'failed-precondition') {
      console.log('Firestore index missing, using fallback query');
      try {
        const fallbackQuery = query(
          collection(db, 'wellness_entries'),
          where('user_id', '==', userId)
        );
        const querySnapshot = await getDocs(fallbackQuery);
        const entries: WellnessEntry[] = [];
        
        querySnapshot.forEach((doc) => {
          entries.push({ id: doc.id, ...doc.data() } as WellnessEntry);
        });
        
        return entries
          .sort((a, b) => b.created_at.seconds - a.created_at.seconds)
          .slice(0, limitCount);
      } catch (fallbackError: any) {
        console.error('Fallback query also failed:', fallbackError);
        throw fallbackError;
      }
    }
    
    // Handle other specific errors
    if (error.code === 'not-found' || error.code === 'permission-denied') {
      console.log('Wellness entries collection issue, returning empty array');
      return [];
    }
    
    console.error('Error getting wellness entries:', error);
    throw error; // Re-throw for proper error handling upstream
  }
};

// Rewards functions
export const addRewardEntry = async (entry: Omit<RewardEntry, 'id' | 'created_at'>) => {
  try {
    const rewardEntry = {
      ...entry,
      created_at: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, 'rewards'), rewardEntry);
    return { id: docRef.id, error: null };
  } catch (error: any) {
    return { id: null, error: error.message };
  }
};

export const getRewardEntries = async (userId: string, limitCount: number = 100): Promise<RewardEntry[]> => {
  try {
    // Use proper orderBy with limit for better performance
    const q = query(
      collection(db, 'rewards'),
      where('user_id', '==', userId),
      orderBy('created_at', 'desc'),
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    } as RewardEntry));
  } catch (error: any) {
    // If orderBy fails due to missing index, fallback to client-side sorting
    if (error.code === 'failed-precondition') {
      console.log('Firestore index missing for rewards, using fallback query');
      try {
        const fallbackQuery = query(
          collection(db, 'rewards'),
          where('user_id', '==', userId)
        );
        const querySnapshot = await getDocs(fallbackQuery);
        const entries: RewardEntry[] = [];
        
        querySnapshot.forEach((doc) => {
          entries.push({ id: doc.id, ...doc.data() } as RewardEntry);
        });
        
        return entries
          .sort((a, b) => b.created_at.seconds - a.created_at.seconds)
          .slice(0, limitCount);
      } catch (fallbackError: any) {
        console.error('Fallback query also failed:', fallbackError);
        throw fallbackError;
      }
    }
    
    // Handle other specific errors
    if (error.code === 'not-found' || error.code === 'permission-denied') {
      console.log('Rewards collection issue, returning empty array');
      return [];
    }
    
    console.error('Error getting reward entries:', error);
    throw error; // Re-throw for proper error handling upstream
  }
};

export const getUserTotalPoints = async (userId: string): Promise<number> => {
  try {
    const entries = await getRewardEntries(userId);
    return entries.reduce((total, entry) => total + entry.points, 0);
  } catch (error) {
    console.error('Error calculating total points:', error);
    return 0;
  }
};

// Initialize collections helper (creates sample data if collections are empty)
export const initializeCollections = async () => {
  try {
    const user = getCurrentUser();
    if (!user) {
      console.log('User not authenticated, skipping collection initialization');
      return;
    }
    
    // Create initial documents to establish collections if they don't exist
    try {
      // Try to create a rewards collection with a placeholder doc
      await addDoc(collection(db, 'rewards'), {
        user_id: '__placeholder__',
        points: 0,
        reason: 'Collection initialization',
        created_at: Timestamp.now()
      });
      console.log('Rewards collection initialized');
    } catch (error) {
      // Collection might already exist, ignore error
    }
    
    try {
      // Try to create a wellness_entries collection with a placeholder doc
      await addDoc(collection(db, 'wellness_entries'), {
        user_id: '__placeholder__',
        mood: 5,
        stress_level: 5,
        sleep_hours: 8,
        exercise_minutes: 0,
        notes: 'Collection initialization',
        created_at: Timestamp.now()
      });
      console.log('Wellness entries collection initialized');
    } catch (error) {
      // Collection might already exist, ignore error
    }
    
    console.log('Collections initialization complete');
  } catch (error) {
    console.error('Error initializing collections:', error);
  }
};

// Family functions
export const createFamily = async (familyName: string, parentId: string): Promise<{ familyId?: string; inviteCode?: string; error?: string }> => {
  try {
    const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    
    const family: Omit<Family, 'id'> = {
      name: familyName,
      inviteCode,
      parentIds: [parentId],
      studentIds: [],
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, 'families'), family);
    
    // Update the parent's profile with the family ID
    await updateUserProfile(parentId, { family_id: docRef.id });
    
    return { familyId: docRef.id, inviteCode };
  } catch (error: any) {
    console.error('Error creating family:', error);
    return { error: error.message };
  }
};

export const joinFamily = async (inviteCode: string, studentId: string): Promise<{ familyId?: string; error?: string }> => {
  try {
    // Find family by invite code
    const q = query(collection(db, 'families'), where('inviteCode', '==', inviteCode));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return { error: 'Invalid invite code' };
    }
    
    const familyDoc = querySnapshot.docs[0];
    const familyData = familyDoc.data() as Family;
    
    // Check if student is already in the family
    if (familyData.studentIds.includes(studentId)) {
      return { error: 'Student is already a member of this family' };
    }
    
    // Add student to family
    const updatedStudentIds = [...familyData.studentIds, studentId];
    await setDoc(doc(db, 'families', familyDoc.id), {
      studentIds: updatedStudentIds,
      updated_at: Timestamp.now()
    }, { merge: true });
    
    // Update the student's profile with the family ID
    await updateUserProfile(studentId, { family_id: familyDoc.id });
    
    return { familyId: familyDoc.id };
  } catch (error: any) {
    console.error('Error joining family:', error);
    return { error: error.message };
  }
};

export const getFamily = async (familyId: string): Promise<Family | null> => {
  try {
    const docRef = doc(db, 'families', familyId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Family;
    }
    return null;
  } catch (error) {
    console.error('Error getting family:', error);
    return null;
  }
};

export const getFamilyMembers = async (familyId: string): Promise<{ parents: UserProfile[]; students: UserProfile[] }> => {
  try {
    const family = await getFamily(familyId);
    if (!family) {
      return { parents: [], students: [] };
    }
    
    const parents: UserProfile[] = [];
    const students: UserProfile[] = [];
    
    // Get parent profiles with error handling
    for (const parentId of family.parentIds) {
      try {
        const profile = await getUserProfile(parentId);
        if (profile) {
          parents.push(profile);
        }
      } catch (error) {
        console.log(`Could not load parent profile for ${parentId}`);
      }
    }
    
    // Get student profiles with error handling
    for (const studentId of family.studentIds) {
      try {
        const profile = await getUserProfile(studentId);
        if (profile) {
          students.push(profile);
        }
      } catch (error) {
        console.log(`Could not load student profile for ${studentId}`);
      }
    }
    
    return { parents, students };
  } catch (error) {
    console.error('Error getting family members:', error);
    return { parents: [], students: [] };
  }
};

export interface Message {
  id: string;
  from_user_id: string;
  to_user_id: string;
  from_name: string;
  to_name: string;
  message_type: 'message' | 'voice' | 'care_package' | 'video_call' | 'boost';
  content: string;
  boost_amount?: number;
  family_id: string;
  read: boolean;
  created_at: Timestamp;
}

// Message functions
export const sendMessage = async (messageData: Omit<Message, 'id' | 'created_at'>): Promise<{ success: boolean; error?: string; messageId?: string }> => {
  try {
    const message = {
      ...messageData,
      created_at: Timestamp.now(),
    };
    
    const docRef = await addDoc(collection(db, 'messages'), message);
    console.log('✅ Message sent successfully:', docRef.id);
    return { success: true, messageId: docRef.id };
  } catch (error: any) {
    console.error('❌ Error sending message:', error);
    return { success: false, error: error.message };
  }
};

export const getMessagesForUser = async (userId: string, limitCount: number = 50): Promise<Message[]> => {
  try {
    // Use proper orderBy with limit for better performance
    const q = query(
      collection(db, 'messages'),
      where('to_user_id', '==', userId),
      orderBy('created_at', 'desc'),
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    } as Message));
  } catch (error: any) {
    // If orderBy fails due to missing index, fallback to client-side sorting
    if (error.code === 'failed-precondition') {
      console.log('Firestore index missing for messages, using fallback query');
      try {
        const fallbackQuery = query(
          collection(db, 'messages'),
          where('to_user_id', '==', userId)
        );
        const querySnapshot = await getDocs(fallbackQuery);
        const messages: Message[] = [];
        
        querySnapshot.forEach((doc) => {
          messages.push({ id: doc.id, ...doc.data() } as Message);
        });
        
        return messages
          .sort((a, b) => b.created_at.seconds - a.created_at.seconds)
          .slice(0, limitCount);
      } catch (fallbackError: any) {
        console.error('Fallback query also failed:', fallbackError);
        throw fallbackError;
      }
    }
    
    console.error('Error getting messages:', error);
    throw error; // Re-throw for proper error handling upstream
  }
};

export const markMessageAsRead = async (messageId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    await setDoc(doc(db, 'messages', messageId), {
      read: true
    }, { merge: true });
    return { success: true };
  } catch (error: any) {
    console.error('Error marking message as read:', error);
    return { success: false, error: error.message };
  }
};