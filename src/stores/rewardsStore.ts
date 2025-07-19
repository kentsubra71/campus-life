import { create } from 'zustand';

interface SupportMessage {
  id: string;
  type: 'message' | 'voice' | 'care_package' | 'video_call' | 'boost';
  content: string;
  from: 'parent';
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

interface ConnectionState {
  activeRewards: Reward[];
  supportMessages: SupportMessage[];
  totalEarned: number;
  monthlyEarned: number;
  level: number;
  experience: number;
  mood: 'great' | 'good' | 'okay' | 'struggling' | null;
  lastMoodCheck: Date | null;
  fetchActiveRewards: () => Promise<void>;
  fetchSupportMessages: () => Promise<void>;
  claimReward: (id: string) => Promise<void>;
  addExperience: (amount: number) => void;
  updateMood: (mood: 'great' | 'good' | 'okay' | 'struggling') => void;
  markMessageRead: (id: string) => void;
}

export const useRewardsStore = create<ConnectionState>((set, get) => ({
  activeRewards: [
    {
      id: '1',
      title: 'Sleep Champion',
      description: 'Maintain great sleep for 7 days',
      amount: 5,
      progress: 5,
      maxProgress: 7,
      type: 'automatic',
      category: 'sleep',
    },
    {
      id: '2',
      title: 'Wellness Warrior',
      description: 'Keep wellness score above 80 for a week',
      amount: 10,
      progress: 3,
      maxProgress: 7,
      type: 'automatic',
      category: 'wellness',
    },
  ],
  
  supportMessages: [
    {
      id: '1',
      type: 'message',
      content: 'So proud of your sleep schedule this week! 🌟',
      from: 'parent',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      read: false,
    },
    {
      id: '2',
      type: 'care_package',
      content: 'Care package arriving Thursday! 🎁',
      from: 'parent',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      read: true,
    },
    {
      id: '3',
      type: 'video_call',
      content: 'Video call scheduled for Sunday 3pm 📞',
      from: 'parent',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      read: true,
    },
  ],
  
  totalEarned: 320,
  monthlyEarned: 25,
  level: 8,
  experience: 1250,
  mood: 'good',
  lastMoodCheck: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
  
  fetchActiveRewards: async () => {
    // TODO: Fetch from Supabase
    const mockRewards: Reward[] = [
      {
        id: '1',
        title: 'Sleep Champion',
        description: 'Maintain great sleep for 7 days',
        amount: 5,
        progress: 5,
        maxProgress: 7,
        type: 'automatic',
        category: 'sleep',
      },
      {
        id: '2',
        title: 'Wellness Warrior',
        description: 'Keep wellness score above 80 for a week',
        amount: 10,
        progress: 3,
        maxProgress: 7,
        type: 'automatic',
        category: 'wellness',
      },
    ];
    
    set({ activeRewards: mockRewards });
  },
  
  fetchSupportMessages: async () => {
    // TODO: Fetch from Supabase
    const mockMessages: SupportMessage[] = [
      {
        id: '1',
        type: 'message',
        content: 'So proud of your sleep schedule this week! 🌟',
        from: 'parent',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        read: false,
      },
      {
        id: '2',
        type: 'care_package',
        content: 'Care package arriving Thursday! 🎁',
        from: 'parent',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
        read: true,
      },
      {
        id: '3',
        type: 'video_call',
        content: 'Video call scheduled for Sunday 3pm 📞',
        from: 'parent',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        read: true,
      },
    ];
    
    set({ supportMessages: mockMessages });
  },
  
  claimReward: async (id: string) => {
    const current = get();
    const reward = current.activeRewards.find(r => r.id === id);
    
    if (reward && current.monthlyEarned + reward.amount <= 50) {
      // Add to totals
      set({ 
        totalEarned: current.totalEarned + reward.amount,
        monthlyEarned: current.monthlyEarned + reward.amount,
        experience: current.experience + (reward.amount * 10),
        level: Math.floor((current.experience + (reward.amount * 10)) / 200) + 1,
        activeRewards: current.activeRewards.filter(r => r.id !== id)
      });
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
})); 