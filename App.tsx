import 'whatwg-fetch'; // Add fetch polyfill for better compatibility
import React, { useEffect, useRef, lazy, Suspense } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuthStore } from './src/stores/authStore';
import { View, Text, ActivityIndicator, StyleSheet, StatusBar, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { theme } from './src/styles/theme';
import { AuthStackParamList } from './src/types/navigation';

// Lazy load heavy navigation components
const StudentNavigator = lazy(() => import('./src/navigation/StudentNavigator').then(m => ({ default: m.StudentNavigator })));
const ParentNavigator = lazy(() => import('./src/navigation/ParentNavigator').then(m => ({ default: m.ParentNavigator })));

// Auth screens
import { RoleSelectionScreen } from './src/screens/auth/RoleSelectionScreen';
import { ParentRegisterScreen } from './src/screens/auth/ParentRegisterScreen';
import { StudentRegisterScreen } from './src/screens/auth/StudentRegisterScreen';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { ForgotPasswordScreen } from './src/screens/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from './src/screens/auth/ResetPasswordScreen';

const Stack = createStackNavigator<AuthStackParamList>();

export default function App() {
  const { isAuthenticated, user, isLoading } = useAuthStore();
  const navigationRef = useRef<any>(null);

  // Handle deep links for email verification and password reset
  useEffect(() => {
    const handleDeepLink = (url: string) => {
      console.log('Deep link received:', url);
      
      if (url.includes('campuslife://verified')) {
        Alert.alert(
          'Email Verified! 🎉',
          'Your email has been successfully verified. Welcome to Campus Life!',
          [{ text: 'Continue', style: 'default' }]
        );
        
        // User data will be updated automatically
      } else if (url.includes('campuslife://verification-failed')) {
        Alert.alert(
          'Verification Failed',
          'Email verification failed. Please try requesting a new verification email.',
          [
            { text: 'OK', style: 'default' },
            { text: 'Resend Email', style: 'default', onPress: handleResendVerification }
          ]
        );
      } else if (url.includes('campuslife://reset-password/')) {
        // Extract token from password reset deep link
        const token = url.split('campuslife://reset-password/')[1];
        if (token && !isAuthenticated && navigationRef.current) {
          // Navigate to ResetPassword screen with token
          navigationRef.current.navigate('ResetPassword', { token });
          console.log('Password reset token received:', token);
        }
      } else if (url.includes('campuslife://pay/')) {
        // Handle payment return/cancel
        console.log('Payment deep link received:', url);
        try {
          const urlParts = url.split('campuslife://pay/')[1];
          const [action, queryString] = urlParts.split('?');
          const params = new URLSearchParams(queryString || '');
          const paymentId = params.get('paymentId');
          
          console.log('Payment deep link parsed:', { action, paymentId, queryString });
          
          if (paymentId) {
            if (!isAuthenticated) {
              console.log('User not authenticated, showing login prompt');
              Alert.alert(
                'Login Required',
                'Please log in to view your payment details.',
                [{ text: 'OK', style: 'default' }]
              );
              return;
            }
            
            if (!navigationRef.current) {
              console.log('Navigation ref not ready, retrying...');
              // Retry after a short delay if navigation isn't ready
              setTimeout(() => {
                if (navigationRef.current) {
                  navigationRef.current.navigate('PaymentReturn', { 
                    paymentId, 
                    action,
                    token: params.get('token'),
                    PayerID: params.get('PayerID'),
                    status: params.get('status')
                  });
                }
              }, 1000);
              return;
            }
            
            // Navigate to PaymentReturn screen
            navigationRef.current.navigate('PaymentReturn', { 
              paymentId, 
              action,
              token: params.get('token'),
              PayerID: params.get('PayerID'),
              status: params.get('status')
            });
            
            console.log('Navigated to PaymentReturn screen');
          } else {
            console.error('Missing paymentId in deep link');
          }
        } catch (error) {
          console.error('Error parsing payment deep link:', error);
          Alert.alert('Error', 'Invalid payment link received.');
        }
      } else if (url.includes('campuslife://paypal-return')) {
        // Handle PayPal P2P return deep link
        console.log('PayPal P2P return deep link received:', url);
        try {
          const params = new URLSearchParams(url.split('?')[1] || '');
          const transactionId = params.get('transactionId');
          const orderId = params.get('orderId'); 
          const payerID = params.get('payerID');
          const status = params.get('status');
          
          console.log('PayPal P2P deep link parsed:', { transactionId, orderId, payerID, status });
          
          if (transactionId && orderId) {
            if (!isAuthenticated) {
              console.log('User not authenticated, showing login prompt');
              Alert.alert(
                'Login Required', 
                'Please log in to complete your payment.',
                [{ text: 'OK', style: 'default' }]
              );
              return;
            }
            
            if (!navigationRef.current) {
              console.log('Navigation ref not ready, retrying...');
              // Retry after a short delay if navigation isn't ready
              setTimeout(() => {
                if (navigationRef.current) {
                  navigationRef.current.navigate('PayPalP2PReturn', {
                    transactionId,
                    orderId,
                    payerID,
                    status
                  });
                }
              }, 1000);
              return;
            }
            
            // Navigate to PayPalP2PReturn screen
            navigationRef.current.navigate('PayPalP2PReturn', {
              transactionId,
              orderId, 
              payerID,
              status
            });
            
            console.log('Navigated to PayPalP2PReturn screen');
          } else {
            console.error('Missing transactionId or orderId in PayPal deep link');
          }
        } catch (error) {
          console.error('Error parsing PayPal deep link:', error);
          Alert.alert('Error', 'Invalid PayPal payment link received.');
        }
      }
    };

    const handleResendVerification = async () => {
      if (user) {
        try {
          const { resendVerificationEmail } = await import('./src/lib/emailVerification');
          const result = await resendVerificationEmail(user.id);
          
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
  }, [user]);

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading CampusLife...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  const customDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.backgroundSecondary,
      text: theme.colors.textPrimary,
      border: theme.colors.border,
    },
  };

  const AuthStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ParentRegister" component={ParentRegisterScreen} />
      <Stack.Screen name="StudentRegister" component={StudentRegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      <NavigationContainer ref={navigationRef} theme={customDarkTheme}>
        {!isAuthenticated ? (
          <AuthStack />
        ) : user?.role === 'student' ? (
          <Suspense fallback={
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Loading Student Dashboard...</Text>
            </View>
          }>
            <StudentNavigator />
          </Suspense>
        ) : user?.role === 'parent' ? (
          <Suspense fallback={
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Loading Parent Dashboard...</Text>
            </View>
          }>
            <ParentNavigator />
          </Suspense>
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
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    ...theme.typography.bodyMedium,
    marginTop: theme.spacing.md,
    color: theme.colors.textSecondary,
  },
});
