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
  isLoading: boolean;
  
  // Auth actions
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string; inviteCode?: string }>;
  logout: () => void;
  
  // Family actions
  createFamily: (parentData: ParentRegisterData) => Promise<{ success: boolean; inviteCode?: string; error?: string }>;
  joinFamily: (studentData: StudentRegisterData, inviteCode: string) => Promise<{ success: boolean; error?: string }>;
  getFamilyMembers: () => Promise<{ parents: User[]; students: User[] }>;
  
  // Profile actions
  updateProfile: (updates: Partial<User>) => Promise<boolean>;
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
}

const generateInviteCode = () => Math.random().toString(36).substring(2, 10).toUpperCase();

export const useAuthStore = create<AuthState>((set, get) => ({
    isAuthenticated: false,
    user: null,
    family: null,
    isLoading: false,
  
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
          console.error('Failed to schedule notifications:', error);
        }
      }).catch(error => {
        console.error('Failed to initialize push notifications:', error);
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
          console.error('Failed to schedule notifications:', error);
        }
      }).catch(error => {
        console.error('Failed to initialize push notifications:', error);
      });
      
      return { success: true };
      
    } catch (error: any) {
      set({ isLoading: false });
      return { success: false, error: error.message || 'Registration failed. Please try again.' };
    }
  },
  
  createFamily: async (parentData: ParentRegisterData) => {
    console.log('🔥 CREATE FAMILY FUNCTION CALLED - Firebase implementation active');
    set({ isLoading: true });
    
    try {
      // First register the parent
      const { user: firebaseUser, error } = await signUpUser(
        parentData.email,
        parentData.password,
        parentData.name,
        parentData.role
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
        set({ isLoading: false });
        return { success: false, error: familyError || 'Failed to create family' };
      }
      
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
        isLoading: false 
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
          console.error('Failed to schedule notifications:', error);
        }
      }).catch(error => {
        console.error('Failed to initialize push notifications:', error);
      });
      
      return { success: true, inviteCode };
      
    } catch (error: any) {
      set({ isLoading: false });
      return { success: false, error: error.message || 'Failed to create family' };
    }
  },
  
  joinFamily: async (studentData: StudentRegisterData, inviteCode: string) => {
    console.log('🔥 JOIN FAMILY FUNCTION CALLED - Firebase implementation active');
    set({ isLoading: true });
    
    try {
      // First register the student
      const { user: firebaseUser, error } = await signUpUser(
        studentData.email,
        studentData.password,
        studentData.name,
        studentData.role
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
        set({ isLoading: false });
        return { success: false, error: familyError || 'Failed to join family' };
      }
      
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
        isLoading: false 
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
          console.error('Failed to schedule notifications:', error);
        }
      }).catch(error => {
        console.error('Failed to initialize push notifications:', error);
      });
      
      return { success: true };
      
    } catch (error: any) {
      set({ isLoading: false });
      return { success: false, error: error.message || 'Failed to join family' };
    }
  },
  
  getFamilyMembers: async () => {
    const { user } = get();
    if (!user || !user.familyId) {
      return { parents: [], students: [] };
    }
    
    // Try cache first
    const cached = await cache.get(CACHE_CONFIGS.FAMILY_MEMBERS, user.id);
    if (cached) {
      console.log('📦 Using cached family members');
      return cached;
    }
    
    try {
      console.log('🔄 Loading fresh family members...');
      const { parents: parentProfiles, students: studentProfiles } = await getFamilyMembersFirebase(user.familyId);
      
      const parents: User[] = parentProfiles.map(profile => ({
        id: profile.id,
        email: profile.email,
        name: profile.full_name,
        role: profile.user_type,
        familyId: profile.family_id || '',
        createdAt: profile.created_at.toDate(),
      }));
      
      const students: User[] = studentProfiles.map(profile => ({
        id: profile.id,
        email: profile.email,
        name: profile.full_name,
        role: profile.user_type,
        familyId: profile.family_id || '',
        createdAt: profile.created_at.toDate(),
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
})); 