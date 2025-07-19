import React, { useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';

const Stack = createStackNavigator();

interface AuthNavigatorProps {
  onLoginSuccess: () => void;
}

export const AuthNavigator: React.FC<AuthNavigatorProps> = ({ onLoginSuccess }) => {
  const [currentScreen, setCurrentScreen] = useState<'login' | 'register'>('login');

  const handleNavigateToRegister = () => {
    setCurrentScreen('register');
  };

  const handleNavigateToLogin = () => {
    setCurrentScreen('login');
  };

  const handleRegisterSuccess = () => {
    setCurrentScreen('login');
  };

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {currentScreen === 'login' ? (
        <Stack.Screen name="Login">
          {() => (
            <LoginScreen
              onNavigateToRegister={handleNavigateToRegister}
              onLoginSuccess={onLoginSuccess}
            />
          )}
        </Stack.Screen>
      ) : (
        <Stack.Screen name="Register">
          {() => (
            <RegisterScreen
              onNavigateToLogin={handleNavigateToLogin}
              onRegisterSuccess={handleRegisterSuccess}
            />
          )}
        </Stack.Screen>
      )}
    </Stack.Navigator>
  );
}; 