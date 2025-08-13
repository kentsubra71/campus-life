import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { theme } from '../../styles/theme';

interface ListCardProps {
  title: string;
  subtitle?: string;
  rightText?: string;
  rightSubtext?: string;
  leftIcon?: string;
  rightIcon?: string;
  onPress?: () => void;
  variant?: 'default' | 'compact' | 'detailed';
  status?: 'active' | 'inactive' | 'warning' | 'success';
}

export const ListCard: React.FC<ListCardProps> = ({
  title,
  subtitle,
  rightText,
  rightSubtext,
  leftIcon,
  rightIcon = '›',
  onPress,
  variant = 'default',
  status
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'active': return theme.colors.success;
      case 'warning': return theme.colors.warning;
      case 'success': return theme.colors.success;
      case 'inactive': return theme.colors.textSecondary;
      default: return 'transparent';
    }
  };

  const getVariantStyles = () => {
    const variants = {
      default: styles.default,
      compact: styles.compact,
      detailed: styles.detailed,
    };
    return variants[variant];
  };

  const CardComponent = onPress ? TouchableOpacity : View;

  return (
    <CardComponent
      style={[styles.container, getVariantStyles()]}
      onPress={onPress}
      activeOpacity={onPress ? 0.95 : 1}
    >
      <View style={styles.leftSection}>
        {leftIcon && (
          <View style={styles.iconContainer}>
            <Text style={styles.leftIcon}>{leftIcon}</Text>
          </View>
        )}
        
        {status && (
          <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
        )}
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && (
            <Text style={styles.subtitle}>{subtitle}</Text>
          )}
        </View>
      </View>

      <View style={styles.rightSection}>
        {(rightText || rightSubtext) && (
          <View style={styles.rightTextContainer}>
            {rightText && (
              <Text style={styles.rightText}>{rightText}</Text>
            )}
            {rightSubtext && (
              <Text style={styles.rightSubtext}>{rightSubtext}</Text>
            )}
          </View>
        )}
        
        {onPress && (
          <Text style={styles.rightIcon}>{rightIcon}</Text>
        )}
      </View>
    </CardComponent>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 8,
  },
  default: {
    padding: 16,
  },
  compact: {
    padding: 12,
  },
  detailed: {
    padding: 20,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    marginRight: 12,
  },
  leftIcon: {
    fontSize: 20,
  },
  statusIndicator: {
    width: 4,
    height: 24,
    borderRadius: 2,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rightTextContainer: {
    alignItems: 'flex-end',
    gap: 2,
  },
  rightText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    lineHeight: 20,
  },
  rightSubtext: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  rightIcon: {
    fontSize: 18,
    color: theme.colors.textSecondary,
    fontWeight: '300',
  },
});