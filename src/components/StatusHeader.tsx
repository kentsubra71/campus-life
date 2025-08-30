import React from 'react';
import { View, Text, StyleSheet, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../styles/theme';

interface StatusHeaderProps {
  title: string;
}

export const StatusHeader: React.FC<StatusHeaderProps> = ({ title }) => {
  const insets = useSafeAreaInsets();

  return (
    <>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent={true}
      />
      <View style={[styles.container, { height: insets.top }]} />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
});