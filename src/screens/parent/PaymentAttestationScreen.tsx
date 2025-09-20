import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  Share
} from 'react-native';
import { db } from '../../lib/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { theme } from '../../styles/theme';
import { PaymentStatusManager } from '../../utils/paymentStatusManager';

interface PaymentAttestationScreenProps {
  navigation: any;
  route: {
    params: {
      paymentId: string;
      amount: string;
      studentName: string;
      paypalUrl?: string;
      devMode?: boolean;
    };
  };
}

export const PaymentAttestationScreen: React.FC<PaymentAttestationScreenProps> = ({ navigation, route }) => {
  const { paymentId, amount, studentName, paypalUrl, devMode } = route.params;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentSent, setPaymentSent] = useState(false);

  const isDev = devMode || false;

  const handleOpenPayPal = async () => {
    if (paypalUrl) {
      try {
        const canOpen = await Linking.canOpenURL(paypalUrl);
        if (canOpen) {
          await Linking.openURL(paypalUrl);
        } else {
          Alert.alert('Error', 'Unable to open PayPal. Please check if PayPal is installed.');
        }
      } catch (error) {
        console.error('Error opening PayPal:', error);
        Alert.alert('Error', 'Unable to open PayPal');
      }
    }
  };

  const handleSharePayPalLink = async () => {
    if (paypalUrl) {
      try {
        await Share.share({
          message: `Send ${amount} to ${studentName}: ${paypalUrl}`,
          url: paypalUrl
        });
      } catch (error) {
        console.error('Error sharing PayPal link:', error);
      }
    }
  };

  const handleMarkAsSent = async () => {
    Alert.alert(
      'Confirm Payment Sent',
      'Have you completed the payment in PayPal?',
      [
        { text: 'Not Yet', style: 'cancel' },
        {
          text: 'Yes, I Sent It',
          onPress: async () => {
            setIsSubmitting(true);

            try {
              // Use transaction to prevent race conditions with student confirmation
              const { runTransaction } = await import('firebase/firestore');

              await runTransaction(db, async (transaction) => {
                const paymentRef = doc(db, 'payments', paymentId);
                const currentPayment = await transaction.get(paymentRef);

                if (!currentPayment.exists()) {
                  throw new Error('Payment not found');
                }

                const currentData = currentPayment.data() as any;

                // Check if parent confirmation is allowed
                if (!PaymentStatusManager.canParentConfirm(currentData.status)) {
                  throw new Error(`Cannot confirm payment with status: ${currentData.status}`);
                }

                // If already confirmed by parent, this is idempotent
                if (currentData.confirmed_at && currentData.parent_sent_at) {
                  return; // Already confirmed, no-op
                }

                // Build atomic update using status manager
                const updateData = PaymentStatusManager.buildParentConfirmationUpdate(currentData);

                transaction.update(paymentRef, updateData);
              });

              // Immediately redirect to dashboard without alert (like old system)
              navigation.navigate('ParentTabs', { screen: 'Dashboard' });

            } catch (error) {
              console.error('Error updating payment:', error);
              Alert.alert('Error', 'Failed to mark payment as sent. Please try again.');
              setIsSubmitting(false);
            }
          }
        }
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Payment',
      'Are you sure you want to cancel this payment? This cannot be undone.',
      [
        { text: 'Keep Payment', style: 'cancel' },
        {
          text: 'Cancel Payment',
          style: 'destructive',
          onPress: async () => {
            try {
              // Use transaction to prevent race conditions
              const { runTransaction } = await import('firebase/firestore');

              await runTransaction(db, async (transaction) => {
                const paymentRef = doc(db, 'payments', paymentId);
                const currentPayment = await transaction.get(paymentRef);

                if (!currentPayment.exists()) {
                  throw new Error('Payment not found');
                }

                const currentData = currentPayment.data();

                // Check if cancellation is allowed
                if (!PaymentStatusManager.canCancel(currentData.status)) {
                  throw new Error(`Cannot cancel payment with status: ${currentData.status}`);
                }

                transaction.update(paymentRef, {
                  status: 'cancelled',
                  cancelled_at: Timestamp.now(),
                  cancelled_reason: 'Parent cancelled before sending',
                  updated_at: Timestamp.now()
                });
              });

              navigation.navigate('ParentTabs', { screen: 'Dashboard' });
            } catch (error) {
              console.error('Error cancelling payment:', error);
              Alert.alert('Error', 'Failed to cancel payment');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Confirm Payment</Text>
          <Text style={styles.subtitle}>
            Send {amount} to {studentName}
            {isDev && <Text style={styles.devIndicator}> DEV MODE</Text>}
          </Text>
        </View>

        {/* Payment Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusIcon}>
            <Text style={styles.statusIconText}>€</Text>
          </View>
          <Text style={styles.statusTitle}>
            {isDev ? 'Simulated PayPal Payment' : 'Complete Payment in PayPal'}
          </Text>
          <Text style={styles.statusDescription}>
            {isDev
              ? `Development mode: Simulating sending ${amount} to ${studentName}. Test the "Mark as Sent" flow.`
              : `Use PayPal to send ${amount} to ${studentName}, then return here to confirm you sent it.`
            }
          </Text>
        </View>

        {/* PayPal Action Buttons */}
        {paypalUrl && !isDev && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PayPal Actions</Text>

            <TouchableOpacity style={styles.paypalButton} onPress={handleOpenPayPal}>
              <Text style={styles.paypalButtonText}>Open PayPal</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareButton} onPress={handleSharePayPalLink}>
              <Text style={styles.shareButtonText}>Share PayPal Link</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Development Mode Info */}
        {isDev && (
          <View style={styles.devSection}>
            <Text style={styles.sectionTitle}>Development Mode</Text>
            <Text style={styles.devDescription}>
              PayPal.Me links don't work with sandbox accounts, so we're simulating the flow.
              In production, PayPal would have opened automatically.
            </Text>
            <Text style={styles.devUrl}>Would open: {paypalUrl}</Text>
          </View>
        )}


        {/* Confirmation Steps */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Confirmation Steps</Text>

          <View style={styles.stepContainer}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={styles.stepText}>Complete payment in PayPal</Text>
          </View>

          <View style={styles.stepContainer}>
            <View style={[styles.stepNumber, paymentSent && styles.stepNumberComplete]}>
              <Text style={[styles.stepNumberText, paymentSent && styles.stepNumberTextComplete]}>2</Text>
            </View>
            <Text style={[styles.stepText, paymentSent && styles.stepTextComplete]}>
              Confirm you sent the payment
            </Text>
          </View>

          <View style={styles.stepContainer}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={styles.stepText}>{studentName} will confirm they received it</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              isSubmitting && styles.confirmButtonDisabled
            ]}
            onPress={handleMarkAsSent}
            disabled={isSubmitting}
          >
            <Text style={styles.confirmButtonText}>
              {isSubmitting ? 'Confirming...' : paymentSent ? 'Confirm Payment Sent' : 'Mark as Sent'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelButtonText}>Cancel Payment</Text>
          </TouchableOpacity>
        </View>

        {/* Help Info */}
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>Need Help?</Text>
          <Text style={styles.helpText}>
            • Make sure you're sending to the correct PayPal account{'\n'}
            • Double-check the amount before confirming{'\n'}
            • If you encounter issues, you can cancel and try again{'\n'}
            • {studentName} will be notified once you confirm
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 60,
  },
  backButton: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 6,
  },
  devIndicator: {
    fontSize: 14,
    color: '#f59e0b',
    fontWeight: '700',
  },
  statusCard: {
    backgroundColor: theme.colors.backgroundCard,
    margin: 20,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statusIconText: {
    fontSize: 28,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  statusDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  paypalButton: {
    backgroundColor: '#0070ba',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  paypalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  shareButton: {
    backgroundColor: theme.colors.backgroundCard,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  transactionInput: {
    backgroundColor: theme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontFamily: 'monospace',
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  stepNumberComplete: {
    backgroundColor: '#10b981',
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  stepNumberTextComplete: {
    color: 'white',
  },
  stepText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  stepTextComplete: {
    color: '#10b981',
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#10b981',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  cancelButton: {
    backgroundColor: theme.colors.backgroundCard,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },
  helpCard: {
    backgroundColor: theme.colors.backgroundCard,
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 40,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  helpText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  devSection: {
    padding: 20,
    backgroundColor: '#fef3c7',
    marginHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  devDescription: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
    marginBottom: 12,
  },
  devUrl: {
    fontSize: 12,
    color: '#92400e',
    fontFamily: 'monospace',
    backgroundColor: '#fbbf24',
    padding: 8,
    borderRadius: 6,
  },
});