import { create } from 'zustand';
import { 
  addWellnessEntry, 
  getWellnessEntries, 
  WellnessEntry as FirebaseWellnessEntry,
  getCurrentUser 
} from '../lib/firebase';
import { cache, CACHE_CONFIGS } from '../utils/universalCache';

export interface WellnessEntry {
  id: string;
  date: string;
  mood: number; // 1-10 scale
  sleep: number; // hours
  exercise: number; // minutes
  nutrition: number; // 1-10 scale
  water: number; // glasses
  social: number; // 1-10 scale
  academic: number; // 1-10 scale
  notes?: string;
  wellnessScore: number; // calculated score
}

export interface WellnessStats {
  currentStreak: number;
  longestStreak: number;
  averageScore: number;
  totalEntries: number;
  weeklyAverage: number;
}

interface WellnessStore {
  entries: WellnessEntry[];
  stats: WellnessStats;
  todayEntry: WellnessEntry | null;
  
  // Actions
  addEntry: (entry: Omit<WellnessEntry, 'id' | 'wellnessScore'>) => void;
  updateEntry: (id: string, updates: Partial<WellnessEntry>) => void;
  getEntryByDate: (date: string) => WellnessEntry | null;
  calculateWellnessScore: (entry: Omit<WellnessEntry, 'id' | 'wellnessScore'>) => number;
  calculateStats: () => WellnessStats;
  getWeeklyEntries: () => WellnessEntry[];
  getMonthlyEntries: () => WellnessEntry[];
  loadEntries: () => Promise<void>;
}

const calculateWellnessScore = (entry: Omit<WellnessEntry, 'id' | 'wellnessScore'>): number => {
  const weights = {
    mood: 0.25,
    sleep: 0.20,
    exercise: 0.15,
    nutrition: 0.15,
    water: 0.10,
    social: 0.10,
    academic: 0.05,
  };

  const normalizedSleep = Math.min(entry.sleep / 8, 1) * 10; // 8 hours = 10 points
  const normalizedExercise = Math.min(entry.exercise / 60, 1) * 10; // 60 minutes = 10 points
  const normalizedWater = Math.min(entry.water / 8, 1) * 10; // 8 glasses = 10 points

  const score = 
    entry.mood * weights.mood +
    normalizedSleep * weights.sleep +
    normalizedExercise * weights.exercise +
    entry.nutrition * weights.nutrition +
    normalizedWater * weights.water +
    entry.social * weights.social +
    entry.academic * weights.academic;

  return Math.round(score * 10) / 10; // Round to 1 decimal place
};

