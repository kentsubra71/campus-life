import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export interface NetworkStatus {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string | null;
}

export const useNetworkStatus = (): NetworkStatus => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isConnected: true, // Assume connected initially
    isInternetReachable: true,
    type: null,
  });

  useEffect(() => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener(state => {
      console.log(`📡 Network state update:`, {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
        details: state.details,
      });

      setNetworkStatus({
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });
    });

    // Get initial network state
    NetInfo.fetch().then(state => {
      console.log(`📡 Initial network state:`, {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });

      setNetworkStatus({
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });
    });

    return unsubscribe;
  }, []);

  return networkStatus;
};

// Helper function to check if fully connected (both connected and internet reachable)
export const useIsOnline = (): boolean => {
  const { isConnected, isInternetReachable } = useNetworkStatus();
  return Boolean(isConnected && isInternetReachable);
};