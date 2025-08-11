import 'whatwg-fetch'; // Add fetch polyfill for better compatibility
import React, { useEffect } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createStackNavigator } from '@react-navigation/stack';
import { StudentNavigator } from './src/navigation/StudentNavigator';
import { ParentNavigator } from './src/navigation/ParentNavigator';
import { useAuthStore } from './src/stores/authStore';
import { View, Text, ActivityIndicator, StyleSheet, StatusBar, Alert } from 'react-native';
import * as Linking from 'expo-linking';

// Auth screens
import { RoleSelectionScreen } from './src/screens/auth/RoleSelectionScreen';
import { ParentRegisterScreen } from './src/screens/auth/ParentRegisterScreen';
import { StudentRegisterScreen } from './src/screens/auth/StudentRegisterScreen';
import { LoginScreen } from './src/screens/auth/LoginScreen';

const Stack = createStackNavigator();

export default function App() {
  const { isAuthenticated, user, isLoading, refreshUser } = useAuthStore();

  // Handle deep links for email verification
  useEffect(() => {
    const handleDeepLink = (url: string) => {
      console.log('Deep link received:', url);
      
      if (url.includes('campuslife://verified')) {
        Alert.alert(
          'Email Verified! 🎉',
          'Your email has been successfully verified. Welcome to Campus Life!',
          [{ text: 'Continue', style: 'default' }]
        );
        
        // Refresh user data to update verification status
        if (user) {
          refreshUser();
        }
      } else if (url.includes('campuslife://verification-failed')) {
        Alert.alert(
          'Verification Failed',
          'Email verification failed. Please try requesting a new verification email.',
          [
            { text: 'OK', style: 'default' },
            { text: 'Resend Email', style: 'default', onPress: handleResendVerification }
          ]
        );
      }
    };

    const handleResendVerification = async () => {
      if (user) {
        try {
          const { resendVerificationEmail } = await import('./src/lib/emailVerification');
          const result = await resendVerificationEmail(user.uid);
          
          if (result.success) {
            Alert.alert('Email Sent', 'A new verification email has been sent to your email address.');
          } else {
            Alert.alert('Error', result.error || 'Failed to send verification email.');
          }
        } catch (error: any) {
          Alert.alert('Error', 'Failed to resend verification email.');
        }
      }
    };

    // Handle app opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    // Handle deep links when app is running
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => subscription?.remove();
  }, [user, refreshUser]);

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

  const AuthStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ParentRegister" component={ParentRegisterScreen} />
      <Stack.Screen name="StudentRegister" component={StudentRegisterScreen} />
    </Stack.Navigator>
  );

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#111827" />
      <NavigationContainer theme={customDarkTheme}>
        {!isAuthenticated ? (
          <AuthStack />
        ) : user?.role === 'student' ? (
          <StudentNavigator />
        ) : user?.role === 'parent' ? (
          <ParentNavigator />
        ) : (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading user profile...</Text>
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
    backgroundColor: '#111827',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#9ca3af',
  },
});
