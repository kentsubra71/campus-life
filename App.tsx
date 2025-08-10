import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { StudentNavigator } from './src/navigation/StudentNavigator';
import { ParentNavigator } from './src/navigation/ParentNavigator';
import { useAuthStore } from './src/stores/authStore';
import { supabase } from './src/lib/supabase';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { Theme, darkTheme } from './src/constants/themes';

const AppContent = () => {
  const { user, userType, setUser, setUserType } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const { theme } = useTheme();

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      if (session) {
        setUser(session.user);
        // Get user type from profile
        fetchUserProfile(session.user.id);
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event: any, session: any) => {
        if (session) {
          setUser(session.user);
          await fetchUserProfile(session.user.id);
        } else {
          setUser(null);
          setUserType(null as any);
        }
        setIsLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
      } else if (data) {
        setUserType(data.user_type);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const handleLoginSuccess = () => {
    // Auth state will be updated by the listener
  };

  const styles = createStyles(theme);

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading CampusLife...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  const navigationTheme = {
    dark: theme === darkTheme,
    colors: {
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.card,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.primary,
    },
  };

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navigationTheme}>
        {!user ? (
          <AuthNavigator onLoginSuccess={handleLoginSuccess} />
        ) : userType === 'student' ? (
          <StudentNavigator />
        ) : userType === 'parent' ? (
          <ParentNavigator />
        ) : (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading user profile...</Text>
          </View>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
});
