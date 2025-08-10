import React, { useEffect, useState } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { StudentNavigator } from './src/navigation/StudentNavigator';
import { ParentNavigator } from './src/navigation/ParentNavigator';
import { useAuthStore } from './src/stores/authStore';
import { supabase } from './src/lib/supabase';
import { View, Text, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import FlashMessage from 'react-native-flash-message';

export default function App() {
  const { user, userType, setUser, setUserType } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        // Get user type from profile
        fetchUserProfile(session.user.id);
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session) {
          setUser(session.user);
          await fetchUserProfile(session.user.id);
        } else {
          setUser(null);
          setUserType(null);
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

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#111827" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading CampusLife...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  const customDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: '#6366f1',
      background: '#111827',
      card: '#1f2937',
      text: '#f9fafb',
      border: '#374151',
    },
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#111827" />
      <NavigationContainer theme={customDarkTheme}>
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
      <FlashMessage 
        position="top"
        style={{ backgroundColor: '#1f2937' }}
        titleStyle={{ color: '#f9fafb', fontSize: 16, fontWeight: '600' }}
        textStyle={{ color: '#9ca3af', fontSize: 14 }}
      />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#9ca3af',
  },
});
