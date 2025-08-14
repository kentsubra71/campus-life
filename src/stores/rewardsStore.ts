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
import { onSnapshot, query, collection, where, orderBy, limit, Unsubscribe, getDocs } from 'firebase/firestore';
import { cache, CACHE_CONFIGS } from '../utils/universalCache';

// Reward generation logic
const generateUserRewards = async (userId: string): Promise<Reward[]> => {
  try {
    const { getWellnessStats, getRecentWellnessEntries } = await import('../lib/firebase');
    const stats = await getWellnessStats(userId);
    const recentEntries = await getRecentWellnessEntries(userId, 7); // Last 7 days
    
    const rewards: Reward[] = [];
    
    // Streak-based rewards
    if (stats.currentStreak >= 3 && stats.currentStreak % 3 === 0) {
      rewards.push({
        id: `streak-${stats.currentStreak}`,
        title: `${stats.currentStreak} Day Streak!`,
        description: `You've logged wellness for ${stats.currentStreak} days in a row`,
        amount: Math.min(stats.currentStreak, 10), // Cap at $10
        progress: stats.currentStreak,
        maxProgress: stats.currentStreak,
        type: 'automatic',
        category: 'streak'
      });
    }
    
    // High wellness score rewards
    const highScoreDays = recentEntries.filter(entry => entry.wellnessScore >= 8).length;
    if (highScoreDays >= 3) {
      rewards.push({
        id: `wellness-high-${Date.now()}`,
        title: 'Wellness Champion',
        description: `${highScoreDays} days of excellent wellness this week`,
        amount: 5,
        progress: highScoreDays,
        maxProgress: highScoreDays,
        type: 'automatic',
        category: 'wellness'
      });
    }
    
    // Improvement rewards
    if (recentEntries.length >= 3) {
      const recent3 = recentEntries.slice(0, 3);
      const improving = recent3.every((entry, index) => 
        index === 0 || entry.wellnessScore >= recent3[index - 1].wellnessScore
      );
      
      if (improving) {
        rewards.push({
          id: `improvement-${Date.now()}`,
          title: 'Getting Better!',
          description: 'Your wellness scores are improving',
          amount: 3,
          progress: 3,
          maxProgress: 3,
          type: 'automatic',
          category: 'wellness'
        });
      }
    }
    
    // Consistency rewards
    if (stats.totalEntries >= 7) {
      const weeklyConsistency = Math.floor(stats.totalEntries / 7);
      if (weeklyConsistency > 0 && weeklyConsistency % 2 === 0) {
        rewards.push({
          id: `consistency-${weeklyConsistency}`,
          title: 'Consistency Master',
          description: `${weeklyConsistency} weeks of regular wellness tracking`,
          amount: 7,
          progress: weeklyConsistency,
          maxProgress: weeklyConsistency,
          type: 'automatic',
          category: 'wellness'
        });
      }
    }
    
    return rewards;
  } catch (error) {
    console.error('Error generating rewards:', error);
    return [];
  }
};

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

interface RewardRequest {
  id: string;
  studentId: string;
  studentName: string;
  familyId: string;
  rewardTitle: string;
  rewardDescription: string;
  amount: number;
  category: string;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: Date;
  respondedAt?: Date;
}

interface ConnectionState {
  activeRewards: Reward[];
  supportMessages: SupportMessage[];
  supportRequests: SupportRequest[];
  rewardRequests: RewardRequest[];
  totalEarned: number;
  monthlyEarned: number;
  level: number;
  experience: number;
  mood: 'great' | 'good' | 'okay' | 'struggling' | null;
  lastMoodCheck: Date | null;
  lastSupportRequest: Date | null;
  lastMessagesFetch: Date | null;
  lastRewardsFetch: Date | null;
  messagesListener: Unsubscribe | null;
  fetchActiveRewards: () => Promise<void>;
  fetchSupportMessages: (forceRefresh?: boolean) => Promise<void>;
  setupRealtimeMessages: () => Promise<void>;
  cleanupListeners: () => void;
  fetchMonthlyPayments: (studentId?: string) => Promise<void>;
  requestReward: (reward: Reward) => Promise<{ success: boolean; error?: string }>;
  addExperience: (amount: number) => void;
  updateMood: (mood: 'great' | 'good' | 'okay' | 'struggling') => void;
  markMessageRead: (id: string) => Promise<void>;
  requestSupport: () => Promise<void>;
  acknowledgeSupport: (id: string) => void;
  fetchRewardRequests: () => Promise<void>;
}

