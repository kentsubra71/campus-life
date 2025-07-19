import { create } from 'zustand';
import { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  userType: 'student' | 'parent' | null;
  familyId: string | null;
  setUser: (user: User | null) => void;
  setUserType: (type: 'student' | 'parent') => void;
  setFamilyId: (id: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  userType: null,
  familyId: null,
  setUser: (user) => set({ user }),
  setUserType: (userType) => set({ userType }),
  setFamilyId: (familyId) => set({ familyId }),
  logout: () => set({ user: null, userType: null, familyId: null }),
})); 