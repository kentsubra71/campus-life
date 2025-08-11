import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { 
  addRewardEntry, 
  getRewardEntries, 
  getUserTotalPoints, 
  getCurrentUser 
} from '../lib/firebase';

interface SupportMessage {
  id: string;
  type: 'message' | 'voice' | 'care_package' | 'video_call' | 'boost';
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
    // TODO: Fetch from Supabase
    // For now, new users start with no support messages
    set({ supportMessages: [] });
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