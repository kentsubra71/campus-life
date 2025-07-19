// Mock Supabase client for development
// This will be replaced with real Supabase once we resolve the bundling issues

interface MockUser {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    user_type?: 'student' | 'parent';
  };
}

interface MockSession {
  user: MockUser;
  access_token: string;
  refresh_token: string;
}

class MockSupabaseClient {
  private currentUser: MockUser | null = null;
  private listeners: Array<(event: string, session: MockSession | null) => void> = [];

  auth = {
    signUp: async ({ email, password, options }: any) => {
      // Simulate successful registration
      const user: MockUser = {
        id: `mock-${Date.now()}`,
        email,
        user_metadata: options?.data || {},
      };
      
      this.currentUser = user;
      this.notifyListeners('SIGNED_UP', { user, access_token: 'mock-token', refresh_token: 'mock-refresh' });
      
      return { data: { user, session: { user, access_token: 'mock-token', refresh_token: 'mock-refresh' } }, error: null };
    },

    signInWithPassword: async ({ email, password }: any) => {
      // Simulate successful login
      const user: MockUser = {
        id: `mock-${Date.now()}`,
        email,
        user_metadata: { full_name: 'Demo User', user_type: 'student' },
      };
      
      this.currentUser = user;
      this.notifyListeners('SIGNED_IN', { user, access_token: 'mock-token', refresh_token: 'mock-refresh' });
      
      return { data: { user, session: { user, access_token: 'mock-token', refresh_token: 'mock-refresh' } }, error: null };
    },

    signOut: async () => {
      this.currentUser = null;
      this.notifyListeners('SIGNED_OUT', null);
      return { error: null };
    },

    getSession: async () => {
      if (this.currentUser) {
        return { 
          data: { 
            session: { 
              user: this.currentUser, 
              access_token: 'mock-token', 
              refresh_token: 'mock-refresh' 
            } 
          }, 
          error: null 
        };
      }
      return { data: { session: null }, error: null };
    },

    onAuthStateChange: (callback: (event: string, session: MockSession | null) => void) => {
      this.listeners.push(callback);
      return {
        data: { subscription: { unsubscribe: () => {
          const index = this.listeners.indexOf(callback);
          if (index > -1) {
            this.listeners.splice(index, 1);
          }
        }}}
      };
    },
  };

  from = (table: string) => ({
    select: (columns: string) => ({
      eq: (column: string, value: any) => ({
        single: async () => {
          // Mock profile data
          if (table === 'profiles' && column === 'id') {
            return {
              data: { user_type: this.currentUser?.user_metadata?.user_type || 'student' },
              error: null
            };
          }
          return { data: null, error: null };
        }
      })
    })
  });

  private notifyListeners(event: string, session: MockSession | null) {
    this.listeners.forEach(listener => listener(event, session));
  }
}

export const supabase = new MockSupabaseClient() as any; 