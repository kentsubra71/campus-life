import { create } from 'zustand';

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

  addEntry: (entryData) => {
    const wellnessScore = calculateWellnessScore(entryData);
    const newEntry: WellnessEntry = {
      ...entryData,
      id: `entry-${Date.now()}`,
      wellnessScore,
    };

    set((state) => ({
      entries: [...state.entries, newEntry],
      todayEntry: newEntry,
    }));
    
    // Calculate and update stats after setting entries
    const updatedStats = get().calculateStats();
    set({ stats: updatedStats });
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
    // This would typically load from storage or API
    // For now, just ensure stats are calculated based on current entries
    const stats = get().calculateStats();
    const today = new Date().toISOString().split('T')[0];
    const todayEntry = get().entries.find(entry => entry.date === today) || null;
    set({ stats, todayEntry });
  },
})); 