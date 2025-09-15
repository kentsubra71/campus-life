export const theme = {
  colors: {
    // Background colors - Modern light theme
    background: '#f8fafc',
    backgroundSecondary: '#ffffff',
    backgroundTertiary: '#f1f5f9',
    backgroundCard: '#ffffff',
    backgroundAuth: '#0f0f23',
    
    // Text colors - Dark text on light backgrounds
    textPrimary: '#1e293b',
    textSecondary: '#64748b',
    textTertiary: '#94a3b8',
    textMuted: '#cbd5e1',
    text: '#1e293b', // Default text color (alias for textPrimary)
    
    // Border colors - Light theme borders
    border: '#e2e8f0',
    borderSecondary: '#cbd5e1',
    borderAccent: '#3b82f6',
    
    // Accent colors - More subtle blues and grays
    primary: '#60a5fa',        // Lighter blue (was #3b82f6)
    primaryDark: '#3b82f6',    // Medium blue
    secondary: '#e0e7ff',      // Very light blue
    secondaryDark: '#c7d2fe',  // Light blue
    
    // Status colors
    success: '#10b981',
    warning: '#f59e0b',
    error: '#dc2626',
    info: '#3b82f6',
    
    // Interactive states
    buttonPrimary: '#3b82f6',
    buttonSecondary: '#22c55e',
    buttonBackground: 'rgba(255, 255, 255, 0.15)',
    
    // Overlay
    overlay: 'rgba(0, 0, 0, 0.3)',
  },
  
  typography: {
    // Title styles
    titleLarge: {
      fontSize: 32,
      fontWeight: '900' as const,
      color: '#1e293b',
      letterSpacing: -1,
    },
    titleMedium: {
      fontSize: 24,
      fontWeight: '800' as const,
      color: '#1e293b',
    },
    titleSmall: {
      fontSize: 20,
      fontWeight: '700' as const,
      color: '#1e293b',
    },
    
    // Heading styles
    headingLarge: {
      fontSize: 28,
      fontWeight: '800' as const,
      color: '#1e293b',
    },
    headingMedium: {
      fontSize: 20,
      fontWeight: '700' as const,
      color: '#1e293b',
    },
    headingSmall: {
      fontSize: 18,
      fontWeight: '600' as const,
      color: '#1e293b',
    },

    // Subtitle styles
    subtitleLarge: {
      fontSize: 18,
      fontWeight: '700' as const,
      color: '#1e293b',
    },
    subtitleMedium: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: '#64748b',
    },
    subtitleSmall: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: '#64748b',
    },
    
    // Body text
    bodyLarge: {
      fontSize: 18,
      fontWeight: '600' as const,
      color: '#1e293b',
    },
    bodyMedium: {
      fontSize: 16,
      fontWeight: '500' as const,
      color: '#475569',
    },
    bodySmall: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: '#475569',
    },
    
    // Label and caption
    label: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: '#9ca3af',
    },
    caption: {
      fontSize: 12,
      fontWeight: '500' as const,
      color: '#9ca3af',
    },
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    huge: 40,
    massive: 60,
  },
  
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
  
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 8,
    },
  },
  
  layout: {
    headerPadding: {
      paddingTop: 60,
      paddingHorizontal: 24,
      paddingBottom: 20,
    },
    screenPadding: {
      padding: 24,
    },
    cardPadding: {
      padding: 16,
    },
    containerPadding: {
      paddingHorizontal: 20,
    },
  },
}

export type Theme = typeof theme