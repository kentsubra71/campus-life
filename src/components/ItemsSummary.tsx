import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../styles/theme';

interface ItemsSummaryProps {
  onViewAll: () => void;
  userType: 'student' | 'parent';
}

export const ItemsSummary: React.FC<ItemsSummaryProps> = ({ onViewAll, userType }) => {
  // Temporarily disabled - item requests removed for launch
  return null;
};

const styles = StyleSheet.create({
  // Empty styles
});