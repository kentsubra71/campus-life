import { create } from 'zustand';
import { 
  signUpUser, 
  signInUser, 
  signOutUser, 
  onAuthStateChange, 
  getUserProfile,
  updateUserProfile,
  createFamily as createFamilyFirebase,
  joinFamily as joinFamilyFirebase,
  getFamily,
  getFamilyMembers as getFamilyMembersFirebase,
  initializeCollections,
  UserProfile,
  Family as FirebaseFamily
} from '../lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { cache, CACHE_CONFIGS } from '../utils/universalCache';
import { pushNotificationService } from '../services/pushNotificationService';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'parent' | 'student';
  familyId: string;
  createdAt: Date;
  paypal_me_handle?: string;
}

interface Family {
  id: string;
  name: string;
  inviteCode: string;
  parentIds: string[];
  studentIds: string[];
  createdAt: Date;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  family: Family | null;
  familyMembers: { parents: User[]; students: User[] } | null;
  isLoading: boolean;
  isRegistering: boolean;
  
  // Auth actions
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string; inviteCode?: string }>;
  logout: () => void;
  initialize: () => void; // ADDED: Initialize auth state listener
  
  // Family actions
  createFamily: (parentData: ParentRegisterData) => Promise<{ success: boolean; inviteCode?: string; error?: string }>;
  joinFamily: (studentData: StudentRegisterData, inviteCode: string) => Promise<{ success: boolean; error?: string }>;
  getFamilyMembers: () => Promise<{ parents: User[]; students: User[] }>;
  
  // Profile actions
  updateProfile: (updates: Partial<User>) => Promise<boolean>;
  refreshToken: () => Promise<void>; // ADDED: Force token refresh
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  role: 'parent' | 'student';
}

interface ParentRegisterData extends RegisterData {
  familyName: string;
}

interface StudentRegisterData extends RegisterData {
  inviteCode: string;
  paypal_me_handle?: string;
}

const generateInviteCode = () => Math.random().toString(36).substring(2, 10).toUpperCase();

