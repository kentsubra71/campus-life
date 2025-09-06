import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

/**
 * Shows an alert with network-aware error messages
 * If offline, shows a network connectivity message instead of the original error
 */
export const showNetworkAwareAlert = async (
  title: string,
  message: string,
  buttons?: any[]
) => {
  try {
    const netInfo = await NetInfo.fetch();
    const isOnline = netInfo.isConnected && netInfo.isInternetReachable;
    
    if (!isOnline) {
      Alert.alert(
        'No Internet Connection',
        'Please check your internet connection and try again.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }
    
    // Show original alert if online
    Alert.alert(title, message, buttons);
  } catch (error) {
    // Fallback to original alert if network check fails
    Alert.alert(title, message, buttons);
  }
};

/**
 * Checks if device is online before executing a function
 * Shows offline alert if not connected
 */
export const withNetworkCheck = async (
  action: () => Promise<void> | void,
  offlineMessage?: string
): Promise<boolean> => {
  try {
    const netInfo = await NetInfo.fetch();
    const isOnline = netInfo.isConnected && netInfo.isInternetReachable;
    
    if (!isOnline) {
      Alert.alert(
        'No Internet Connection',
        offlineMessage || 'This action requires an internet connection. Please check your connection and try again.',
        [{ text: 'OK', style: 'default' }]
      );
      return false;
    }
    
    await action();
    return true;
  } catch (error) {
    console.error('Network check failed:', error);
    // Continue with action if network check fails
    await action();
    return true;
  }
};

/**
 * Get user-friendly network error message
 */
export const getNetworkErrorMessage = async (originalError: string): Promise<string> => {
  try {
    const netInfo = await NetInfo.fetch();
    const isOnline = netInfo.isConnected && netInfo.isInternetReachable;
    
    if (!isOnline) {
      return 'No internet connection. Please check your network settings.';
    }
    
    return originalError;
  } catch (error) {
    return originalError;
  }
};