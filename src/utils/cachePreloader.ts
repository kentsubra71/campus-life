import { cache, CACHE_CONFIGS } from './universalCache';

/**
 * Preload essential data to improve app performance
 */
export class CachePreloader {
  
  /**
   * Preload critical user data after authentication
   */
  static async preloadUserData(userId: string): Promise<void> {
    console.log('🚀 Starting cache preloader for user:', userId);
    
    try {
      const preloadTasks = [
        // Preload family members (most commonly accessed)
        cache.prefetch(
          CACHE_CONFIGS.FAMILY_MEMBERS,
          async () => {
            const { getFamilyMembers } = await import('../lib/firebase');
            const { getUserProfile } = await import('../lib/firebase');
            
            const profile = await getUserProfile(userId);
            if (profile?.family_id) {
              const { parents, students } = await getFamilyMembers(profile.family_id);
              return { parents, students };
            }
            return { parents: [], students: [] };
          },
          userId
        ),

        // Preload user preferences
        cache.prefetch(
          CACHE_CONFIGS.USER_PREFERENCES,
          async () => {
            const { doc, getDoc } = await import('firebase/firestore');
            const { db } = await import('../lib/firebase');
            
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              return {
                notificationPreferences: userData.notificationPreferences || {},
                theme: userData.theme || 'dark',
                language: userData.language || 'en'
              };
            }
            return { notificationPreferences: {}, theme: 'dark', language: 'en' };
          },
          userId
        ),

        // Preload email verification status
        cache.prefetch(
          CACHE_CONFIGS.EMAIL_VERIFICATION_STATUS,
          async () => {
            const { doc, getDoc } = await import('firebase/firestore');
            const { db } = await import('../lib/firebase');
            
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              return userData.email_verified ?? false;
            }
            return false;
          },
          userId
        )
      ];

      // Execute all preload tasks in parallel
      await Promise.allSettled(preloadTasks);
      console.log('✅ Cache preloader completed successfully');
      
    } catch (error) {
      console.error('❌ Cache preloader failed:', error);
    }
  }

  /**
   * Preload student-specific data
   */
  static async preloadStudentData(userId: string): Promise<void> {
    try {
      await cache.prefetch(
        CACHE_CONFIGS.WELLNESS_DATA,
        async () => {
          const { getWellnessEntries } = await import('../lib/firebase');
          return await getWellnessEntries(userId, 30); // Last 30 entries
        },
        userId
      );
      
      console.log('✅ Student data preloaded');
    } catch (error) {
      console.error('❌ Student data preload failed:', error);
    }
  }

  /**
   * Preload parent-specific data
   */
  static async preloadParentData(userId: string): Promise<void> {
    try {
      await cache.prefetch(
        CACHE_CONFIGS.ACTIVITY_HISTORY,
        async () => {
          // Mock activity data - replace with actual activity fetch
          return [];
        },
        userId
      );
      
      console.log('✅ Parent data preloaded');
    } catch (error) {
      console.error('❌ Parent data preload failed:', error);
    }
  }

  /**
   * Clear cache for a user (useful for logout)
   */
  static async clearUserCache(userId: string): Promise<void> {
    try {
      await cache.clearUserCaches(userId);
      console.log('🗑️ User cache cleared for:', userId);
    } catch (error) {
      console.error('❌ Failed to clear user cache:', error);
    }
  }

  /**
   * Get cache health report
   */
  static async getCacheReport(): Promise<{
    totalItems: number;
    totalSize: string;
    oldestCache: string;
    healthScore: number;
  }> {
    try {
      const stats = await cache.getStats();
      const totalSizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);
      
      // Find oldest cache
      let oldestAge = 0;
      let oldestKey = 'None';
      
      for (const config of Object.values(CACHE_CONFIGS)) {
        // This is a simplified calculation - in production you'd check actual timestamps
        oldestAge = Math.max(oldestAge, config.expiryMinutes);
        oldestKey = config.key;
      }
      
      // Calculate health score (0-100)
      const healthScore = Math.min(100, Math.max(0, 100 - (stats.totalCaches * 2))); // Rough estimate based on cache count
      
      return {
        totalItems: stats.totalCaches,
        totalSize: `${totalSizeMB} MB`,
        oldestCache: `${oldestKey} (up to ${oldestAge}min)`,
        healthScore
      };
    } catch (error) {
      console.error('❌ Failed to get cache report:', error);
      return {
        totalItems: 0,
        totalSize: '0 MB',
        oldestCache: 'None',
        healthScore: 100
      };
    }
  }
}