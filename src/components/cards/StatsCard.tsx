import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../styles/theme';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: string;
  icon?: string;
  size?: 'small' | 'medium' | 'large';
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  color = theme.colors.primary,
  icon,
  size = 'medium'
}) => {
  const getTrendColor = () => {
    switch (trend) {
      case 'up': return theme.colors.success;
      case 'down': return theme.colors.error;
      default: return theme.colors.textSecondary;
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return '↗';
      case 'down': return '↘';
      default: return '→';
    }
  };

  const sizeStyles = {
    small: styles.small,
    medium: styles.medium,
    large: styles.large,
  };

  return (
    <View style={[styles.container, sizeStyles[size]]}>
      {icon && (
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
      )}
      
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.value, { color }]}>{value}</Text>
        
        {subtitle && (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}
        
        {trend && trendValue && (
          <View style={styles.trendContainer}>
            <Text style={[styles.trendText, { color: getTrendColor() }]}>
              {getTrendIcon()} {trendValue}
            </Text>
          </View>
        )}
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
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    marginBottom: 12,
  },
  small: {
    padding: 16,
  },
  medium: {
    padding: 20,
  },
  large: {
    padding: 24,
  },
  iconContainer: {
    marginBottom: 12,
  },
  icon: {
    fontSize: 24,
  },
  content: {
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    marginVertical: 4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.textTertiary,
    lineHeight: 18,
  },
  trendContainer: {
    marginTop: 8,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});