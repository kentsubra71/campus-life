import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

// FIXED: Secure XP reward system using Cloud Functions
export class XPRewards {
  private static awardXPForAction = httpsCallable(functions, 'awardXPForAction');

  // Award XP for wellness logging
  static async awardWellnessXP(userId: string, isFirstEntry: boolean = false) {
    try {
      const action = isFirstEntry ? 'first_wellness' : 'wellness_logged';
      const result = await this.awardXPForAction({ userId, action });
      return result;
    } catch (error) {
      console.error('Failed to award wellness XP:', error);
      return null;
    }
  }

  // Award XP for streak achievements
  static async awardStreakXP(userId: string, streakDays: number) {
    try {
      let action: string;
      if (streakDays === 3) action = 'streak_3_days';
      else if (streakDays === 7) action = 'streak_7_days';
      else if (streakDays === 30) action = 'streak_30_days';
      else return null; // No reward for this streak length

      const result = await this.awardXPForAction({ userId, action });
      return result;
    } catch (error) {
      console.error('Failed to award streak XP:', error);
      return null;
    }
  }

  // Award XP for profile completion
  static async awardProfileCompletionXP(userId: string) {
    try {
      const result = await this.awardXPForAction({ 
        userId, 
        action: 'profile_complete' 
      });
      return result;
    } catch (error) {
      console.error('Failed to award profile completion XP:', error);
      return null;
    }
  }

  // Award XP for joining family
  static async awardFamilyJoinXP(userId: string) {
    try {
      const result = await this.awardXPForAction({ 
        userId, 
        action: 'family_joined' 
      });
      return result;
    } catch (error) {
      console.error('Failed to award family join XP:', error);
      return null;
    }
  }
}