export const useWellnessStore = create<WellnessStore>((set, get) => ({
  entries: [],
  stats: {
    currentStreak: 0,
    longestStreak: 0,
    averageScore: 0,
    totalEntries: 0,
    weeklyAverage: 0,
  },
  todayEntry: null,

  addEntry: async (entryData) => {
    const user = getCurrentUser();
    if (!user) return;

    const wellnessScore = calculateWellnessScore(entryData);
    
    // Convert to Firebase format
    const firebaseEntry: Omit<FirebaseWellnessEntry, 'id' | 'created_at'> = {
      user_id: user.uid,
      mood: entryData.mood,
      sleep_hours: entryData.sleep,
      exercise_minutes: entryData.exercise,
      nutrition: entryData.nutrition,
      water: entryData.water,
      social: entryData.social,
      academic: entryData.academic,
      notes: entryData.notes,
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
        wellnessScore,
      };

      set((state) => ({
        entries: [...state.entries, newEntry],
        todayEntry: newEntry,
      }));
      
      // Calculate and update stats after setting entries
      const updatedStats = get().calculateStats();
      set({ stats: updatedStats });
      
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
        const shouldNotify = wellnessScore >= 8 || wellnessScore <= 4;
        
        if (shouldNotify) {
          for (const parent of parents) {
            if (parent.pushToken) {
              const notification = {
                ...NotificationTemplates.weeklyReport(studentName, wellnessScore),
                userId: parent.id,
                title: wellnessScore >= 8 ? 
                  `✨ ${studentName} had a great day!` : 
                  `💙 ${studentName} may need support`,
                body: `Wellness score: ${wellnessScore}/10 - Check their latest log`
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

  updateEntry: (id, updates) => {
    set((state) => {
      const updatedEntries = state.entries.map((entry) => {
        if (entry.id === id) {
          const updatedEntry = { ...entry, ...updates };
          if (updates.mood || updates.sleep || updates.exercise || updates.nutrition || updates.water || updates.social || updates.academic) {
            updatedEntry.wellnessScore = calculateWellnessScore(updatedEntry);
          }
          return updatedEntry;
        }
        return entry;
      });

      
      return {
        entries: updatedEntries,
        todayEntry: updatedEntries.find(entry => entry.date === new Date().toISOString().split('T')[0]) || null,
      };
    });
    
    // Calculate and update stats after setting entries
    const updatedStats = get().calculateStats();
    set({ stats: updatedStats });
  },

  getEntryByDate: (date) => {
    return get().entries.find(entry => entry.date === date) || null;
  },

  calculateWellnessScore,

  calculateStats: () => {
    const { entries } = get();
    const today = new Date().toISOString().split('T')[0];
    const sortedEntries = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate current streak
    let currentStreak = 0;
    let currentDate = new Date();
    
    for (let i = 0; i < 30; i++) { // Check last 30 days
      const dateStr = currentDate.toISOString().split('T')[0];
      const entry = entries.find(e => e.date === dateStr);
      
      if (entry) {
        currentStreak++;
        currentDate.setDate(currentDate.getDate() - 1);
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

    // Calculate averages
    const totalScore = entries.reduce((sum, entry) => sum + entry.wellnessScore, 0);
    const averageScore = entries.length > 0 ? totalScore / entries.length : 0;

    // Weekly average (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklyEntries = entries.filter(entry => new Date(entry.date) >= weekAgo);
    const weeklyScore = weeklyEntries.reduce((sum, entry) => sum + entry.wellnessScore, 0);
    const weeklyAverage = weeklyEntries.length > 0 ? weeklyScore / weeklyEntries.length : 0;

    const stats: WellnessStats = {
      currentStreak,
      longestStreak,
      averageScore: Math.round(averageScore * 10) / 10,
      totalEntries: entries.length,
      weeklyAverage: Math.round(weeklyAverage * 10) / 10,
    };

    set({ stats });
    return stats;
  },

  getWeeklyEntries: () => {
    const { entries } = get();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return entries.filter(entry => new Date(entry.date) >= weekAgo);
  },

  getMonthlyEntries: () => {
    const { entries } = get();
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return entries.filter(entry => new Date(entry.date) >= monthAgo);
  },

  loadEntries: async () => {
    const user = getCurrentUser();
    if (!user) return;

    try {
      // Use smart caching for wellness data
      const wellnessData = await cache.getOrFetch(
        CACHE_CONFIGS.WELLNESS_DATA,
        async () => {
          console.log('🔄 Loading fresh wellness entries...');
          const firebaseEntries = await getWellnessEntries(user.uid);
          
          // Convert Firebase entries to local format
          const entries: WellnessEntry[] = firebaseEntries.map(entry => ({
            id: entry.id || '',
            date: entry.created_at.toDate().toISOString().split('T')[0],
            mood: entry.mood,
            sleep: entry.sleep_hours,
            exercise: entry.exercise_minutes,
            nutrition: 5, // Default value since not in Firebase
            water: 4, // Default value since not in Firebase
            social: 5, // Default value since not in Firebase
            academic: entry.stress_level,
            notes: entry.notes,
            wellnessScore: calculateWellnessScore({
              date: entry.created_at.toDate().toISOString().split('T')[0],
              mood: entry.mood,
              sleep: entry.sleep_hours,
              exercise: entry.exercise_minutes,
              nutrition: 5,
              water: 4,
              social: 5,
              academic: entry.stress_level,
              notes: entry.notes,
            }),
          }));

          const today = new Date().toISOString().split('T')[0];
          const todayEntry = entries.find(entry => entry.date === today) || null;
          
          return { entries, todayEntry };
        },
        user.uid
      );

      // Set the data from cache or fresh fetch
      set({ entries: wellnessData.entries, todayEntry: wellnessData.todayEntry });
      
      // Calculate and update stats
      const stats = get().calculateStats();
      set({ stats });
      
      console.log('📦 Loaded wellness data', { 
        entriesCount: wellnessData.entries.length, 
        hasTodayEntry: !!wellnessData.todayEntry 
      });
    } catch (error) {
      console.error('Failed to load wellness entries:', error);
    }
  },
})); 