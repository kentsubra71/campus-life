import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Theme } from '../constants/themes';

export const ThemeToggle: React.FC = () => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const styles = createStyles(theme);

  return (
    <TouchableOpacity style={styles.container} onPress={toggleTheme}>
      <View style={styles.content}>
        <MaterialIcons 
          name={isDarkMode ? 'light-mode' : 'dark-mode'} 
          size={24} 
          color={theme.colors.text} 
        />
        <Text style={styles.label}>
          {isDarkMode ? 'Light Mode' : 'Dark Mode'}
        </Text>
        <View style={styles.switchContainer}>
          <View style={[styles.switch, isDarkMode && styles.switchActive]}>
            <View style={[styles.switchThumb, isDarkMode && styles.switchThumbActive]} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
    marginLeft: 12,
  },
  switchContainer: {
    marginLeft: 'auto',
  },
  switch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchActive: {
    backgroundColor: theme.colors.primary,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  switchThumbActive: {
    transform: [{ translateX: 22 }],
  },
});