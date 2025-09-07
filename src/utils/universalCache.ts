import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CacheConfig {
  expiryMinutes: number;
  key: string;
  version?: number;
}

export interface CachedData<T = any> {
  data: T;
  timestamp: string;
  version: number;
}

export const CACHE_CONFIGS = {
  ACTIVITY_HISTORY: { expiryMinutes: 60, key: 'activity_history', version: 1 },
  DASHBOARD_DATA: { expiryMinutes: 30, key: 'dashboard_data', version: 1 },
  FAMILY_MEMBERS: { expiryMinutes: 120, key: 'family_members', version: 1 },
  STUDENT_NAMES: { expiryMinutes: 240, key: 'student_names', version: 1 },
  PAYMENT_PROVIDERS: { expiryMinutes: 1440, key: 'payment_providers', version: 1 }, // 24 hours
  WELLNESS_DATA: { expiryMinutes: 525600, key: 'wellness_data', version: 2 }, // 1 year (essentially forever)
  MESSAGE_THREADS: { expiryMinutes: 10, key: 'message_threads', version: 1 },
  SPENDING_CAPS: { expiryMinutes: 30, key: 'spending_caps', version: 1 },
  USER_PREFERENCES: { expiryMinutes: 120, key: 'user_preferences', version: 1 },
  USER_PROFILE: { expiryMinutes: 240, key: 'user_profile', version: 1 }, // 4 hours
  EMAIL_VERIFICATION_STATUS: { expiryMinutes: 60, key: 'email_verification', version: 1 },
  FAMILY_DATA: { expiryMinutes: 180, key: 'family_data', version: 1 }, // 3 hours
} as const;

/**
 * Universal cache manager for all app data
 */
class UniversalCacheManager {
  private readonly PREFIX = 'campuslife_cache_v2';

  /**
   * Generate cache key for user-specific data
   */
  private getCacheKey(config: CacheConfig, userId?: string): string {
    const baseKey = `${this.PREFIX}_${config.key}_v${config.version || 1}`;
    return userId ? `${baseKey}_${userId}` : baseKey;
  }

  /**
   * Check if cached data is expired
   */
  private isExpired(timestamp: string, expiryMinutes: number): boolean {
    const cached = new Date(timestamp);
    const now = new Date();
    const diffMinutes = (now.getTime() - cached.getTime()) / (1000 * 60);
    return diffMinutes > expiryMinutes;
  }

  /**
   * Get cached data if it exists and is not expired
   */
  async get<T>(config: CacheConfig, userId?: string): Promise<T | null> {
    try {
      const cacheKey = this.getCacheKey(config, userId);
      const cachedStr = await AsyncStorage.getItem(cacheKey);
      
      if (!cachedStr) {
        console.log(`📦 No cache found for ${config.key}`);
        return null;
      }

      const cached: CachedData<T> = JSON.parse(cachedStr);
      
      // Check version compatibility
      if (cached.version !== (config.version || 1)) {
        console.log(`🔄 Cache version mismatch for ${config.key}, clearing...`);
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }

      // Check expiry
      if (this.isExpired(cached.timestamp, config.expiryMinutes)) {
        const age = Math.round((new Date().getTime() - new Date(cached.timestamp).getTime()) / (1000 * 60));
        console.log(`⏰ Cache expired for ${config.key} (${age}min old)`);
        return null;
      }

      const age = Math.round((new Date().getTime() - new Date(cached.timestamp).getTime()) / (1000 * 60));
      console.log(`✅ Cache hit for ${config.key} (${age}min old)`);
      return cached.data;

    } catch (error) {
      console.error(`❌ Error reading cache for ${config.key}:`, error);
      return null;
    }
  }

  /**
   * Cache data with timestamp and version
   */
  async set<T>(config: CacheConfig, data: T, userId?: string): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(config, userId);
      const cachedData: CachedData<T> = {
        data,
        timestamp: new Date().toISOString(),
        version: config.version || 1
      };

