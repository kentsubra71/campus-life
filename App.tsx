import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { StudentNavigator } from './src/navigation/StudentNavigator';
import { ParentNavigator } from './src/navigation/ParentNavigator';
import { useAuthStore } from './src/stores/authStore';
import { supabase } from './src/lib/supabase';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Loading CampusLife...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {!user ? (
          <AuthNavigator onLoginSuccess={handleLoginSuccess} />
        ) : userType === 'student' ? (
          <StudentNavigator />
        ) : userType === 'parent' ? (
          <ParentNavigator />
        ) : (
          <View style={styles.loadingContainer}>
            <Text>Loading user profile...</Text>
          </View>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#7f8c8d',
  },
});
