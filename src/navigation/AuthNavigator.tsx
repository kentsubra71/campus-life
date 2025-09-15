import React, { useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RoleSelectionScreen } from '../screens/auth/RoleSelectionScreen';

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
          {(props) => (
            <LoginScreen
              {...(props as any)}
              onNavigateToRegister={handleNavigateToRegister}
              onLoginSuccess={onLoginSuccess}
            />
          )}
        </Stack.Screen>
      ) : (
        <Stack.Screen name="Register">
          {(props) => (
            <RoleSelectionScreen
              {...props}
            />
          )}
        </Stack.Screen>
      )}
    </Stack.Navigator>
  );
}; 