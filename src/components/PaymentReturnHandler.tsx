import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { confirmPayment, getPayment } from '../lib/payments';
import * as Linking from 'expo-linking';

interface PaymentReturnHandlerProps {
  navigation: any;
  route: {
    params: {
      paymentId: string;
      action?: 'return' | 'cancel';
      token?: string;
      PayerID?: string;
      status?: string;
    };
  };
}

export const PaymentReturnHandler: React.FC<PaymentReturnHandlerProps> = ({ 
  navigation, 
  route 
}) => {
  const { paymentId, action = 'return', token, PayerID, status } = route.params;
  const [payment, setPayment] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  useEffect(() => {
    loadPayment();
  }, [paymentId]);

  useEffect(() => {
    // Auto-verify PayPal payments - don't trust URL status, always verify with PayPal
    if (payment && payment.provider === 'paypal' && token && !loading) {
      console.log('🔄 PayPal payment returned - verifying with PayPal API...');
      handlePayPalVerification();
    }
  }, [payment, token]);

  const loadPayment = async () => {
    try {
      const paymentData = await getPayment(paymentId);
      setPayment(paymentData);
    } catch (error) {
      console.error('Error loading payment:', error);
      Alert.alert('Error', 'Could not load payment details');
    } finally {
      setLoading(false);
    }
  };

  const handlePayPalVerification = async () => {
    if (!payment || !token) return;

    try {
      setLoading(true);
      
      console.log('🔄 Verifying PayPal payment:', paymentId, 'with token:', token);
      const { verifyPayPalPayment } = await import('../lib/paypalIntegration');
      const verificationResult = await verifyPayPalPayment(paymentId, token);
      
      console.log('🔄 PayPal verification result:', verificationResult);
      
      if (verificationResult.success) {
        console.log('✅ PayPal payment verified and completed!');
        Alert.alert(
          'Payment Completed! 🎉',
          `$${(payment.intent_cents / 100).toFixed(2)} sent via PayPal successfully.`,
          [{ 
            text: 'Done', 
            onPress: () => navigation.navigate('ParentTabs') 
          }]
        );
      } else {
        console.error('❌ PayPal verification failed:', verificationResult.error);
        Alert.alert(
          'Payment Failed ❌',
          verificationResult.error || 'Your PayPal payment could not be processed. The order may have expired or failed.',
          [
            { text: 'Try Again', onPress: handleRetry },
            { text: 'Go Back', onPress: () => navigation.navigate('ParentTabs') }
          ]
        );
      }
    } catch (error: any) {
      console.error('❌ PayPal verification error:', error);
      Alert.alert(
        'Payment Verification Failed ❌', 
        'Could not verify your PayPal payment. Please check your payment status in PayPal.',
        [
          { text: 'Try Again', onPress: handleRetry },
          { text: 'Go Back', onPress: () => navigation.navigate('ParentTabs') }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!payment) return;

    try {
      setLoading(true);
      
      // If this is a PayPal return with verification data, verify first
      if (payment.provider === 'paypal' && token && status === 'success') {
        console.log('🔄 Auto-verifying PayPal payment:', paymentId, 'with token:', token);
        const { verifyPayPalPayment } = await import('../lib/paypalIntegration');
        const verificationResult = await verifyPayPalPayment(paymentId, token);
        
        console.log('🔄 Verification result:', verificationResult);
        
        if (!verificationResult.success) {
          console.error('❌ PayPal verification failed:', verificationResult.error);
          Alert.alert('Verification Failed', verificationResult.error || 'Could not verify PayPal payment');
          return;
        }
        
        console.log('✅ PayPal payment verified automatically!');
        
        // If verification successful, the payment status is already updated to 'completed'
        // Just show success and return
        Alert.alert(
          'Payment Verified! 🎉',
          `Your $${(payment.intent_cents / 100).toFixed(2)} PayPal payment has been completed and verified.`,
          [{ 
            text: 'Done', 
            onPress: () => navigation.navigate('ParentTabs') 
          }]
        );
        return;
      }
      
      const result = await confirmPayment(paymentId, payment.idempotency_key);
      
      if (result.success) {
        Alert.alert(
          'Payment Confirmed! 🎉',
          `Your $${(payment.intent_cents / 100).toFixed(2)} ${payment.provider} payment has been recorded.`,
          [{ 
            text: 'Done', 
            onPress: () => navigation.navigate('ParentTabs') 
          }]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to confirm payment');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to confirm payment');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    // Re-open the payment provider
    if (payment?.provider_metadata?.redirectUrl) {
      Linking.openURL(payment.provider_metadata.redirectUrl);
    } else {
      navigation.goBack();
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading payment details...</Text>
      </View>
    );
  }

  if (!payment) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Payment not found</Text>
        <TouchableOpacity 
          style={styles.button}
          onPress={() => navigation.navigate('ParentTabs')}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (action === 'cancel') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Payment Canceled</Text>
        <Text style={styles.subtitle}>
          Your ${(payment.intent_cents / 100).toFixed(2)} {payment.provider} payment was canceled.
        </Text>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]}
            onPress={handleRetry}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.button}
            onPress={() => navigation.navigate('ParentTabs')}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Smart flow based on provider type
  if (payment.provider === 'paypal') {
    // PayPal payments are automatically processed - just show status
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.providerEmoji}>💙</Text>
          <Text style={styles.title}>Processing PayPal Payment...</Text>
          <Text style={styles.subtitle}>
            PayPal is processing your ${(payment.intent_cents / 100).toFixed(2)} payment.
          </Text>
        </View>

        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            ✅ Payment sent via PayPal{'\n'}
            🔄 Updating records...{'\n'}
            📱 You'll receive confirmation shortly
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.button}
          onPress={() => navigation.navigate('ParentTabs')}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Manual providers (Venmo, CashApp, Zelle) - need user confirmation
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.providerEmoji}>
          {payment.provider === 'venmo' ? '💙' :
           payment.provider === 'cashapp' ? '💚' : '⚡'}
        </Text>
        <Text style={styles.title}>Confirm Payment</Text>
        <Text style={styles.subtitle}>
          Did you successfully send ${(payment.intent_cents / 100).toFixed(2)} via {payment.provider.charAt(0).toUpperCase() + payment.provider.slice(1)}?
        </Text>
      </View>

      <View style={styles.paymentDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Amount:</Text>
          <Text style={styles.detailValue}>${(payment.intent_cents / 100).toFixed(2)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Provider:</Text>
          <Text style={styles.detailValue}>{payment.provider.charAt(0).toUpperCase() + payment.provider.slice(1)}</Text>
        </View>
        {payment.note && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Note:</Text>
            <Text style={styles.detailValue}>{payment.note}</Text>
          </View>
        )}
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 Your student will also need to confirm they received the payment before it's marked as complete.
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]}
          onPress={handleConfirmPayment}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Confirming...' : 'Yes, I sent it ✅'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]}
          onPress={() => navigation.navigate('ParentTabs')}
          disabled={loading}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.disclaimer}>
        CampusLife does not process payments. This confirms the transfer you made in {payment.provider.charAt(0).toUpperCase() + payment.provider.slice(1)}.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 24,
    paddingTop: 60,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  providerEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  paymentDetails: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#e5e7eb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#059669',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  secondaryButtonText: {
    color: '#6b7280',
  },
  disclaimer: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 16,
    fontStyle: 'italic',
  },
  loadingText: {
    fontSize: 16,
    color: '#111827',
    textAlign: 'center',
  },
  statusContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statusText: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 24,
  },
  infoBox: {
    backgroundColor: '#dbeafe',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  infoText: {
    fontSize: 14,
    color: '#1e40af',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 24,
  },
});