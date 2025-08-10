import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const RewardsScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>CampusLife - Rewards</Text>
      <Text style={styles.subtitle}>Coming soon...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
  },
}); 