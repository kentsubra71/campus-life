import { create } from 'zustand';
import { 
  addWellnessEntry, 
  updateWellnessEntry,
  getWellnessEntries, 
  WellnessEntry as FirebaseWellnessEntry,
  getCurrentUser 
} from '../lib/firebase';
import { cache, CACHE_CONFIGS } from '../utils/universalCache';
import { getTodayDateString, getLocalDateString, getDateStringDaysAgo } from '../utils/dateUtils';

export interface WellnessEntry {
  id: string;
  date: string;
  rankings: {
    sleep: number;      // 1-4 (1=best performing, 4=worst performing)
    nutrition: number;  // 1-4  
    academics: number;  // 1-4
    social: number;     // 1-4
  };
  overallMood: number; // 1-10 slider for general day quality
  notes?: string;
  overallScore: number; // calculated from rankings + mood
}

export interface WellnessStats {
  currentStreak: number;
  longestStreak: number;
  averageScore: number;
  totalEntries: number;
  weeklyAverage: number;
  categoryAverages: {
    sleep: number;      // 1-4 average
    nutrition: number;  // 1-4 average
    academics: number;  // 1-4 average
    social: number;     // 1-4 average
  };
}

interface WellnessStore {
  entries: WellnessEntry[];
  stats: WellnessStats;
  todayEntry: WellnessEntry | null;
  
  // Actions
  addEntry: (entry: Omit<WellnessEntry, 'id' | 'overallScore'>) => Promise<void>;
  updateEntry: (id: string, updates: Partial<WellnessEntry>) => Promise<void>;
  getEntryByDate: (date: string) => WellnessEntry | null;
  calculateOverallScore: (entry: Omit<WellnessEntry, 'id' | 'overallScore'>) => number;
  calculateStats: () => WellnessStats;
  getWeeklyEntries: () => WellnessEntry[];
  getMonthlyEntries: () => WellnessEntry[];
  loadEntries: (studentId?: string) => Promise<void>;
}

const calculateOverallScore = (entry: Omit<WellnessEntry, 'id' | 'overallScore'>): number => {
  const { rankings, overallMood } = entry;
  
  // Convert rankings to points (1=best=4pts, 2=3pts, 3=2pts, 4=worst=1pt)
  const points = {
    sleep: 5 - rankings.sleep,      // Inverts: 1->4, 2->3, 3->2, 4->1
    nutrition: 5 - rankings.nutrition,
    academics: 5 - rankings.academics, 
    social: 5 - rankings.social,
  };
  
  // Rankings component (40% weight): average of category points, scaled to 4
  const rankingsScore = (points.sleep + points.nutrition + points.academics + points.social) / 4;
  
  // Overall mood component (60% weight): direct 1-10 scale
  const moodScore = overallMood;
  
  // Weighted combination: 40% rankings + 60% mood
  const combinedScore = (rankingsScore * 0.4 * 2.5) + (moodScore * 0.6);
  
  // Ensure score is between 1-10
  const finalScore = Math.max(1, Math.min(10, combinedScore));
  return Math.round(finalScore * 10) / 10; // Round to 1 decimal place
};

