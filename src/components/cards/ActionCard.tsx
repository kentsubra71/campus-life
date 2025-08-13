import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { theme } from '../../styles/theme';

interface ActionCardProps {
  title: string;
  subtitle?: string;
  icon: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
}

export const ActionCard: React.FC<ActionCardProps> = ({
  title,
  subtitle,
  icon,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false
}) => {
  const getVariantStyles = () => {
    const variants = {
      primary: {
        backgroundColor: theme.colors.primary,
        textColor: '#ffffff',
      },
      secondary: {
        backgroundColor: '#ffffff',
        textColor: theme.colors.textPrimary,
      },
      success: {
        backgroundColor: theme.colors.success,
        textColor: '#ffffff',
      },
      warning: {
        backgroundColor: theme.colors.warning,
        textColor: '#ffffff',
      },
      outline: {
        backgroundColor: 'transparent',
        textColor: theme.colors.textPrimary,
        borderColor: theme.colors.border,
        borderWidth: 1,
      },
      ghost: {
        backgroundColor: theme.colors.backgroundTertiary,
        textColor: theme.colors.textPrimary,
      },
    };
    return variants[variant];
  };

  const getSizeStyles = () => {
    const sizes = {
      small: styles.small,
      medium: styles.medium,
      large: styles.large,
    };
    return sizes[size];
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <TouchableOpacity
      style={[
        styles.container,
        sizeStyles,
        { backgroundColor: variantStyles.backgroundColor },
        variantStyles.borderWidth && { 
          borderWidth: variantStyles.borderWidth, 
          borderColor: variantStyles.borderColor 
        },
        disabled && styles.disabled
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <View style={styles.iconContainer}>
        <Text style={[styles.icon, { color: variantStyles.textColor }]}>
          {icon}
        </Text>
      </View>
      
      <View style={styles.content}>
        <Text style={[styles.title, { color: variantStyles.textColor }]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[
            styles.subtitle, 
            { color: variantStyles.textColor === '#ffffff' ? 'rgba(255,255,255,0.8)' : theme.colors.textSecondary }
          ]}>
            {subtitle}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 8,
  },
  small: {
    padding: 16,
  },
  medium: {
    padding: 20,
    flex: 1,
    minWidth: 120,
  },
  large: {
    padding: 24,
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  iconContainer: {
    marginRight: 16,
  },
  icon: {
    fontSize: 24,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
});