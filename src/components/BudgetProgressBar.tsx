import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../styles/theme';

interface BudgetProgressBarProps {
  spent: number;
  budget: number;
  title?: string;
}

export const BudgetProgressBar: React.FC<BudgetProgressBarProps> = ({
  spent = 0,
  budget = 50,
  title = "Monthly Budget"
}) => {
  const remaining = Math.max(0, budget - spent);
  const percentage = Math.min(100, (spent / budget) * 100);
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.amount}>${remaining} left</Text>
      </View>
      
      <View style={styles.progressBar}>
        <View 
          style={[
            styles.progressFill, 
            { width: `${percentage}%` }
          ]} 
        />
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.detail}>
          ${spent} of ${budget} used
        </Text>
        <Text style={styles.percentage}>
          {Math.round(percentage)}%
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amount: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.success,
  },
  progressBar: {
    height: 8,
    backgroundColor: theme.colors.backgroundTertiary,
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detail: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textTertiary,
  },
  percentage: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
});