import AsyncStorage from '@react-native-async-storage/async-storage';

interface CachedActivity {
  id: string;
  type: 'payment' | 'message';
  timestamp: string; // ISO string
  amount?: number;
  provider?: string;
  status: string;
  note?: string;
  student_name?: string;
  message_content?: string;
  message_type?: string;
}

interface ActivityCacheData {
  activities: CachedActivity[];
  lastUpdated: string; // ISO string
  studentNames: { [studentId: string]: string }; // Cache student names to avoid repeated queries
}

const ACTIVITY_CACHE_KEY = 'activity_history_cache_v1';
const CACHE_EXPIRY_HOURS = 1; // Cache expires after 1 hour

/**
 * Get cached activity data if it exists and is not expired
 */
export const getCachedActivities = async (userId: string): Promise<ActivityCacheData | null> => {
  try {
    const cacheKey = `${ACTIVITY_CACHE_KEY}_${userId}`;
    const cachedData = await AsyncStorage.getItem(cacheKey);
    
    if (!cachedData) {
      console.log('📦 No cached activity data found');
      return null;
    }
    
    const parsed: ActivityCacheData = JSON.parse(cachedData);
    const lastUpdated = new Date(parsed.lastUpdated);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff > CACHE_EXPIRY_HOURS) {
      console.log(`⏰ Activity cache expired (${Math.round(hoursDiff * 100) / 100}h old)`);
      // Don't return expired cache, but don't delete it yet (fallback for network issues)
      return null;
    }
    
    console.log(`✅ Using cached activity data (${Math.round(hoursDiff * 60)} minutes old, ${parsed.activities.length} activities)`);
    return parsed;
    
  } catch (error) {
    console.error('❌ Error reading activity cache:', error);
    return null;
  }
};

/**
 * Save activity data to cache
 */
export const cacheActivities = async (
  userId: string, 
  activities: CachedActivity[], 
  studentNames: { [studentId: string]: string } = {}
): Promise<void> => {
  try {
    const cacheData: ActivityCacheData = {
      activities,
      lastUpdated: new Date().toISOString(),
      studentNames
    };
    
    const cacheKey = `${ACTIVITY_CACHE_KEY}_${userId}`;
    await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
    
    console.log(`💾 Cached ${activities.length} activities for user ${userId}`);
    
  } catch (error) {
    console.error('❌ Error caching activities:', error);
    // Don't throw - caching is optional
  }
};

/**
 * Get cached student name
 */
export const getCachedStudentName = async (userId: string, studentId: string): Promise<string | null> => {
  try {
    const cacheKey = `${ACTIVITY_CACHE_KEY}_${userId}`;
    const cachedData = await AsyncStorage.getItem(cacheKey);
    
    if (cachedData) {
      const parsed: ActivityCacheData = JSON.parse(cachedData);
      return parsed.studentNames[studentId] || null;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error reading student name cache:', error);
    return null;
  }
};

/**
 * Update cached student names
 */
export const updateCachedStudentNames = async (
  userId: string, 
  studentNames: { [studentId: string]: string }
): Promise<void> => {
  try {
    const cacheKey = `${ACTIVITY_CACHE_KEY}_${userId}`;
    const cachedData = await AsyncStorage.getItem(cacheKey);
    
    if (cachedData) {
      const parsed: ActivityCacheData = JSON.parse(cachedData);
      parsed.studentNames = { ...parsed.studentNames, ...studentNames };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(parsed));
      
      console.log(`📝 Updated cached student names for user ${userId}`);
    }
    
  } catch (error) {
    console.error('❌ Error updating student name cache:', error);
  }
};

/**
 * Clear activity cache (useful for logout or data corruption)
 */
export const clearActivityCache = async (userId?: string): Promise<void> => {
  try {
    if (userId) {
      const cacheKey = `${ACTIVITY_CACHE_KEY}_${userId}`;
      await AsyncStorage.removeItem(cacheKey);
      console.log(`🗑️ Cleared activity cache for user ${userId}`);
    } else {
      // Clear all activity caches
      const keys = await AsyncStorage.getAllKeys();
      const activityCacheKeys = keys.filter(key => key.startsWith(ACTIVITY_CACHE_KEY));
      await AsyncStorage.multiRemove(activityCacheKeys);
      console.log(`🗑️ Cleared all activity caches (${activityCacheKeys.length} keys)`);
    }
  } catch (error) {
    console.error('❌ Error clearing activity cache:', error);
  }
};

/**
 * Convert database activity to cacheable format
 */
export const convertToCachedActivity = (activity: any): CachedActivity => {
  return {
    id: activity.id,
    type: activity.type,
    timestamp: activity.timestamp instanceof Date ? activity.timestamp.toISOString() : activity.timestamp,
    amount: activity.amount,
    provider: activity.provider,
    status: activity.status,
    note: activity.note,
    student_name: activity.student_name,
    message_content: activity.message_content,
    message_type: activity.message_type
  };
};

/**
 * Convert cached activity back to display format
 */
export const convertFromCachedActivity = (cached: CachedActivity): any => {
  return {
    ...cached,
    timestamp: new Date(cached.timestamp)
  };
};