export const useAuthStore = create<AuthState>((set, get) => ({
    isAuthenticated: false,
    user: null,
    family: null,
    familyMembers: null,
    isLoading: false,
    isRegistering: false,
  
  login: async (email: string, password: string) => {
    set({ isLoading: true });
    
    try {
      const { user: firebaseUser, error } = await signInUser(email, password);
      
      if (error || !firebaseUser) {
        set({ isLoading: false });
        return { success: false, error: error || 'Login failed' };
      }
      
      // Get user profile from Firestore
      const profile = await getUserProfile(firebaseUser.uid);
      
      if (!profile) {
        set({ isLoading: false });
        return { success: false, error: 'User profile not found' };
      }
      
      let family: Family | null = null;
      if (profile.family_id) {
        const familyData = await getFamily(profile.family_id);
        if (familyData) {
          family = {
            id: familyData.id,
            name: familyData.name,
            inviteCode: familyData.inviteCode,
            parentIds: familyData.parentIds,
            studentIds: familyData.studentIds,
            createdAt: familyData.created_at.toDate(),
          };
        }
      }
      
      const user: User = {
        id: profile.id,
        email: profile.email,
        name: profile.full_name,
        role: profile.user_type,
        familyId: profile.family_id || '',
        createdAt: profile.created_at.toDate(),
      };
      
      set({ 
        isAuthenticated: true, 
        user, 
        family,
        isLoading: false 
      });
      
      // Initialize collections after successful login
      initializeCollections().catch(console.error);
      
      // Preload cache for better performance
      const { CachePreloader } = await import('../utils/cachePreloader');
      CachePreloader.preloadUserData(user.id).catch(console.error);
      
      if (user.role === 'student') {
        CachePreloader.preloadStudentData(user.id).catch(console.error);
      } else if (user.role === 'parent') {
        CachePreloader.preloadParentData(user.id).catch(console.error);
      }
      
      // Initialize push notifications for the user
      pushNotificationService.initialize(user.id).then(async () => {
        try {
          // Schedule wellness reminders for students
          if (user.role === 'student') {
            await pushNotificationService.scheduleDailyWellnessReminder(user.id);
          }
          
          // Schedule daily and weekly summaries for all users
          await pushNotificationService.scheduleDailySummary(user.id);
          await pushNotificationService.scheduleWeeklySummary(user.id);
          
          console.log('✅ All notification schedules initialized');
        } catch (error) {
          console.warn('Failed to schedule notifications:', error);
        }
      }).catch(error => {
        console.warn('Failed to initialize push notifications:', error);
      });
      
      return { success: true };
      
    } catch (error: any) {
      set({ isLoading: false });
      return { success: false, error: error.message || 'Login failed. Please try again.' };
    }
  },
  
  register: async (data: RegisterData) => {
    set({ isLoading: true });
    
    try {
      const { user: firebaseUser, error } = await signUpUser(
        data.email,
        data.password,
        data.name,
        data.role
      );
      
      if (error || !firebaseUser) {
        set({ isLoading: false });
        return { success: false, error: error || 'Registration failed' };
      }
      
      // Get the created profile
      const profile = await getUserProfile(firebaseUser.uid);
      
      if (!profile) {
        set({ isLoading: false });
        return { success: false, error: 'Failed to create user profile' };
      }
      
      let family: Family | null = null;
      if (profile.family_id) {
        const familyData = await getFamily(profile.family_id);
        if (familyData) {
          family = {
            id: familyData.id,
            name: familyData.name,
            inviteCode: familyData.inviteCode,
            parentIds: familyData.parentIds,
            studentIds: familyData.studentIds,
            createdAt: familyData.created_at.toDate(),
          };
        }
      }
      
      const user: User = {
        id: profile.id,
        email: profile.email,
        name: profile.full_name,
        role: profile.user_type,
        familyId: profile.family_id || '',
        createdAt: profile.created_at.toDate(),
      };
      
      set({ 
        isAuthenticated: true, 
        user, 
        family,
        isLoading: false 
      });
      
      // Initialize collections after successful registration
      initializeCollections().catch(console.error);
      
      // Preload cache for better performance
      const { CachePreloader } = await import('../utils/cachePreloader');
      CachePreloader.preloadUserData(user.id).catch(console.error);
      
      if (user.role === 'student') {
        CachePreloader.preloadStudentData(user.id).catch(console.error);
      } else if (user.role === 'parent') {
        CachePreloader.preloadParentData(user.id).catch(console.error);
      }
      
      // Initialize push notifications for the user
      pushNotificationService.initialize(user.id).then(async () => {
        try {
          // Schedule wellness reminders for students
          if (user.role === 'student') {
            await pushNotificationService.scheduleDailyWellnessReminder(user.id);
          }
          
          // Schedule daily and weekly summaries for all users
          await pushNotificationService.scheduleDailySummary(user.id);
          await pushNotificationService.scheduleWeeklySummary(user.id);
          
          console.log('✅ All notification schedules initialized');
        } catch (error) {
          console.warn('Failed to schedule notifications:', error);
        }
      }).catch(error => {
        console.warn('Failed to initialize push notifications:', error);
      });
      
      return { success: true };
      
    } catch (error: any) {
      set({ isLoading: false });
      return { success: false, error: error.message || 'Registration failed. Please try again.' };
    }
  },
  
  createFamily: async (parentData: ParentRegisterData) => {
    set({ isLoading: true, isRegistering: true });
    console.log('🔥 CREATE FAMILY FUNCTION CALLED - Firebase implementation active');
    
    try {
      // First register the parent (without sending verification email yet)
      const { user: firebaseUser, error } = await signUpUser(
        parentData.email,
        parentData.password,
        parentData.name,
        parentData.role,
        false // Don't send verification email yet
      );
      
      if (error || !firebaseUser) {
        set({ isLoading: false });
        return { success: false, error: error || 'Registration failed' };
      }
      
      // Create the family
      const { familyId, inviteCode, error: familyError } = await createFamilyFirebase(
        parentData.familyName,
        firebaseUser.uid
      );
      
      if (familyError || !familyId) {
        // Cleanup: Delete the Firebase Auth user since registration failed
        try {
          await firebaseUser.delete();
          console.log('🧹 Cleaned up Firebase Auth user after family creation failure');
        } catch (cleanupError) {
          console.error('Failed to cleanup Firebase Auth user:', cleanupError);
        }

        set({ isLoading: false });
        return { success: false, error: familyError || 'Failed to create family' };
      }
      
      // Now that all steps succeeded, send verification and welcome emails
      const { sendUserVerificationEmail } = await import('../lib/firebase');
      const { sendWelcomeEmail } = await import('../lib/emailInvitation');
      
      await sendUserVerificationEmail(firebaseUser.uid, parentData.email, parentData.name);
      await sendWelcomeEmail(parentData.email, parentData.name, 'parent', parentData.familyName, inviteCode);
      
      // Get the updated profile with family ID
      const profile = await getUserProfile(firebaseUser.uid);
      if (!profile) {
        set({ isLoading: false });
        return { success: false, error: 'Failed to get user profile' };
      }
      
      // Get the family data
      const familyData = await getFamily(familyId);
      if (!familyData) {
        set({ isLoading: false });
        return { success: false, error: 'Failed to get family data' };
      }
      
      const user: User = {
        id: profile.id,
        email: profile.email,
        name: profile.full_name,
        role: profile.user_type,
        familyId: familyId,
        createdAt: profile.created_at.toDate(),
      };
      
      const family: Family = {
        id: familyData.id,
        name: familyData.name,
        inviteCode: familyData.inviteCode,
        parentIds: familyData.parentIds,
        studentIds: familyData.studentIds,
        createdAt: familyData.created_at.toDate(),
      };
      
      set({
        isAuthenticated: true,
        user,
        family,
        isLoading: false,
        isRegistering: false
      });

      // Initialize push notifications for the user
      pushNotificationService.initialize(user.id).then(async () => {
        try {
          // Schedule wellness reminders for students
          if (user.role === 'student') {
            await pushNotificationService.scheduleDailyWellnessReminder(user.id);
          }
          
          // Schedule daily and weekly summaries for all users
          await pushNotificationService.scheduleDailySummary(user.id);
          await pushNotificationService.scheduleWeeklySummary(user.id);
          
          console.log('✅ All notification schedules initialized');
        } catch (error) {
          console.warn('Failed to schedule notifications:', error);
        }
      }).catch(error => {
        console.warn('Failed to initialize push notifications:', error);
      });
      
      return { success: true, inviteCode };
      
    } catch (error: any) {
      set({ isLoading: false, isRegistering: false });
      return { success: false, error: error.message || 'Failed to create family' };
    }
  },
  
  joinFamily: async (studentData: StudentRegisterData, inviteCode: string) => {
    set({ isLoading: true, isRegistering: true });
    console.log('🔥 JOIN FAMILY FUNCTION CALLED - Firebase implementation active');
    
    try {
      // First register the student (without sending verification email yet)
      const { user: firebaseUser, error } = await signUpUser(
        studentData.email,
        studentData.password,
        studentData.name,
        studentData.role,
        false // Don't send verification email yet
      );
      
      if (error || !firebaseUser) {
        set({ isLoading: false });
        return { success: false, error: error || 'Registration failed' };
      }
      
      // Join the family
      const { familyId, error: familyError } = await joinFamilyFirebase(
        inviteCode,
        firebaseUser.uid
      );
      
      if (familyError || !familyId) {
        // Cleanup: Delete the Firebase Auth user since registration failed
        try {
          await firebaseUser.delete();
          console.log('🧹 Cleaned up Firebase Auth user after family join failure');
        } catch (cleanupError) {
          console.error('Failed to cleanup Firebase Auth user:', cleanupError);
        }

        set({ isLoading: false });
        return { success: false, error: familyError || 'Failed to join family' };
      }
      
      // Now that all steps succeeded, send verification and welcome emails
      const { sendUserVerificationEmail } = await import('../lib/firebase');
      const { sendWelcomeEmail } = await import('../lib/emailInvitation');
      
      await sendUserVerificationEmail(firebaseUser.uid, studentData.email, studentData.name);

      // Get the updated profile with family ID
      const profile = await getUserProfile(firebaseUser.uid);
      if (!profile) {
        set({ isLoading: false });
        return { success: false, error: 'Failed to get user profile' };
      }

      // Update the user profile with PayPal handle if provided
      if (studentData.paypal_me_handle) {
        await updateUserProfile(firebaseUser.uid, {
          paypal_me_handle: studentData.paypal_me_handle
        });
        console.log('✅ PayPal handle saved:', studentData.paypal_me_handle);
      }

      // Get the family data
      const familyData = await getFamily(familyId);
      if (!familyData) {
        set({ isLoading: false });
        return { success: false, error: 'Failed to get family data' };
      }
      
      // Send welcome email with family name
      await sendWelcomeEmail(studentData.email, studentData.name, 'student', familyData.name);

      const user: User = {
        id: profile.id,
        email: profile.email,
        name: profile.full_name,
        role: profile.user_type,
        familyId: familyId,
        createdAt: profile.created_at.toDate(),
        paypal_me_handle: studentData.paypal_me_handle,
      };

      const family: Family = {
        id: familyData.id,
        name: familyData.name,
        inviteCode: familyData.inviteCode,
        parentIds: familyData.parentIds,
        studentIds: familyData.studentIds,
        createdAt: familyData.created_at.toDate(),
      };

      // Set user data but keep loading true until all setup is complete
      set({
        isAuthenticated: true,
        user,
        family,
        isLoading: true
      });

      // Initialize push notifications and complete setup
      try {
        await pushNotificationService.initialize(user.id);

        // Schedule wellness reminders for students
        if (user.role === 'student') {
          await pushNotificationService.scheduleDailyWellnessReminder(user.id);
        }

        // Schedule daily and weekly summaries for all users
        await pushNotificationService.scheduleDailySummary(user.id);
        await pushNotificationService.scheduleWeeklySummary(user.id);

        console.log('✅ All notification schedules initialized for student');

        // Add a small delay to ensure everything is fully ready
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Now set loading to false - everything is truly ready
        set({ isLoading: false, isRegistering: false });
        console.log('✅ Complete student initialization finished');

      } catch (error) {
        console.warn('Failed to complete student notification setup:', error);
        // Still set loading to false even if notifications fail
        set({ isLoading: false, isRegistering: false });
      }
      
      return { success: true };
      
    } catch (error: any) {
      set({ isLoading: false, isRegistering: false });
      return { success: false, error: error.message || 'Failed to join family' };
    }
  },
  
  getFamilyMembers: async (): Promise<{ parents: User[]; students: User[] }> => {
    const { user } = get();
    if (!user || !user.familyId) {
      return { parents: [], students: [] };
    }
    
    // Try cache first
    const cached = await cache.get(CACHE_CONFIGS.FAMILY_MEMBERS, user.id);
    if (cached) {
      console.log('📦 Using cached family members');
      return cached as { parents: User[]; students: User[] };
    }
    
    try {
      console.log('🔄 Loading fresh family members...');
      const { parents: parentProfiles, students: studentProfiles } = await getFamilyMembersFirebase(user.familyId);
      
      const parents: User[] = parentProfiles.map(profile => ({
        id: profile.id,
        email: profile.email,
        name: profile.full_name || profile.email.split('@')[0],
        role: profile.user_type,
        familyId: profile.family_id || '',
        createdAt: profile.created_at.toDate(),
        paypal_me_handle: profile.paypal_me_handle,
      }));

      const students: User[] = studentProfiles.map(profile => ({
        id: profile.id,
        email: profile.email,
        name: profile.full_name || profile.email.split('@')[0],
        role: profile.user_type,
        familyId: profile.family_id || '',
        createdAt: profile.created_at.toDate(),
        paypal_me_handle: profile.paypal_me_handle,
      }));
      
      const result = { parents, students };
      
      // Cache the result
      await cache.set(CACHE_CONFIGS.FAMILY_MEMBERS, result, user.id);
      console.log('💾 Cached family members');
      
      return result;
    } catch (error) {
      console.error('Error getting family members:', error);
      return { parents: [], students: [] };
    }
  },
  
  updateProfile: async (updates: Partial<User>) => {
    const { user } = get();
    if (!user) return false;
    
    try {
      const profileUpdates: Partial<UserProfile> = {};
      if (updates.name) profileUpdates.full_name = updates.name;
      if (updates.role) profileUpdates.user_type = updates.role;
      
      const { error } = await updateUserProfile(user.id, profileUpdates);
      if (error) return false;
      
      const updatedUser = { ...user, ...updates };
      set({ user: updatedUser });
      return true;
    } catch {
      return false;
    }
  },
  
  logout: async () => {
    const { user } = get();
    
    // Clear user caches before logout
    if (user) {
      try {
        await cache.clearUserCaches(user.id);
        console.log('🗑️ Cleared user caches on logout');
      } catch (error) {
        console.error('Error clearing user caches on logout:', error);
      }
    }
    
    // Cancel scheduled notifications
    try {
      await pushNotificationService.cancelScheduledNotifications();
    } catch (error) {
      console.error('Error cancelling notifications on logout:', error);
    }
    
    await signOutUser();
    set({ 
      isAuthenticated: false, 
      user: null, 
      family: null,
      isLoading: false 
    });
  },

  // ADDED: Initialize auth state listener
  initialize: () => {
    console.log('🔄 Initializing auth state listener...');

    // Only set loading if we don't already have user data from registration
    const currentState = get();
    if (!currentState.isAuthenticated) {
      set({ isLoading: true });
    }

    onAuthStateChange(async (firebaseUser: FirebaseUser | null) => {
      console.log('🔐 Auth state changed:', firebaseUser ? 'authenticated' : 'not authenticated');

      if (firebaseUser) {
        // Check if we're in the middle of registration process
        const currentState = get();
        if (currentState.isRegistering) {
          console.log('🔄 Registration in progress, skipping auth state listener');
          return;
        }

        // Check if user is already fully set up from registration
        if (currentState.isAuthenticated && currentState.user && currentState.user.id === firebaseUser.uid) {
          console.log('✅ User already initialized from registration, skipping duplicate setup');
          return;
        }

        try {
          // Force refresh token to get latest custom claims
          await firebaseUser.getIdToken(true);
          
          // Get user profile from Firestore
          const profile = await getUserProfile(firebaseUser.uid);
          
          // CRITICAL: Validate and set custom claims if needed
          if (profile && profile.family_id) {
            const token = await firebaseUser.getIdTokenResult();
            const claims = token.claims;
            
            // Check if custom claims are missing or outdated
            if (!claims.family_id || claims.family_id !== profile.family_id || 
                !claims.user_type || claims.user_type !== profile.user_type) {
              
              console.log('🔧 Custom claims missing or outdated, setting them...', {
                profileFamilyId: profile.family_id,
                claimsFamilyId: claims.family_id,
                profileUserType: profile.user_type,
                claimsUserType: claims.user_type
              });
              
              try {
                const { httpsCallable } = await import('firebase/functions');
                const { functions } = await import('../lib/firebase');
                
                const setFamilyClaimsFunction = httpsCallable(functions, 'setFamilyClaims');
                await setFamilyClaimsFunction({
                  userId: firebaseUser.uid,
                  familyId: profile.family_id,
                  userType: profile.user_type
                });
                
                // Force token refresh to get updated claims
                await firebaseUser.getIdToken(true);
                
                // Wait a moment for claims to propagate
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Verify claims are properly set
                const verifyToken = await firebaseUser.getIdTokenResult(true);
                console.log('✅ Custom claims updated successfully', {
                  family_id: verifyToken.claims.family_id,
                  user_type: verifyToken.claims.user_type
                });
              } catch (claimsError: any) {
                console.error('❌ Failed to set custom claims:', claimsError.message);
              }
            }
          }
          
          if (profile) {
            // Get family data if user has family ID
            let familyData = null;
            if (profile.family_id) {
              try {
                familyData = await getFamily(profile.family_id);
              } catch (error) {
                console.warn('Could not load family data:', error);
              }
            }
            
            const user: User = {
              id: profile.id,
              email: profile.email,
              name: profile.full_name,
              role: profile.user_type,
              familyId: profile.family_id || '',
              createdAt: profile.created_at.toDate(),
            };
            
            const family: Family | null = familyData ? {
              id: familyData.id,
              name: familyData.name,
              inviteCode: familyData.inviteCode,
              parentIds: familyData.parentIds,
              studentIds: familyData.studentIds,
              createdAt: familyData.created_at.toDate(),
            } : null;
            
            // Set user data but keep loading true until all setup is complete
            set({
              isAuthenticated: true,
              user,
              family,
              isLoading: true
            });

            // Initialize push notifications and complete setup
            try {
              await pushNotificationService.initialize(user.id);

              if (user.role === 'student') {
                await pushNotificationService.scheduleDailyWellnessReminder(user.id);
              }
              await pushNotificationService.scheduleDailySummary(user.id);
              await pushNotificationService.scheduleWeeklySummary(user.id);
              console.log('✅ All notification schedules initialized');

              // Add a small delay to ensure everything is fully ready
              await new Promise(resolve => setTimeout(resolve, 1000));

              // Now set loading to false - everything is truly ready
              set({ isLoading: false });
              console.log('✅ Complete app initialization finished');

            } catch (error) {
              console.warn('Failed to complete notification setup:', error);
              // Still set loading to false even if notifications fail
              set({ isLoading: false });
            }
            
            console.log('✅ User authenticated and profile loaded');
          } else {
            console.log('⏱️ Waiting for onUserCreated to complete initialization...');
            // During registration, profile might not exist yet - wait for server-side creation
            // Don't clear auth state, just log the situation
          }
        } catch (error) {
          console.error('❌ Error loading user profile:', error);
          set({ isAuthenticated: false, user: null, family: null, isLoading: false });
        }
      } else {
        // User not authenticated
        set({ isAuthenticated: false, user: null, family: null, isLoading: false });
      }
    });
  },

  // ADDED: Force token refresh to get updated custom claims
  refreshToken: async () => {
    const { httpsCallable } = await import('firebase/functions');
    const { functions } = await import('../lib/firebase');
    
    try {
      // Call the refresh token function (just triggers client refresh)
      const refreshTokenFunction = httpsCallable(functions, 'refreshToken');
      await refreshTokenFunction({});
      
      // Force refresh the ID token
      const { auth } = await import('../lib/firebase');
      const user = auth.currentUser;
      if (user) {
        await user.getIdToken(true);
        console.log('✅ Token refreshed successfully');
      }
    } catch (error) {
      console.warn('Failed to refresh token:', error);
    }
  },
})); 