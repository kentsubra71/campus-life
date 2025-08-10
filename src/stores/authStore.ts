import { create } from 'zustand';

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

// Mock database - in real app this would be Supabase/Firebase
let mockUsers: User[] = [];
let mockFamilies: Family[] = [];

const generateId = () => Math.random().toString(36).substr(2, 9);
const generateInviteCode = () => Math.random().toString(36).substr(2, 8).toUpperCase();

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  user: null,
  family: null,
  isLoading: false,
  
  login: async (email: string, password: string) => {
    set({ isLoading: true });
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Find user in mock database
      const user = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (!user) {
        set({ isLoading: false });
        return { success: false, error: 'No account found with this email' };
      }
      
      // In real app, verify password hash
      // For demo, accept any password
      
      // Find user's family
      const family = mockFamilies.find(f => f.id === user.familyId);
      
      set({ 
        isAuthenticated: true, 
        user, 
        family,
        isLoading: false 
      });
      
      return { success: true };
      
    } catch (error) {
      set({ isLoading: false });
      return { success: false, error: 'Login failed. Please try again.' };
    }
  },
  
  register: async (data: RegisterData) => {
    set({ isLoading: true });
    
    try {
      // Check if user already exists
      const existingUser = mockUsers.find(u => u.email.toLowerCase() === data.email.toLowerCase());
      if (existingUser) {
        set({ isLoading: false });
        return { success: false, error: 'An account with this email already exists' };
      }
      
      if (data.role === 'parent') {
        return await get().createFamily(data as ParentRegisterData);
      } else {
        // Student registration requires invite code
        set({ isLoading: false });
        return { success: false, error: 'Student registration requires an invite code' };
      }
      
    } catch (error) {
      set({ isLoading: false });
      return { success: false, error: 'Registration failed. Please try again.' };
    }
  },
  
  createFamily: async (parentData: ParentRegisterData) => {
    try {
      // Create family
      const familyId = generateId();
      const inviteCode = generateInviteCode();
      const userId = generateId();
      
      const family: Family = {
        id: familyId,
        name: parentData.familyName,
        inviteCode,
        parentIds: [userId],
        studentIds: [],
        createdAt: new Date(),
      };
      
      const user: User = {
        id: userId,
        email: parentData.email,
        name: parentData.name,
        role: 'parent',
        familyId,
        createdAt: new Date(),
      };
      
      // Save to mock database
      mockFamilies.push(family);
      mockUsers.push(user);
      
      set({ 
        isAuthenticated: true, 
        user, 
        family,
        isLoading: false 
      });
      
      return { success: true, inviteCode };
      
    } catch (error) {
      set({ isLoading: false });
      return { success: false, error: 'Failed to create family. Please try again.' };
    }
  },
  
  joinFamily: async (studentData: StudentRegisterData, inviteCode: string) => {
    set({ isLoading: true });
    
    try {
      // Find family by invite code
      const family = mockFamilies.find(f => f.inviteCode === inviteCode.toUpperCase());
      
      if (!family) {
        set({ isLoading: false });
        return { success: false, error: 'Invalid invite code. Please check and try again.' };
      }
      
      // Check if user already exists
      const existingUser = mockUsers.find(u => u.email.toLowerCase() === studentData.email.toLowerCase());
      if (existingUser) {
        set({ isLoading: false });
        return { success: false, error: 'An account with this email already exists' };
      }
      
      const userId = generateId();
      const user: User = {
        id: userId,
        email: studentData.email,
        name: studentData.name,
        role: 'student',
        familyId: family.id,
        createdAt: new Date(),
      };
      
      // Add student to family and database
      family.studentIds.push(userId);
      mockUsers.push(user);
      
      set({ 
        isAuthenticated: true, 
        user, 
        family,
        isLoading: false 
      });
      
      return { success: true };
      
    } catch (error) {
      set({ isLoading: false });
      return { success: false, error: 'Failed to join family. Please try again.' };
    }
  },
  
  getFamilyMembers: async () => {
    const { family } = get();
    if (!family) return { parents: [], students: [] };
    
    const parents = mockUsers.filter(u => family.parentIds.includes(u.id));
    const students = mockUsers.filter(u => family.studentIds.includes(u.id));
    
    return { parents, students };
  },
  
  updateProfile: async (updates: Partial<User>) => {
    const { user } = get();
    if (!user) return false;
    
    try {
      const updatedUser = { ...user, ...updates };
      const userIndex = mockUsers.findIndex(u => u.id === user.id);
      if (userIndex !== -1) {
        mockUsers[userIndex] = updatedUser;
        set({ user: updatedUser });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
  
  logout: () => {
    set({ 
      isAuthenticated: false, 
      user: null, 
      family: null,
      isLoading: false 
    });
  },
})); 