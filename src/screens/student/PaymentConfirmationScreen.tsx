import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl
} from 'react-native';
import { db } from '../../lib/firebase';
import { doc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
import { theme } from '../../styles/theme';
import { useAuthStore } from '../../stores/authStore';
import { formatPaymentAmount } from '../../lib/paypalDeepLink';
import { PaymentStatusManager } from '../../utils/paymentStatusManager';

interface PaymentConfirmationScreenProps {
  navigation: any;
  route: {
    params: {
      paymentId: string;
    };
  };
}

interface PaymentData {
  id: string;
  parent_id: string;
  student_id: string;
  amount_cents: number;
  note: string;
  status: string;
  paypal_me_handle?: string;
  parent_sent_at?: any;
  parent_txn_reference?: string;
  created_at: any;
  parentName?: string;
  student_confirmed_at?: any;
}

export const PaymentConfirmationScreen: React.FC<PaymentConfirmationScreenProps> = ({ navigation, route }) => {
  const { paymentId } = route.params;
  const { user } = useAuthStore();

  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [actualAmountReceived, setActualAmountReceived] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadPayment = async () => {
    try {
      const paymentDoc = await getDoc(doc(db, 'payments', paymentId));

      if (!paymentDoc.exists()) {
        Alert.alert('Error', 'Payment not found');
        navigation.goBack();
        return;
      }

      const paymentData = paymentDoc.data() as PaymentData;
      paymentData.id = paymentDoc.id;

      // Get parent name
      if (paymentData.parent_id) {
        const parentDoc = await getDoc(doc(db, 'users', paymentData.parent_id));
        if (parentDoc.exists()) {
          paymentData.parentName = parentDoc.data().full_name || 'Parent';
        }
      }

      setPayment(paymentData);

      // Pre-fill the expected amount
      setActualAmountReceived((paymentData.amount_cents / 100).toFixed(2));

    } catch (error) {
      console.error('Error loading payment:', error);
      Alert.alert('Error', 'Failed to load payment details');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPayment();
    setRefreshing(false);
  };

  useEffect(() => {
    loadPayment();
  }, [paymentId]);

  const handleConfirmReceived = async () => {
    if (!payment) return;

    // Validate amount
    const receivedCents = Math.round(parseFloat(actualAmountReceived || '0') * 100);
    if (receivedCents <= 0) {
      Alert.alert('Invalid Amount', 'Please enter the amount you actually received');
      return;
    }

    setConfirming(true);

    try {
      // Use transaction to prevent race conditions with parent attestation
      const { runTransaction } = await import('firebase/firestore');

      await runTransaction(db, async (transaction) => {
        const paymentRef = doc(db, 'payments', paymentId);
        const currentPayment = await transaction.get(paymentRef);

        if (!currentPayment.exists()) {
          throw new Error('Payment not found');
        }

        const currentData = currentPayment.data() as any;

        // Check if student confirmation is allowed
        if (!PaymentStatusManager.canStudentConfirm(currentData.status)) {
          throw new Error(`Cannot confirm payment with status: ${currentData.status}`);
        }

        // If already confirmed by student, this is idempotent
        if (currentData.student_confirmed_at) {
          return; // Already confirmed, no-op
        }

        // Build atomic update using status manager
        const updateData = PaymentStatusManager.buildStudentConfirmationUpdate(
          currentData,
          receivedCents
        );

        transaction.update(paymentRef, updateData);
      });

      const expectedAmount = formatPaymentAmount(payment.amount_cents);
      const receivedAmount = formatPaymentAmount(receivedCents);

      let alertTitle = 'Payment Confirmed!';
      let alertMessage = `You've confirmed receiving ${receivedAmount} from ${payment.parentName || 'your parent'}.`;

      // Check if amounts match
      if (receivedCents !== payment.amount_cents) {
        alertTitle = 'Payment Confirmed (Amount Differs)';
        alertMessage += `\n\nNote: Expected ${expectedAmount}, received ${receivedAmount}. This difference has been recorded.`;
      }

      Alert.alert(
        alertTitle,
        alertMessage,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack() // Return to PaymentHistory/Activity
          }
        ]
      );

    } catch (error) {
      console.error('Error confirming payment:', error);
      Alert.alert('Error', 'Failed to confirm payment. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  const handleDispute = () => {
    Alert.alert(
      'Report Issue',
      'What would you like to report about this payment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Wrong Amount',
          onPress: () => Alert.alert('Wrong Amount', 'Please enter the correct amount you received and we\'ll record the difference.')
        },
        {
          text: 'Never Received',
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

                // Check if dispute is allowed
                if (!PaymentStatusManager.canDispute(currentData.status)) {
                  throw new Error(`Cannot dispute payment with status: ${currentData.status}`);
                }

                transaction.update(paymentRef, {
                  status: 'disputed',
                  dispute_reason: 'never_received',
                  student_disputed_at: Timestamp.now(),
                  updated_at: Timestamp.now()
                });
              });

              Alert.alert(
                'Issue Reported',
                'We\'ve recorded that you never received this payment. Your parent will be notified.',
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.goBack() // Return to PaymentHistory/Activity
                  }
                ]
              );
            } catch (error) {
              console.error('Error reporting dispute:', error);
              Alert.alert('Error', 'Failed to report issue');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>Loading payment details...</Text>
      </View>
    );
  }

  if (!payment) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Payment not found</Text>
      </View>
    );
  }

  const expectedAmount = formatPaymentAmount(payment.amount_cents);
  const isAlreadyConfirmed = payment.status === 'confirmed';

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Confirm Payment</Text>
          <Text style={styles.subtitle}>
            {payment.parentName || 'Your parent'} sent you money
          </Text>
        </View>

        {/* Payment Details Card */}
        <View style={styles.paymentCard}>
          <View style={styles.paymentIcon}>
            <Text style={styles.paymentIconText}>💰</Text>
          </View>

          <View style={styles.paymentDetails}>
            <Text style={styles.amountText}>{expectedAmount}</Text>
            <Text style={styles.fromText}>from {payment.parentName || 'Parent'}</Text>

            {payment.note && (
              <View style={styles.noteContainer}>
                <Text style={styles.noteLabel}>Note:</Text>
                <Text style={styles.noteText}>{payment.note}</Text>
              </View>
            )}

            <View style={styles.paymentMeta}>
              <Text style={styles.metaText}>
                Sent via PayPal (@{payment.paypal_me_handle || 'paypal'})
              </Text>
              {payment.parent_txn_reference && (
                <Text style={styles.metaText}>
                  Transaction ID: {payment.parent_txn_reference}
                </Text>
              )}
              {payment.parent_sent_at && (
                <Text style={styles.metaText}>
                  Sent: {payment.parent_sent_at.toDate().toLocaleDateString()}
                </Text>
              )}
            </View>
          </View>
        </View>

        {!isAlreadyConfirmed && (
          <>
            {/* Amount Verification */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Verify Amount Received</Text>
              <Text style={styles.sectionDescription}>
                Check your PayPal account and enter the exact amount you received:
              </Text>

              <View style={styles.amountInputContainer}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={actualAmountReceived}
                  onChangeText={setActualAmountReceived}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              {actualAmountReceived && (
                <View style={styles.amountComparisonContainer}>
                  <View style={styles.amountComparison}>
                    <Text style={styles.comparisonLabel}>Expected:</Text>
                    <Text style={styles.comparisonAmount}>{expectedAmount}</Text>
                  </View>
                  <View style={styles.amountComparison}>
                    <Text style={styles.comparisonLabel}>Received:</Text>
                    <Text style={styles.comparisonAmount}>
                      ${parseFloat(actualAmountReceived || '0').toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.section}>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  confirming && styles.confirmButtonDisabled
                ]}
                onPress={handleConfirmReceived}
                disabled={confirming}
              >
                <Text style={styles.confirmButtonText}>
                  {confirming ? 'Confirming...' : 'Confirm I Received This'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.disputeButton} onPress={handleDispute}>
                <Text style={styles.disputeButtonText}>Report an Issue</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {isAlreadyConfirmed && (
          <View style={styles.section}>
            <View style={styles.confirmedCard}>
              <Text style={styles.confirmedTitle}>✅ Payment Confirmed</Text>
              <Text style={styles.confirmedText}>
                You confirmed receiving this payment on {payment.student_confirmed_at?.toDate().toLocaleDateString()}.
              </Text>
            </View>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>How to Check PayPal</Text>
          <Text style={styles.instructionsText}>
            1. Open the PayPal app or website{'\n'}
            2. Check your recent transactions{'\n'}
            3. Look for payments from {payment.parentName || 'your parent'}{'\n'}
            4. Verify the amount matches what you received{'\n'}
            5. Come back here to confirm receipt
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
  paymentCard: {
    backgroundColor: theme.colors.backgroundCard,
    margin: 20,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  paymentIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  paymentIconText: {
    fontSize: 28,
  },
  paymentDetails: {
    alignItems: 'center',
    width: '100%',
  },
  amountText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#10b981',
    marginBottom: 8,
  },
  fromText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  noteContainer: {
    backgroundColor: theme.colors.backgroundTertiary,
    padding: 12,
    borderRadius: 8,
    width: '100%',
    marginBottom: 16,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  noteText: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontStyle: 'italic',
  },
  paymentMeta: {
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundCard,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  dollarSign: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.primary,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    padding: 16,
  },
  amountComparisonContainer: {
    backgroundColor: theme.colors.backgroundTertiary,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  amountComparison: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  comparisonLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  comparisonAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
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
  disputeButton: {
    backgroundColor: theme.colors.backgroundCard,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  disputeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f59e0b',
  },
  confirmedCard: {
    backgroundColor: '#f0fdf4',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1fae5',
    alignItems: 'center',
  },
  confirmedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 8,
  },
  confirmedText: {
    fontSize: 14,
    color: '#059669',
    textAlign: 'center',
  },
  instructionsCard: {
    backgroundColor: theme.colors.backgroundCard,
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 40,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
  },
});