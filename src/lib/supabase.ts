// Firebase adapter to maintain compatibility with existing Supabase API calls
import { 
  signUpUser, 
  signInUser, 
  signOutUser, 
  getCurrentUser, 
  onAuthStateChange, 
  getUserProfile,
  auth
} from './firebase';
import { User } from 'firebase/auth';

interface SupabaseUser {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    user_type?: 'student' | 'parent';
  };
}

interface SupabaseSession {
  user: SupabaseUser;
  access_token: string;
  refresh_token: string;
}

class FirebaseSupabaseAdapter {
  private listeners: Array<(event: string, session: SupabaseSession | null) => void> = [];

  auth = {
    signUp: async ({ email, password, options }: any) => {
      const { user, error } = await signUpUser(
        email, 
        password, 
        options?.data?.full_name || '', 
        options?.data?.user_type || 'student'
      );
      
      if (error) {
        return { data: { user: null, session: null }, error };
      }

      const supabaseUser: SupabaseUser = {
        id: user!.uid,
        email: user!.email!,
        user_metadata: {
          full_name: options?.data?.full_name,
          user_type: options?.data?.user_type,
        },
      };

      const session: SupabaseSession = {
        user: supabaseUser,
        access_token: 'firebase-token',
        refresh_token: 'firebase-refresh',
      };

      this.notifyListeners('SIGNED_UP', session);
      return { data: { user: supabaseUser, session }, error: null };
    },

    signInWithPassword: async ({ email, password }: any) => {
      const { user, error } = await signInUser(email, password);
      
      if (error) {
        return { data: { user: null, session: null }, error };
      }

      // Get user profile from Firestore
      const profile = await getUserProfile(user!.uid);

      const supabaseUser: SupabaseUser = {
        id: user!.uid,
        email: user!.email!,
        user_metadata: {
          full_name: profile?.full_name || user!.displayName || '',
          user_type: profile?.user_type || 'student',
        },
      };

      const session: SupabaseSession = {
        user: supabaseUser,
        access_token: 'firebase-token',
        refresh_token: 'firebase-refresh',
      };

      this.notifyListeners('SIGNED_IN', session);
      return { data: { user: supabaseUser, session }, error: null };
    },

    signOut: async () => {
      const { error } = await signOutUser();
      if (!error) {
        this.notifyListeners('SIGNED_OUT', null);
      }
      return { error };
    },

    getSession: async () => {
      const user = getCurrentUser();
      if (user) {
        const profile = await getUserProfile(user.uid);
        
        const supabaseUser: SupabaseUser = {
          id: user.uid,
          email: user.email!,
          user_metadata: {
            full_name: profile?.full_name || user.displayName || '',
            user_type: profile?.user_type || 'student',
          },
        };

        const session: SupabaseSession = {
          user: supabaseUser,
          access_token: 'firebase-token',
          refresh_token: 'firebase-refresh',
        };

        return { data: { session }, error: null };
      }
      return { data: { session: null }, error: null };
    },

    onAuthStateChange: (callback: (event: string, session: SupabaseSession | null) => void) => {
      this.listeners.push(callback);
      
      const unsubscribe = onAuthStateChange(async (user: User | null) => {
        if (user) {
          const profile = await getUserProfile(user.uid);
          
          const supabaseUser: SupabaseUser = {
            id: user.uid,
            email: user.email!,
            user_metadata: {
              full_name: profile?.full_name || user.displayName || '',
              user_type: profile?.user_type || 'student',
            },
          };

          const session: SupabaseSession = {
            user: supabaseUser,
            access_token: 'firebase-token',
            refresh_token: 'firebase-refresh',
          };

          callback('SIGNED_IN', session);
        } else {
          callback('SIGNED_OUT', null);
        }
      });

      return {
        data: { subscription: { unsubscribe } }
      };
    },
  };

  from = (table: string) => ({
    select: (columns: string) => ({
      eq: (column: string, value: any) => ({
        single: async () => {
          // Handle profile queries
          if (table === 'profiles' && column === 'id') {
            const profile = await getUserProfile(value);
            if (profile) {
              return {
                data: { user_type: profile.user_type },
                error: null
              };
            }
          }
          return { data: null, error: null };
        }
      })
    })
  });

  private notifyListeners(event: string, session: SupabaseSession | null) {
    this.listeners.forEach(listener => listener(event, session));
  }
}

export const supabase = new FirebaseSupabaseAdapter() as any; 