      await AsyncStorage.setItem(cacheKey, JSON.stringify(cachedData));
      console.log(`💾 Cached data for ${config.key} (${userId || 'global'})`);

    } catch (error) {
      console.error(`❌ Error caching data for ${config.key}:`, error);
      // Don't throw - caching is optional
    }
  }

  /**
   * Update existing cache if it exists (merge operation)
   */
  async update<T extends Record<string, any>>(
    config: CacheConfig, 
    updates: Partial<T>, 
    userId?: string
  ): Promise<void> {
    try {
      const existing = await this.get<T>(config, userId);
      if (existing) {
        const merged = { ...existing, ...updates };
        await this.set(config, merged, userId);
        console.log(`🔄 Updated cache for ${config.key}`);
      }
    } catch (error) {
      console.error(`❌ Error updating cache for ${config.key}:`, error);
    }
  }

  /**
   * Clear specific cache
   */
  async clear(config: CacheConfig, userId?: string): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(config, userId);
      await AsyncStorage.removeItem(cacheKey);
      console.log(`🗑️ Cleared cache for ${config.key}`);
    } catch (error) {
      console.error(`❌ Error clearing cache for ${config.key}:`, error);
    }
  }

  /**
   * Clear all caches for a user (useful for logout)
   */
  async clearUserCaches(userId: string): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const userCacheKeys = keys.filter(key => 
        key.startsWith(this.PREFIX) && key.endsWith(`_${userId}`)
      );
      
      if (userCacheKeys.length > 0) {
        await AsyncStorage.multiRemove(userCacheKeys);
        console.log(`🗑️ Cleared ${userCacheKeys.length} caches for user ${userId}`);
      }
    } catch (error) {
      console.error(`❌ Error clearing user caches:`, error);
    }
  }

  /**
   * Clear all app caches
   */
  async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const appCacheKeys = keys.filter(key => key.startsWith(this.PREFIX));
      
      if (appCacheKeys.length > 0) {
        await AsyncStorage.multiRemove(appCacheKeys);
        console.log(`🗑️ Cleared all app caches (${appCacheKeys.length} keys)`);
      }
    } catch (error) {
      console.error(`❌ Error clearing all caches:`, error);
    }
  }

  /**
   * Get cached data or fetch fresh data and cache it
   */
  async getOrFetch<T>(
    config: CacheConfig, 
    fetchFunction: () => Promise<T>, 
    userId?: string
  ): Promise<T> {
    try {
      // First try to get from cache
      const cachedData = await this.get<T>(config, userId);
      if (cachedData) {
        // Start background refresh if cache is older than half its expiry time
        const cacheKey = this.getCacheKey(config, userId);
        const cachedStr = await AsyncStorage.getItem(cacheKey);
        if (cachedStr) {
          const cached: CachedData<T> = JSON.parse(cachedStr);
          const age = (new Date().getTime() - new Date(cached.timestamp).getTime()) / (1000 * 60);
          const halfExpiry = config.expiryMinutes / 2;
          
          if (age > halfExpiry) {
            // Background refresh
            fetchFunction().then(freshData => {
              this.set(config, freshData, userId);
              console.log(`🔄 Background refreshed cache for ${config.key}`);
            }).catch(error => {
              console.error(`❌ Background refresh failed for ${config.key}:`, error);
            });
          }
        }
        
        return cachedData;
      }

      // Cache miss, fetch fresh data
      const freshData = await fetchFunction();
      await this.set(config, freshData, userId);
      return freshData;
    } catch (error) {
      console.error(`❌ Error in getOrFetch for ${config.key}:`, error);
      // Fallback to direct fetch
      return await fetchFunction();
    }
  }

  /**
   * Prefetch data for better performance
   */
  async prefetch<T>(
    config: CacheConfig, 
    fetchFunction: () => Promise<T>, 
    userId?: string,
    force: boolean = false
  ): Promise<void> {
    try {
      if (!force) {
        const existingData = await this.get<T>(config, userId);
        if (existingData) {
          console.log(`📦 Skipping prefetch for ${config.key} - already cached`);
          return;
        }
      }

      console.log(`🚀 Prefetching data for ${config.key}...`);
      const data = await fetchFunction();
      await this.set(config, data, userId);
      console.log(`✅ Prefetched data for ${config.key}`);
    } catch (error) {
      console.error(`❌ Error prefetching ${config.key}:`, error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalCaches: number;
    totalSize: number;
    cacheBreakdown: { [key: string]: number };
  }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const appCacheKeys = keys.filter(key => key.startsWith(this.PREFIX));
      
      let totalSize = 0;
      const breakdown: { [key: string]: number } = {};

      for (const key of appCacheKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          const size = data ? data.length : 0;
          totalSize += size;
          
          // Extract cache type from key
          const cacheType = key.split('_')[3] || 'unknown';
          breakdown[cacheType] = (breakdown[cacheType] || 0) + size;
        } catch (error) {
          console.warn(`Error reading cache key ${key}:`, error);
        }
      }

      return {
        totalCaches: appCacheKeys.length,
        totalSize,
        cacheBreakdown: breakdown
      };
    } catch (error) {
      console.error('❌ Error getting cache stats:', error);
      return { totalCaches: 0, totalSize: 0, cacheBreakdown: {} };
    }
  }


  /**
   * Smart refresh: show cached data immediately, refresh in background
   */
  async smartRefresh<T>(
    config: CacheConfig,
    fetcher: () => Promise<T>,
    onCached?: (data: T) => void,
    onFresh?: (data: T) => void,
    userId?: string
  ): Promise<T> {
    // Show cached data immediately if available
    const cached = await this.get<T>(config, userId);
    if (cached !== null && onCached) {
      onCached(cached);
    }

    // Fetch fresh data
    try {
      const freshData = await fetcher();
      await this.set(config, freshData, userId);
      
      if (onFresh) {
        onFresh(freshData);
      }
      
      return freshData;
    } catch (error) {
      console.error(`❌ Error refreshing ${config.key}:`, error);
      
      // Return cached data if fresh fetch fails
      if (cached !== null) {
        console.log(`🔄 Using cached data as fallback for ${config.key}`);
        return cached;
      }
      
      throw error;
    }
  }
}

// Export singleton instance
export const cache = new UniversalCacheManager();

// Export convenience functions for common operations
export const getCachedData = <T>(config: CacheConfig, userId?: string) => cache.get<T>(config, userId);
export const setCachedData = <T>(config: CacheConfig, data: T, userId?: string) => cache.set(config, data, userId);
export const clearCache = (config: CacheConfig, userId?: string) => cache.clear(config, userId);
export const getOrFetch = <T>(config: CacheConfig, fetcher: () => Promise<T>, userId?: string) => 
  cache.getOrFetch(config, fetcher, userId);
export const smartRefresh = <T>(
  config: CacheConfig,
  fetcher: () => Promise<T>,
  onCached?: (data: T) => void,
  onFresh?: (data: T) => void,
  userId?: string
) => cache.smartRefresh(config, fetcher, onCached, onFresh, userId);