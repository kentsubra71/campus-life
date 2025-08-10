import React, { useEffect } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createStackNavigator } from '@react-navigation/stack';
import { StudentNavigator } from './src/navigation/StudentNavigator';
import { ParentNavigator } from './src/navigation/ParentNavigator';
import { useAuthStore } from './src/stores/authStore';
import { View, Text, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';

// Auth screens
import { RoleSelectionScreen } from './src/screens/auth/RoleSelectionScreen';
import { ParentRegisterScreen } from './src/screens/auth/ParentRegisterScreen';
import { StudentRegisterScreen } from './src/screens/auth/StudentRegisterScreen';
import { LoginScreen } from './src/screens/auth/LoginScreen';

const Stack = createStackNavigator();

export default function App() {
  const { isAuthenticated, user, isLoading } = useAuthStore();

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
