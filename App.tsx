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
import { PrivacyPolicyScreen } from './src/screens/shared/PrivacyPolicyScreen';
import { NetworkStatusIndicator } from './src/components/NetworkStatusIndicator';

const Stack = createStackNavigator<AuthStackParamList>();

export default function App() {
  const { isAuthenticated, user, isLoading, initialize } = useAuthStore();
  const navigationRef = useRef<any>(null);

  // CRITICAL: Initialize auth state listener on app start
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Handle deep links for email verification and password reset
  useEffect(() => {
    // Track when the app was opened to avoid processing stale deep links
    const appOpenTime = Date.now();
    
    const handleDeepLink = (url: string) => {
      console.log('Deep link received:', url);
      
      // Ignore deep links that are older than 30 seconds after app open
      // This prevents stale payment links from being processed on login
      const timeSinceAppOpen = Date.now() - appOpenTime;
      if (timeSinceAppOpen > 30000 && (url.includes('campuslife://pay/') || url.includes('campuslife://paypal-return'))) {
        console.log('Ignoring stale payment deep link:', url);
        return;
      }
      
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
          
          // Handle cancel action - don't require authentication
          if (action === 'cancel') {
            console.log('Payment was cancelled by user');
            Alert.alert(
              'Payment Cancelled',
              'Your payment was cancelled. You can try again later.',
              [{ text: 'OK', style: 'default' }]
            );
            return; // Don't navigate anywhere for cancels
          }
          
          if (paymentId) {
            if (!isAuthenticated) {
              console.log('User not authenticated for payment return');
              Alert.alert(
                'Login Required',
                'Please log in to complete your payment process.',
                [{ text: 'OK', style: 'default' }]
              );
              return;
            }
            
            if (!navigationRef.current) {
              console.log('Navigation ref not ready, retrying...');
              // Retry after a short delay if navigation isn't ready
              setTimeout(() => {
                if (navigationRef.current && user?.role === 'parent') {
                  navigationRef.current.navigate('PaymentReturn', { 
                    paymentId, 
                    action,
                    token: params.get('token'),
                    PayerID: params.get('PayerID'),
                    status: params.get('status')
                  });
                } else if (user?.role === 'student') {
                  Alert.alert(
                    'Payment Completed',
                    'Your payment has been processed successfully!',
                    [{ text: 'OK', style: 'default' }]
                  );
                }
              }, 1000);
              return;
            }
            
            // Only navigate to PaymentReturn for success/return, not cancel
            // Check if user is parent (PaymentReturn screen only exists for parents)
            if (user?.role === 'parent') {
              navigationRef.current.navigate('PaymentReturn', { 
                paymentId, 
                action,
                token: params.get('token'),
                PayerID: params.get('PayerID'),
                status: params.get('status')
              });
            } else {
              // Students don't have PaymentReturn screen, just show success message
              console.log('Student user - showing payment success message instead of navigation');
              Alert.alert(
                'Payment Completed',
                'Your payment has been processed successfully!',
                [{ text: 'OK', style: 'default' }]
              );
            }
            
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
                if (navigationRef.current && user?.role === 'parent') {
                  navigationRef.current.navigate('PayPalP2PReturn', {
                    transactionId,
                    orderId,
                    payerID,
                    status
                  });
                } else if (user?.role === 'student') {
                  Alert.alert(
                    'Payment Completed',
                    'Your PayPal payment has been processed successfully!',
                    [{ text: 'OK', style: 'default' }]
                  );
                }
              }, 1000);
              return;
            }
            
            // Navigate to PayPalP2PReturn screen (only for parents)
            if (user?.role === 'parent') {
              navigationRef.current.navigate('PayPalP2PReturn', {
                transactionId,
                orderId, 
                payerID,
                status
              });
              console.log('Navigated to PayPalP2PReturn screen');
            } else {
              // Students don't have PayPalP2PReturn screen, just show success message
              console.log('Student user - showing PayPal payment success message instead of navigation');
              Alert.alert(
                'PayPal Payment Completed',
                'Your PayPal payment has been processed successfully!',
                [{ text: 'OK', style: 'default' }]
              );
            }
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
        <NetworkStatusIndicator position="top" />
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
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
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
      <NetworkStatusIndicator position="top" />
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
