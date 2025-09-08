import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { 
  addRewardEntry, 
  getRewardEntries, 
  getUserTotalPoints, 
  getCurrentUser,
  getMessagesForUser,
  getMessagesSentByUser,
  markMessageAsRead 
} from '../lib/firebase';
import { cache, CACHE_CONFIGS } from '../utils/universalCache';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  lastMessagesFetch: Date | null;
  lastRewardsFetch: Date | null;
  fetchActiveRewards: () => Promise<void>;
  fetchSupportMessages: (forceRefresh?: boolean) => Promise<void>;
  fetchMonthlyPayments: (studentId?: string) => Promise<void>;
  claimReward: (id: string) => Promise<void>;
  addExperience: (amount: number) => void;
  updateMood: (mood: 'great' | 'good' | 'okay' | 'struggling') => void;
  markMessageRead: (id: string) => Promise<void>;
  requestSupport: () => void;
  acknowledgeSupport: (id: string) => void;
  loadUserProgress: () => Promise<void>;
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
  lastMessagesFetch: null,
  lastRewardsFetch: null,
  
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
  
  fetchSupportMessages: async (forceRefresh = false) => {
    const user = getCurrentUser();
    if (!user) return;

    try {
      // Use caching for message threads (shorter cache for real-time feel)
      const messagesData = forceRefresh ? 
        null : 
        await cache.get(CACHE_CONFIGS.MESSAGE_THREADS, user.uid);

      if (messagesData && !forceRefresh) {
        console.log('📦 Using cached support messages');
        set({ 
          supportMessages: messagesData.supportMessages,
          lastMessagesFetch: new Date(messagesData.lastFetch)
        });
        return;
      }

      console.log('🔍 Fetching fresh messages for user:', user.uid, forceRefresh ? '(forced)' : '');
      
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
      
      // Get locally stored read message IDs
      const readMessagesKey = `read_messages_${user.uid}`;
      const localReadMessages = await AsyncStorage.getItem(readMessagesKey);
      const localReadIds = localReadMessages ? JSON.parse(localReadMessages) : [];
      
      // Convert Firebase messages to our SupportMessage format
      const supportMessages = firebaseMessages.map(msg => ({
        id: msg.id,
        type: msg.message_type || 'message',
        content: msg.content,
        from: msg.from_user_id,
        to: msg.to_user_id,
        familyId: msg.family_id,
        timestamp: msg.created_at.toDate(),
        read: msg.read || localReadIds.includes(msg.id) // Use Firebase read state OR local storage
      }));
      
      // Sort by timestamp (newest first)
      supportMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      // Cache the results
      const cacheData = {
        supportMessages,
        lastFetch: new Date().toISOString()
      };
      await cache.set(CACHE_CONFIGS.MESSAGE_THREADS, cacheData, user.uid);
      
      console.log('📧 Converted, sorted, and cached messages:', supportMessages.length);
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
        
        // Filter for current month, confirmed status, and optionally by student
        const isCurrentMonth = paymentDate >= startOfMonth;
        const isConfirmed = payment.status === 'confirmed_by_parent' || payment.status === 'completed';
        const isForStudent = !studentId || payment.student_id === studentId;
        
        if (isCurrentMonth && isConfirmed && isForStudent) {
          monthlyTotal += payment.intent_cents / 100; // Convert cents to dollars
        }
      });
      
      console.log('💰 Monthly confirmed payments total:', monthlyTotal, 'for student:', studentId || 'all');
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
  
  addExperience: async (amount: number) => {
    const current = get();
    const newExp = current.experience + amount;
    const newLevel = Math.floor(newExp / 200) + 1;
    const leveledUp = newLevel > current.level;
    
    set({ 
      experience: newExp,
      level: newLevel
    });
    
    // Save XP to Firebase
    try {
      const user = getCurrentUser();
      if (!user) return;
      
      // FIXED: Use secure Cloud Function for XP updates
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('../lib/firebase');
      
      const updateUserXP = httpsCallable(functions, 'updateUserXP');
      const result = await updateUserXP({
        userId: user.uid,
        experienceGained: amount,
        reason: 'Manual XP award',
        source: 'client_store'
      }) as any;
      
      // Update local state with server response
      if (result.data.success) {
        set(state => ({ 
          ...state, 
          experience: result.data.newExperience, 
          level: result.data.newLevel 
        }));
        
        if (result.data.leveledUp) {
          console.log(`🎉 Level up! Reached level ${result.data.newLevel}`);
          // TODO: Show level up animation/notification
        }
      }
    } catch (error) {
      console.error('Failed to save XP to Firebase:', error);
      // Revert optimistic update on failure
      set(state => ({ ...state, experience: oldExp, level: oldLevel }));
    }
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
    
    // Update local state immediately for responsive UI
    const updatedMessages = current.supportMessages.map(msg => 
      msg.id === id ? { ...msg, read: true } : msg
    );
    set({ supportMessages: updatedMessages });
    
    try {
      // Persist read state to Firebase
      await markMessageAsRead(id);
      
      // Also store in AsyncStorage for local persistence
      const readMessagesKey = `read_messages_${user.uid}`;
      const existingReadMessages = await AsyncStorage.getItem(readMessagesKey);
      const readMessageIds = existingReadMessages ? JSON.parse(existingReadMessages) : [];
      
      if (!readMessageIds.includes(id)) {
        readMessageIds.push(id);
        await AsyncStorage.setItem(readMessagesKey, JSON.stringify(readMessageIds));
      }
      
      // Update cache to reflect the read status
      await cache.invalidate(CACHE_CONFIGS.MESSAGE_THREADS, user.uid);
    } catch (error) {
      console.error('Error marking message as read:', error);
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
            
            console.log('📱 Sending care request notification to parent:', parent.id);
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
  
  loadUserProgress: async () => {
    const user = getCurrentUser();
    if (!user) return;
    
    try {
      // FIXED: Use secure Cloud Function to get user progress
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('../lib/firebase');
      
      const getUserProgress = httpsCallable(functions, 'getUserProgress');
      const result = await getUserProgress({ userId: user.uid }) as any;
      
      if (result.data.exists) {
        set({
          experience: result.data.experience || 0,
          level: result.data.level || 1
        });
        console.log(`📊 Loaded user progress: Level ${result.data.level || 1}, ${result.data.experience || 0} XP`);
      } else {
        // Initialize new user progress
        set({ experience: 0, level: 1 });
        console.log('🆕 Initialized new user progress');
      }
    } catch (error) {
      console.error('Failed to load user progress:', error);
      // Fallback to defaults
      set({ experience: 0, level: 1 });
    }
  },
})); 