export const useRewardsStore = create<ConnectionState>((set, get) => ({
  activeRewards: [],
  
  supportMessages: [],
  
  supportRequests: [],
  rewardRequests: [],
  totalEarned: 0,
  monthlyEarned: 0, // This ensures budget starts at $50 left
  level: 1,
  experience: 0,
  mood: null,
  lastMoodCheck: null,
  lastSupportRequest: null,
  lastMessagesFetch: null,
  lastRewardsFetch: null,
  messagesListener: null,
  
  fetchActiveRewards: async () => {
    const user = getCurrentUser();
    if (!user) return;

    try {
      // Load total points with better error handling
      const totalPoints = await getUserTotalPoints(user.uid);
      set({ totalEarned: totalPoints });
      
      // Generate rewards based on user activities
      const generatedRewards = await generateUserRewards(user.uid);
      set({ activeRewards: generatedRewards });
    } catch (error: any) {
      // Set default values instead of failing
      set({ 
        totalEarned: 0,
        activeRewards: [] 
      });
    }
  },

  setupRealtimeMessages: async () => {
    const user = getCurrentUser();
    if (!user) return;

    try {
      // Clean up existing listener
      const current = get();
      if (current.messagesListener) {
        current.messagesListener();
      }

      // Get user profile to determine message query type
      const { getUserProfile, db } = await import('../lib/firebase');
      const userProfile = await getUserProfile(user.uid);
      if (!userProfile) return;

      // Set up real-time listener based on user type
      let messagesQuery;
      if (userProfile.user_type === 'parent') {
        // Parents see messages they sent
        messagesQuery = query(
          collection(db, 'messages'),
          where('from_user_id', '==', user.uid),
          orderBy('created_at', 'desc'),
          limit(50)
        );
      } else {
        // Students see messages they received
        messagesQuery = query(
          collection(db, 'messages'),
          where('to_user_id', '==', user.uid),
          orderBy('created_at', 'desc'),
          limit(50)
        );
      }

      const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        
        const current = get();
        const currentMessages = current.supportMessages;
        
        const supportMessages = snapshot.docs.map(doc => {
          const data = doc.data();
          
          // Check if we have this message locally and preserve its read state if it was marked read locally
          const existingMessage = currentMessages.find(msg => msg.id === doc.id);
          const shouldPreserveReadState = existingMessage && existingMessage.read && !data.read;
          
          
          return {
            id: doc.id,
            type: data.message_type || 'message',
            content: data.content,
            from: data.from_user_id,
            to: data.to_user_id,
            familyId: data.family_id,
            timestamp: data.created_at.toDate(),
            read: shouldPreserveReadState ? true : (data.read || false)
          } as SupportMessage;
        });

        // Sort by timestamp (newest first)
        supportMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        set({ 
          supportMessages,
          lastMessagesFetch: new Date()
        });
      }, (error) => {
        console.error('❌ Real-time messages listener error:', error);
        // Fall back to regular fetch on error
        get().fetchSupportMessages(true);
      });

      set({ messagesListener: unsubscribe });
    } catch (error) {
      console.error('❌ Failed to setup real-time messages:', error);
      // Fall back to regular fetch
      get().fetchSupportMessages(true);
    }
  },

  cleanupListeners: () => {
    const current = get();
    if (current.messagesListener) {
      current.messagesListener();
      set({ messagesListener: null });
    }
  },
  
  fetchSupportMessages: async (forceRefresh = false) => {
    const user = getCurrentUser();
    if (!user) return;

    try {
      // Use caching for message threads (shorter cache for real-time feel)
      const messagesData = forceRefresh ? 
        null : 
        await cache.get(CACHE_CONFIGS.MESSAGE_THREADS, user.uid);

      if (messagesData && !forceRefresh) {
        set({ 
          supportMessages: messagesData.supportMessages,
          lastMessagesFetch: new Date(messagesData.lastFetch)
        });
        return;
      }

      
      // Get user profile to determine if parent or student
      const { getUserProfile } = await import('../lib/firebase');
      const userProfile = await getUserProfile(user.uid);
      
      let firebaseMessages;
      if (userProfile?.user_type === 'parent') {
        // Parents want to see messages they SENT
        firebaseMessages = await getMessagesSentByUser(user.uid);
      } else {
        // Students want to see messages they RECEIVED
        firebaseMessages = await getMessagesForUser(user.uid);
      }
      
      
      // Convert Firebase messages to our SupportMessage format
      const supportMessages = firebaseMessages.map(msg => ({
        id: msg.id,
        type: msg.message_type || 'message',
        content: msg.content,
        from: msg.from_user_id,
        to: msg.to_user_id,
        familyId: msg.family_id,
        timestamp: msg.created_at.toDate(),
        read: msg.read || false
      }));
      
      // Sort by timestamp (newest first)
      supportMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      // Cache the results
      const cacheData = {
        supportMessages,
        lastFetch: new Date().toISOString()
      };
      await cache.set(CACHE_CONFIGS.MESSAGE_THREADS, cacheData, user.uid);
      
      set({ 
        supportMessages,
        lastMessagesFetch: new Date()
      });
    } catch (error: any) {
      console.error('Error fetching support messages:', error);
      // Don't clear existing messages on error unless forced
      if (forceRefresh) {
        set({ supportMessages: [] });
      }
    }
  },

  fetchMonthlyPayments: async (studentId?: string) => {
    const user = getCurrentUser();
    if (!user) return;

    try {
      // Use the provided studentId or fall back to current user
      const targetUserId = studentId || user.uid;
      
      // For now, use the reward entries as a proxy for earnings since payments collection may not exist
      // This gives a more realistic demo experience
      const totalPoints = await getUserTotalPoints(targetUserId);
      
      // Get current month rewards as "monthly earnings"
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const rewardEntries = await getRewardEntries(targetUserId, 100);
      let monthlyTotal = 0;
      
      rewardEntries.forEach((reward) => {
        const rewardDate = reward.created_at.toDate();
        if (rewardDate >= startOfMonth) {
          monthlyTotal += reward.points;
        }
      });
      
      set({ 
        monthlyEarned: monthlyTotal,
        totalEarned: totalPoints
      });
    } catch (error: any) {
      // Handle permissions errors gracefully - set demo values
      if (error.code === 'permission-denied' || error.message?.includes('permissions')) {
        // Set realistic demo values for development
        set({ 
          monthlyEarned: 10, // $10 this month
          totalEarned: 25    // $25 total
        });
      } else {
        console.error('Error fetching monthly payments:', error);
        // Don't reset values on error, keep existing values
      }
    }
  },
  
  requestReward: async (reward: Reward) => {
    const user = getCurrentUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    if (reward.progress < reward.maxProgress) {
      return { success: false, error: 'Reward not yet earned' };
    }

    try {
      // Get user profile for family info
      const { getUserProfile, getFamilyMembers } = await import('../lib/firebase');
      const userProfile = await getUserProfile(user.uid);
      if (!userProfile || !userProfile.family_id) {
        return { success: false, error: 'No family found' };
      }

      // Create reward request in Firebase
      const { collection, addDoc, Timestamp } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');

      const rewardRequestData = {
        studentId: user.uid,
        studentName: userProfile.full_name,
        familyId: userProfile.family_id,
        rewardTitle: reward.title,
        rewardDescription: reward.description,
        amount: reward.amount,
        category: reward.category,
        status: 'pending',
        requestedAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, 'reward_requests'), rewardRequestData);
      
      // Add to local state
      const current = get();
      const newRequest: RewardRequest = {
        id: docRef.id,
        studentId: user.uid,
        studentName: userProfile.full_name,
        familyId: userProfile.family_id,
        rewardTitle: reward.title,
        rewardDescription: reward.description,
        amount: reward.amount,
        category: reward.category,
        status: 'pending',
        requestedAt: new Date()
      };

      set({ 
        rewardRequests: [newRequest, ...current.rewardRequests],
        activeRewards: current.activeRewards.filter(r => r.id !== reward.id)
      });

      // Send push notifications to parents
      try {
        const { pushNotificationService, NotificationTemplates } = await import('../services/pushNotificationService');
        const { parents } = await getFamilyMembers(userProfile.family_id);
        
        for (const parent of parents) {
          if (parent.pushToken) {
            const notification = {
              ...NotificationTemplates.rewardRequest(userProfile.full_name, reward.title, reward.amount),
              userId: parent.id
            };
            
            await pushNotificationService.sendPushNotification(notification);
          }
        }
      } catch (notifError) {
        console.error('Failed to send reward request notifications:', notifError);
      }

      return { success: true };
    } catch (error: any) {
      console.error('Failed to request reward:', error);
      return { success: false, error: error.message || 'Failed to request reward' };
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
  
  markMessageRead: async (id: string) => {
    const current = get();
    const user = getCurrentUser();
    if (!user) return;
    
    // Optimistically update local state first
    const updatedMessages = current.supportMessages.map(msg => 
      msg.id === id ? { ...msg, read: true } : msg
    );
    set({ supportMessages: updatedMessages });
    
    // Clear the message cache to prevent it from overriding our changes
    try {
      await cache.clear(CACHE_CONFIGS.MESSAGE_THREADS, user.uid);
    } catch (error) {
      // Cache clear failure is not critical
    }
    
    // Persist to Firebase
    try {
      const { markMessageAsRead } = await import('../lib/firebase');
      const result = await markMessageAsRead(id);
      
      if (!result.success) {
        console.error('Failed to mark message as read in Firebase:', result.error);
        // Revert optimistic update on failure
        set({ supportMessages: current.supportMessages });
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
      // Revert optimistic update on failure
      set({ supportMessages: current.supportMessages });
    }
  },

  requestSupport: async () => {
    const current = get();
    const now = new Date();
    
    // Check if already requested within last hour
    if (current.lastSupportRequest && 
        now.getTime() - current.lastSupportRequest.getTime() < 60 * 60 * 1000) {
      return;
    }

    const user = getCurrentUser();
    if (!user) return;

    try {
      // Get user profile for family info
      const { getUserProfile, getFamilyMembers } = await import('../lib/firebase');
      const userProfile = await getUserProfile(user.uid);
      if (!userProfile || !userProfile.family_id) return;

      // Create support request in Firebase
      const { collection, addDoc, Timestamp } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');

      const supportRequestData = {
        from_user_id: user.uid,
        family_id: userProfile.family_id,
        message: 'I could use some extra support right now 💙',
        created_at: Timestamp.now(),
        acknowledged: false,
        type: 'care_request'
      };

      const docRef = await addDoc(collection(db, 'support_requests'), supportRequestData);
      
      // Create local request for immediate UI update
      const newRequest: SupportRequest = {
        id: docRef.id,
        timestamp: now,
        message: 'I could use some extra support right now 💙',
        from: user.uid,
        familyId: userProfile.family_id,
        acknowledged: false,
      };

      set({ 
        supportRequests: [newRequest, ...current.supportRequests],
        lastSupportRequest: now
      });

      // Send push notifications to all parents in the family
      try {
        const { pushNotificationService, NotificationTemplates } = await import('../services/pushNotificationService');
        const { parents } = await getFamilyMembers(userProfile.family_id);
        
        const studentName = userProfile.full_name;
        
        for (const parent of parents) {
          if (parent.pushToken) {
            const notification = {
              ...NotificationTemplates.careRequest(studentName, 'I could use some extra support right now 💙'),
              userId: parent.id
            };
            
            await pushNotificationService.sendPushNotification(notification);
          }
        }
      } catch (notifError) {
        console.error('📱 Failed to send care request notifications:', notifError);
      }

    } catch (error) {
      console.error('Failed to create support request:', error);
    }
  },

  acknowledgeSupport: (id: string) => {
    const current = get();
    const updatedRequests = current.supportRequests.map(req => 
      req.id === id ? { ...req, acknowledged: true } : req
    );
    set({ supportRequests: updatedRequests });
  },

  fetchRewardRequests: async () => {
    const user = getCurrentUser();
    if (!user) return;

    try {
      // Get user profile to check if parent and get family_id
      const { getUserProfile } = await import('../lib/firebase');
      const userProfile = await getUserProfile(user.uid);
      
      if (!userProfile || userProfile.user_type !== 'parent' || !userProfile.family_id) {
        return;
      }

      // Query reward requests for this family
      const { db } = await import('../lib/firebase');
      const q = query(
        collection(db, 'reward_requests'),
        where('familyId', '==', userProfile.family_id),
        orderBy('requestedAt', 'desc'),
        limit(50)
      );

      const querySnapshot = await getDocs(q);
      const rewardRequests = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          studentId: data.studentId,
          studentName: data.studentName,
          familyId: data.familyId,
          rewardTitle: data.rewardTitle,
          rewardDescription: data.rewardDescription,
          amount: data.amount,
          category: data.category,
          status: data.status,
          requestedAt: data.requestedAt.toDate(),
          respondedAt: data.respondedAt?.toDate()
        } as RewardRequest;
      });

      set({ rewardRequests });
    } catch (error: any) {
      console.error('Error fetching reward requests:', error);
      // Don't clear existing requests on error
    }
  },
})); 