import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { 
  addRewardEntry, 
  getRewardEntries, 
  getUserTotalPoints, 
  getCurrentUser,
  getMessagesForUser,
  getMessagesSentByUser 
} from '../lib/firebase';

interface SupportMessage {
  id: string;
  type: 'message' | 'voice' | 'boost';
  content: string;
  from: string; // User ID of sender
  to: string; // User ID of recipient 
  familyId: string;
  timestamp: Date;
  read: boolean;
}

interface Reward {
  id: string;
  title: string;
  description: string;
  amount: number;
  progress: number;
  maxProgress: number;
  type: 'automatic' | 'manual' | 'challenge';
  category: 'sleep' | 'meals' | 'exercise' | 'wellness' | 'streak';
  isSurprise?: boolean;
}

interface SupportRequest {
  id: string;
  timestamp: Date;
  message: string;
  from: string; // Student user ID
  familyId: string;
  acknowledged: boolean;
}

interface ConnectionState {
  activeRewards: Reward[];
  supportMessages: SupportMessage[];
  supportRequests: SupportRequest[];
  totalEarned: number;
  monthlyEarned: number;
  level: number;
  experience: number;
  mood: 'great' | 'good' | 'okay' | 'struggling' | null;
  lastMoodCheck: Date | null;
  lastSupportRequest: Date | null;
  fetchActiveRewards: () => Promise<void>;
  fetchSupportMessages: () => Promise<void>;
  fetchMonthlyPayments: (studentId?: string) => Promise<void>;
  claimReward: (id: string) => Promise<void>;
  addExperience: (amount: number) => void;
  updateMood: (mood: 'great' | 'good' | 'okay' | 'struggling') => void;
  markMessageRead: (id: string) => void;
  requestSupport: () => void;
  acknowledgeSupport: (id: string) => void;
}

