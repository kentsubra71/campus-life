import { create } from 'zustand';

interface WellnessData {
  score: number;
  sleep: number;
  meals: number;
  exercise: number;
  sleepStreak: number;
  mealStreak: number;
  exerciseStreak: number;
}

interface WellnessState {
  wellness: WellnessData;
  fetchTodayWellness: () => Promise<void>;
  updateWellness: (data: Partial<WellnessData>) => void;
}

export const useWellnessStore = create<WellnessState>((set, get) => ({
  wellness: {
    score: 85,
    sleep: 7.5,
    meals: 3,
    exercise: 30,
    sleepStreak: 5,
    mealStreak: 3,
    exerciseStreak: 2,
  },
  
  fetchTodayWellness: async () => {
    // TODO: Fetch from Supabase
    // For now, using mock data
    const mockWellness: WellnessData = {
      score: 85,
      sleep: 7.5,
      meals: 3,
      exercise: 30,
      sleepStreak: 5,
      mealStreak: 3,
      exerciseStreak: 2,
    };
    
    set({ wellness: mockWellness });
  },
  
  updateWellness: (data) => {
    const current = get().wellness;
    const updated = { ...current, ...data };
    
    // Recalculate score
    const sleepScore = Math.min((updated.sleep / 8) * 30, 30);
    const mealScore = Math.min((updated.meals / 3) * 30, 30);
    const exerciseScore = Math.min((updated.exercise / 30) * 40, 40);
    
    updated.score = Math.round(sleepScore + mealScore + exerciseScore);
    
    set({ wellness: updated });
  },
})); 