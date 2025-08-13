import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../../styles/theme';

interface HeroCardProps {
  title: string;
  subtitle?: string;
  content?: string;
  actionText?: string;
  onPress?: () => void;
  backgroundColor?: string;
  textColor?: string;
  children?: React.ReactNode;
}

export const HeroCard: React.FC<HeroCardProps> = ({
  title,
  subtitle,
  content,
  actionText,
  onPress,
  backgroundColor = '#ffffff',
  textColor = theme.colors.textPrimary,
  children
}) => {
  const CardComponent = onPress ? TouchableOpacity : View;
  
  return (
    <CardComponent 
      style={[styles.container, { backgroundColor }]} 
      onPress={onPress}
      activeOpacity={onPress ? 0.95 : 1}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: textColor }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: textColor === theme.colors.textPrimary ? theme.colors.textSecondary : 'rgba(255,255,255,0.8)' }]}>
            {subtitle}
          </Text>
        )}
        {content && (
          <Text style={[styles.bodyText, { color: textColor === theme.colors.textPrimary ? theme.colors.textTertiary : 'rgba(255,255,255,0.9)' }]}>
            {content}
          </Text>
        )}
        {children}
        {actionText && (
          <View style={styles.actionContainer}>
            <Text style={[styles.actionText, { color: theme.colors.primary }]}>
              {actionText} →
            </Text>
          </View>
        )}
      </View>
    </CardComponent>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 40,
    elevation: 16,
  },
  content: {
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  bodyText: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
  },
  actionContainer: {
    marginTop: 8,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});