export const useRewardsStore = create<ConnectionState>((set, get) => ({
  activeRewards: [],
  
  supportMessages: [],
  
  supportRequests: [],
  totalEarned: 0,
  monthlyEarned: 0,
  level: 1,
  experience: 0,
  mood: null,
  lastMoodCheck: null,
  lastSupportRequest: null,
  
  fetchActiveRewards: async () => {
    const user = getCurrentUser();
    if (!user) return;

    try {
      // Load total points with better error handling
      const totalPoints = await getUserTotalPoints(user.uid);
      set({ totalEarned: totalPoints });
      
      // TODO: Implement reward generation logic based on user activities
      set({ activeRewards: [] });
    } catch (error: any) {
      console.log('Note: Rewards not available yet, this is normal for new users');
      // Set default values instead of failing
      set({ 
        totalEarned: 0,
        activeRewards: [] 
      });
    }
  },
  
  fetchSupportMessages: async () => {
    const user = getCurrentUser();
    if (!user) return;

    try {
      console.log('🔍 Fetching messages for user:', user.uid);
      
      // Get user profile to determine if parent or student
      const { getUserProfile } = await import('../lib/firebase');
      const userProfile = await getUserProfile(user.uid);
      
      let firebaseMessages;
      if (userProfile?.user_type === 'parent') {
        // Parents want to see messages they SENT
        console.log('👨‍👩‍👧‍👦 Parent user - fetching sent messages');
        firebaseMessages = await getMessagesSentByUser(user.uid);
      } else {
        // Students want to see messages they RECEIVED
        console.log('🎓 Student user - fetching received messages');
        firebaseMessages = await getMessagesForUser(user.uid);
      }
      
      console.log('📥 Messages fetched:', firebaseMessages.length);
      
      // Convert Firebase messages to our SupportMessage format
      const supportMessages = firebaseMessages.map(msg => ({
        id: msg.id,
        type: msg.message_type,
        content: msg.content,
        from: msg.from_user_id,
        to: msg.to_user_id,
        familyId: msg.family_id,
        timestamp: msg.created_at.toDate(),
        read: msg.read
      }));
      
      console.log('📧 Converted messages:', supportMessages);
      set({ supportMessages });
    } catch (error: any) {
      console.error('Error fetching support messages:', error);
      set({ supportMessages: [] });
    }
  },

  fetchMonthlyPayments: async (studentId?: string) => {
    const user = getCurrentUser();
    if (!user) return;

    try {
      console.log('💰 Fetching monthly payments for user:', user.uid, 'student:', studentId);
      
      // Get start of current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Import Firebase functions - use same approach as ActivityHistoryScreen
      const { collection, query, where, getDocs, orderBy } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      
      // Query all payments (same as ActivityHistoryScreen)
      const paymentsQuery = query(
        collection(db, 'payments'),
        where('parent_id', '==', user.uid),
        orderBy('created_at', 'desc')
      );
      
      const querySnapshot = await getDocs(paymentsQuery);
      
      let monthlyTotal = 0;
      querySnapshot.forEach((doc) => {
        const payment = doc.data();
        const paymentDate = payment.created_at.toDate();
        
        // Filter for current month, confirmed/completed status, and optionally by student
        const isCurrentMonth = paymentDate >= startOfMonth;
        const isConfirmed = payment.status === 'confirmed_by_parent' || payment.status === 'confirmed' || payment.status === 'completed';
        const isForStudent = !studentId || payment.student_id === studentId;
        
        if (isCurrentMonth && isConfirmed && isForStudent) {
          monthlyTotal += payment.intent_cents / 100; // Convert cents to dollars
        }
      });
      
      console.log('💰 Monthly confirmed/completed payments total:', monthlyTotal, 'for student:', studentId || 'all');
      set({ monthlyEarned: monthlyTotal });
    } catch (error: any) {
      console.error('Error fetching monthly payments:', error);
      // Don't reset monthlyEarned on error, keep existing value
    }
  },
  
  claimReward: async (id: string) => {
    const user = getCurrentUser();
    if (!user) return;

    const current = get();
    const reward = current.activeRewards.find(r => r.id === id);
    
    if (reward && current.monthlyEarned + reward.amount <= 50) {
      try {
        // Add reward entry to Firebase
        const { error } = await addRewardEntry({
          user_id: user.uid,
          points: reward.amount,
          reason: `Claimed reward: ${reward.title}`,
        });

        if (!error) {
          // Update local state
          set({ 
            totalEarned: current.totalEarned + reward.amount,
            monthlyEarned: current.monthlyEarned + reward.amount,
            experience: current.experience + (reward.amount * 10),
            level: Math.floor((current.experience + (reward.amount * 10)) / 200) + 1,
            activeRewards: current.activeRewards.filter(r => r.id !== id)
          });
        }
      } catch (error) {
        console.error('Failed to claim reward:', error);
      }
    }
  },
  
  addExperience: (amount: number) => {
    const current = get();
    const newExp = current.experience + amount;
    const newLevel = Math.floor(newExp / 200) + 1;
    
    set({ 
      experience: newExp,
      level: newLevel
    });
  },
  
  updateMood: (mood) => {
    set({ 
      mood,
      lastMoodCheck: new Date()
    });
  },
  
  markMessageRead: (id: string) => {
    const current = get();
    const updatedMessages = current.supportMessages.map(msg => 
      msg.id === id ? { ...msg, read: true } : msg
    );
    set({ supportMessages: updatedMessages });
  },

  requestSupport: () => {
    const current = get();
    const now = new Date();
    
    // Check if already requested within last hour
    if (current.lastSupportRequest && 
        now.getTime() - current.lastSupportRequest.getTime() < 60 * 60 * 1000) {
      return;
    }

    const newRequest: SupportRequest = {
      id: Date.now().toString(),
      timestamp: now,
      message: 'I could use some extra support right now 💙',
      from: 'student-1',
      familyId: 'family-1',
      acknowledged: false,
    };

    set({ 
      supportRequests: [newRequest, ...current.supportRequests],
      lastSupportRequest: now
    });
  },

  acknowledgeSupport: (id: string) => {
    const current = get();
    const updatedRequests = current.supportRequests.map(req => 
      req.id === id ? { ...req, acknowledged: true } : req
    );
    set({ supportRequests: updatedRequests });
  },
})); 