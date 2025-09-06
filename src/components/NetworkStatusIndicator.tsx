import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../styles/theme';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface NetworkStatusIndicatorProps {
  position?: 'top' | 'bottom';
}

export const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({ 
  position = 'top' 
}) => {
  const { isConnected, isInternetReachable, type } = useNetworkStatus();
  const [showBanner, setShowBanner] = useState(false);
  
  const fullyConnected = isConnected && isInternetReachable;

  useEffect(() => {
    // Show banner when disconnected, hide after 3 seconds when reconnected
    if (!fullyConnected) {
      setShowBanner(true);
    } else if (fullyConnected && showBanner) {
      setTimeout(() => setShowBanner(false), 3000);
    }
  }, [fullyConnected, showBanner]);

  // Don't render if connected (and banner should be hidden)
  if (fullyConnected && !showBanner) {
    return null;
  }

  return (
    <View style={[
      styles.container, 
      position === 'top' ? styles.top : styles.bottom,
      fullyConnected ? styles.connected : styles.disconnected
    ]}>
      <Text style={styles.text}>
        {fullyConnected ? '✅ Connected' : '⚠️ No internet connection'}
      </Text>
      {!fullyConnected && (
        <Text style={styles.subtitle}>
          Check your {type === 'wifi' ? 'wifi' : 'cellular data'} connection
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    zIndex: 9999,
    position: 'absolute',
    left: 0,
    right: 0,
  },
  top: {
    top: 0,
  },
  bottom: {
    bottom: 0,
  },
  disconnected: {
    backgroundColor: '#DC2626',
  },
  connected: {
    backgroundColor: '#10B981',
  },
  text: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    color: 'white',
    fontSize: 12,
    opacity: 0.9,
    textAlign: 'center',
    marginTop: 2,
  },
});