export const lightTheme = {
  colors: {
    primary: '#3498db',
    primaryDark: '#2980b9',
    secondary: '#007AFF',
    background: '#f5f5f5',
    surface: '#ffffff',
    card: '#ffffff',
    text: '#2c3e50',
    textSecondary: '#7f8c8d',
    textLight: '#6c757d',
    textMuted: '#bdc3c7',
    border: '#e9ecef',
    borderLight: '#e1e8ed',
    disabled: '#bdc3c7',
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
    shadow: '#000000',
    tabBarActive: '#6366f1',
    tabBarInactive: '#9ca3af',
  },
};

export const darkTheme = {
  colors: {
    primary: '#4FC3F7',
    primaryDark: '#29B6F6',
    secondary: '#42A5F5',
    background: '#121212',
    surface: '#1E1E1E',
    card: '#2C2C2C',
    text: '#FFFFFF',
    textSecondary: '#B3B3B3',
    textLight: '#9E9E9E',
    textMuted: '#757575',
    border: '#404040',
    borderLight: '#333333',
    disabled: '#555555',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    shadow: '#000000',
    tabBarActive: '#7C4DFF',
    tabBarInactive: '#757575',
  },
};

export type Theme = typeof lightTheme;