import { useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Hook that refreshes data when screen comes into focus
 * Helps ensure messages and rewards are always up to date
 */
export const useRefreshOnFocus = (refreshFunction: () => Promise<void> | void) => {
  const refresh = useCallback(() => {
    refreshFunction();
  }, [refreshFunction]);

  useFocusEffect(refresh);
};

/**
 * Hook for periodic refresh (useful for real-time updates)
 */
export const usePeriodicRefresh = (
  refreshFunction: () => Promise<void> | void, 
  intervalMs: number = 30000 // 30 seconds default
) => {
  const refresh = useCallback(() => {
    refreshFunction();
  }, [refreshFunction]);

  useEffect(() => {
    const interval = setInterval(refresh, intervalMs);
    return () => clearInterval(interval);
  }, [refresh, intervalMs]);
};

/**
 * Hook that combines focus refresh and periodic refresh
 */
export const useDataSync = (
  refreshFunction: () => Promise<void> | void,
  options: {
    refreshOnFocus?: boolean;
    periodicRefresh?: boolean;
    intervalMs?: number;
  } = {}
) => {
  const {
    refreshOnFocus = true,
    periodicRefresh = true,
    intervalMs = 30000
  } = options;

  if (refreshOnFocus) {
    useRefreshOnFocus(refreshFunction);
  }

  if (periodicRefresh) {
    usePeriodicRefresh(refreshFunction, intervalMs);
  }
};