export const useWellnessStore = create<WellnessStore>((set, get) => ({
  entries: [],
  stats: {
    currentStreak: 0,
    longestStreak: 0,
    averageScore: 0,
    totalEntries: 0,
    weeklyAverage: 0,
    categoryAverages: {
      sleep: 0,
      nutrition: 0,
      academics: 0,
      social: 0,
    },
  },
  todayEntry: null,

  addEntry: async (entryData) => {
    const user = getCurrentUser();
    if (!user) return;

    const overallScore = calculateOverallScore(entryData);
    
    // Check if entry for today already exists
    const today = entryData.date;
    const state = get();
    const entries = state.entries || [];
    const existingEntry = entries.find(entry => entry.date === today);
    
    if (existingEntry) {
      // Update existing entry instead of creating new one
      await state.updateEntry(existingEntry.id, entryData);
      return;
    }
    
    // Convert to Firebase format
    const firebaseEntry: Omit<FirebaseWellnessEntry, 'id' | 'created_at'> = {
      user_id: user.uid,
      date: entryData.date,
      sleep_ranking: entryData.rankings.sleep,
      nutrition_ranking: entryData.rankings.nutrition,
      academics_ranking: entryData.rankings.academics,
      social_ranking: entryData.rankings.social,
      overall_mood: entryData.overallMood,
      notes: entryData.notes || null, // Convert undefined to null for Firestore
    };

    try {
      const { id, error } = await addWellnessEntry(firebaseEntry);
      if (error || !id) {
        console.error('Failed to add wellness entry:', error);
        return;
      }

      const newEntry: WellnessEntry = {
        ...entryData,
        id,
        overallScore,
      };

      set((state) => ({
        entries: [...(state.entries || []), newEntry],
        todayEntry: newEntry,
      }));
      
      // Calculate and update stats after setting entries
      const updatedStats = get().calculateStats();
      set({ stats: updatedStats });
      
      // Clear cache so fresh data is loaded next time
      await cache.clear(CACHE_CONFIGS.WELLNESS_DATA, user.uid);

      // Send notification to parents
      try {
        const { useAuthStore } = await import('./authStore');
        const { pushNotificationService, NotificationTemplates } = await import('../services/pushNotificationService');
        
        const { getFamilyMembers, user: currentUser } = useAuthStore.getState();
        if (currentUser?.role === 'student') {
          const familyMembers = await getFamilyMembers();
          const studentName = currentUser.name || 'Student';
          
          // Get overall wellness status for notification
          const getWellnessStatusText = (score: number) => {
            if (score >= 8) return 'doing great';
            if (score >= 6) return 'doing well';
            if (score >= 4) return 'managing okay';
            return 'may need support';
          };
          
          const statusText = getWellnessStatusText(overallScore);
          
          // Send to all parents
          for (const parent of familyMembers.parents) {
            const notification = {
              ...NotificationTemplates.studentWellnessLogged(studentName, overallScore, statusText),
              userId: parent.id
            };
            
            await pushNotificationService.sendPushNotification(notification);
          }
          
          console.log('📊 Wellness notification sent to parents');
        }
      } catch (notifError) {
        console.error('Failed to send wellness notification:', notifError);
      }
      
      // Award XP for logging wellness entry
      try {
        const { useRewardsStore } = await import('./rewardsStore');
        const { addExperience } = useRewardsStore.getState();
        
        // Award XP based on overall score
        let xpAmount = 20; // Base XP for logging
        if (overallScore >= 8) xpAmount = 50; // Bonus for high wellness
        else if (overallScore >= 6) xpAmount = 35; // Bonus for good wellness
        
        addExperience(xpAmount);
        console.log(`🎯 Awarded ${xpAmount} XP for wellness entry (score: ${overallScore})`);
      } catch (error) {
        console.error('Failed to award XP:', error);
      }
      
      // Send wellness log notification to parents
      try {
        const { getCurrentUser, getUserProfile, getFamilyMembers } = await import('../lib/firebase');
        const { pushNotificationService, NotificationTemplates } = await import('../services/pushNotificationService');
        
        const user = getCurrentUser();
        if (!user) return;
        
        const userProfile = await getUserProfile(user.uid);
        if (!userProfile || !userProfile.family_id || userProfile.user_type !== 'student') return;
        
        // Get family members to notify parents
        const { parents } = await getFamilyMembers(userProfile.family_id);
        const studentName = userProfile.full_name;
        
        // Only send notification for significant wellness changes (good or concerning)
        const shouldNotify = overallScore >= 8 || overallScore <= 4;
        
        if (shouldNotify) {
          for (const parent of parents) {
            if (parent.pushToken) {
              const notification = {
                ...NotificationTemplates.weeklyReport(studentName, overallScore),
                userId: parent.id,
                title: overallScore >= 8 ? 
                  `✨ ${studentName} had a great day!` : 
                  `💙 ${studentName} may need support`,
                body: `Wellness score: ${overallScore}/10 - Check their latest log`
              };
              
              console.log('📱 Sending wellness notification to parent:', parent.id);
              await pushNotificationService.sendPushNotification(notification);
            }
          }
        }
      } catch (notifError) {
        console.error('📱 Failed to send wellness log notification:', notifError);
      }
    } catch (error) {
      console.error('Failed to add wellness entry:', error);
    }
  },

  updateEntry: async (id, updates) => {
    const user = getCurrentUser();
    if (!user) return;

    try {
      // Convert local format to Firebase format for update
      const firebaseUpdates: any = {};
      if (updates.date !== undefined) firebaseUpdates.date = updates.date;
      if (updates.rankings?.sleep !== undefined) firebaseUpdates.sleep_ranking = updates.rankings.sleep;
      if (updates.rankings?.nutrition !== undefined) firebaseUpdates.nutrition_ranking = updates.rankings.nutrition;
      if (updates.rankings?.academics !== undefined) firebaseUpdates.academics_ranking = updates.rankings.academics;
      if (updates.rankings?.social !== undefined) firebaseUpdates.social_ranking = updates.rankings.social;
      if (updates.overallMood !== undefined) firebaseUpdates.overall_mood = updates.overallMood;
      if (updates.notes !== undefined) firebaseUpdates.notes = updates.notes;

      const { success, error } = await updateWellnessEntry(id, firebaseUpdates);
      if (!success) {
        console.error('Failed to update wellness entry:', error);
        return;
      }

      set((state) => {
        const entriesArray = state.entries || [];
        const updatedEntries = entriesArray.map((entry) => {
          if (entry.id === id) {
            const updatedEntry = { ...entry, ...updates };
            if (updates.rankings || updates.overallMood !== undefined) {
              updatedEntry.overallScore = calculateOverallScore(updatedEntry);
            }
            return updatedEntry;
          }
          return entry;
        });

        return {
          entries: updatedEntries,
          todayEntry: updatedEntries.find(entry => entry.date === getTodayDateString()) || null,
        };
      });
      
      // Calculate and update stats after setting entries
      const updatedStats = get().calculateStats();
      set({ stats: updatedStats });
      
      // Clear cache so fresh data is loaded next time
      await cache.clear(CACHE_CONFIGS.WELLNESS_DATA, user.uid);
    } catch (error) {
      console.error('Failed to update wellness entry:', error);
    }
  },

  getEntryByDate: (date) => {
    const state = get();
    if (!state || !state.entries) return null;
    return state.entries.find(entry => entry.date === date) || null;
  },

  calculateOverallScore,

  calculateStats: () => {
    const { entries } = get();
    const entriesArray = entries || [];
    const today = getTodayDateString();
    const sortedEntries = [...entriesArray].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate current streak
    let currentStreak = 0;
    
    for (let i = 0; i < 30; i++) { // Check last 30 days
      const dateStr = getDateStringDaysAgo(i);
      const entry = entriesArray.find(e => e.date === dateStr);
      
      if (entry) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    let lastDate: Date | null = null;

    for (const entry of sortedEntries) {
      const entryDate = new Date(entry.date);
      
      if (!lastDate || Math.abs(entryDate.getTime() - lastDate.getTime()) === 86400000) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 1;
      }
      
      lastDate = entryDate;
    }

    // Calculate overall score averages
    const totalScore = entriesArray.reduce((sum, entry) => sum + entry.overallScore, 0);
    const averageScore = entriesArray.length > 0 ? totalScore / entriesArray.length : 0;

    // Weekly average (last 7 days)
    const weekAgoDateStr = getDateStringDaysAgo(7);
    const weeklyEntries = entriesArray.filter(entry => entry.date >= weekAgoDateStr);
    const weeklyScore = weeklyEntries.reduce((sum, entry) => sum + entry.overallScore, 0);
    const weeklyAverage = weeklyEntries.length > 0 ? weeklyScore / weeklyEntries.length : 0;
    
    // Calculate category averages
    const categoryTotals = entriesArray.reduce((totals, entry) => {
      totals.sleep += entry.rankings.sleep;
      totals.nutrition += entry.rankings.nutrition;
      totals.academics += entry.rankings.academics;
      totals.social += entry.rankings.social;
      return totals;
    }, { sleep: 0, nutrition: 0, academics: 0, social: 0 });

    const categoryAverages = {
      sleep: entriesArray.length > 0 ? Math.round((categoryTotals.sleep / entriesArray.length) * 10) / 10 : 0,
      nutrition: entriesArray.length > 0 ? Math.round((categoryTotals.nutrition / entriesArray.length) * 10) / 10 : 0,
      academics: entriesArray.length > 0 ? Math.round((categoryTotals.academics / entriesArray.length) * 10) / 10 : 0,
      social: entriesArray.length > 0 ? Math.round((categoryTotals.social / entriesArray.length) * 10) / 10 : 0,
    };

    const stats: WellnessStats = {
      currentStreak,
      longestStreak,
      averageScore: Math.round(averageScore * 10) / 10,
      totalEntries: entriesArray.length,
      weeklyAverage: Math.round(weeklyAverage * 10) / 10,
      categoryAverages,
    };

    set({ stats });
    return stats;
  },

  getWeeklyEntries: () => {
    const { entries } = get();
    const entriesArray = entries || [];
    const weekAgoDateStr = getDateStringDaysAgo(7);
    return entriesArray.filter(entry => entry.date >= weekAgoDateStr);
  },

  getMonthlyEntries: () => {
    const { entries } = get();
    const entriesArray = entries || [];
    const monthAgoDateStr = getDateStringDaysAgo(30);
    return entriesArray.filter(entry => entry.date >= monthAgoDateStr);
  },

  loadEntries: async (studentId?: string) => {
    const user = getCurrentUser();
    if (!user) return;

    // For parents viewing student data, use studentId parameter
    const targetUserId = studentId || user.uid;

    try {
      // Use smart caching for wellness data
      const wellnessData = await cache.getOrFetch(
        CACHE_CONFIGS.WELLNESS_DATA,
        async () => {
          console.log('🔄 Loading fresh wellness entries...');
          const firebaseEntries = await getWellnessEntries(targetUserId);
          
          // Validate that firebaseEntries is an array
          if (!Array.isArray(firebaseEntries)) {
            console.error('❌ Firebase entries is not an array:', firebaseEntries);
            return { entries: [], todayEntry: null };
          }
          
          // Convert Firebase entries to local format
          const entries: WellnessEntry[] = firebaseEntries.map(entry => ({
            id: entry.id || '',
            date: entry.date || getLocalDateString(entry.created_at.toDate()), // Use stored date or fallback to created_at
            rankings: {
              sleep: entry.sleep_ranking || 2, // Default to middle if not set
              nutrition: entry.nutrition_ranking || 2,
              academics: entry.academics_ranking || 2,
              social: entry.social_ranking || 2,
            },
            overallMood: entry.overall_mood || 5, // Default to middle mood
            notes: entry.notes,
            overallScore: calculateOverallScore({
              date: entry.date || getLocalDateString(entry.created_at.toDate()),
              rankings: {
                sleep: entry.sleep_ranking || 2,
                nutrition: entry.nutrition_ranking || 2,
                academics: entry.academics_ranking || 2,
                social: entry.social_ranking || 2,
              },
              overallMood: entry.overall_mood || 5,
              notes: entry.notes,
            }),
          }));

          const today = getTodayDateString();
          const todayEntry = entries.find(entry => entry.date === today) || null;
          
          return { entries, todayEntry };
        },
        targetUserId
      );

      // Validate cached data before setting it to state
      if (!wellnessData || !Array.isArray(wellnessData.entries)) {
        console.error('❌ Invalid wellness data from cache/fetch:', wellnessData);
        set({ entries: [], todayEntry: null });
      } else {
        // Set the data from cache or fresh fetch
        set({ entries: wellnessData.entries, todayEntry: wellnessData.todayEntry });
      }
      
      // Calculate and update stats
      const stats = get().calculateStats();
      set({ stats });
      
      console.log('📦 Loaded wellness data', { 
        entriesCount: wellnessData?.entries?.length || 0, 
        hasTodayEntry: !!wellnessData?.todayEntry 
      });
    } catch (error) {
      console.error('❌ Failed to load wellness entries:', error);
      
      // Clear potentially corrupted cache data and set safe defaults
      try {
        await cache.clear(CACHE_CONFIGS.WELLNESS_DATA, targetUserId);
        console.log('🧹 Cleared corrupted wellness cache');
      } catch (clearError) {
        console.error('❌ Failed to clear cache:', clearError);
      }
      
      // Set safe default state
      set({ entries: [], todayEntry: null, stats: {
        currentStreak: 0,
        longestStreak: 0,
        averageScore: 0,
        totalEntries: 0,
        weeklyAverage: 0,
        categoryAverages: {
          sleep: 0,
          nutrition: 0,
          academics: 0,
          social: 0,
        },
      }});
    }
  },
})); 