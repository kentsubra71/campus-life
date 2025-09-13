import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { getCurrentSpendingCaps, SUBSCRIPTION_TIERS, getPaymentProviders } from '../../lib/payments';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  createPayPalP2POrder, 
  testPayPalConnection 
} from '../../lib/paypalP2P';
import { 
  validatePaymentInput,
  validatePaymentAmount,
  sanitizePaymentNote,
  formatPaymentAmount,
  checkPaymentRateLimit
} from '../../utils/paymentValidation';
import { getUserFriendlyError, logError } from '../../utils/userFriendlyErrors';
import { getTimeoutDuration } from '../../utils/paymentTimeout';
import { theme } from '../../styles/theme';

interface SendPaymentScreenProps {
  navigation: any;
  route?: {
    params?: {
      selectedStudentId?: string;
      selectedStudentName?: string;
    };
  };
}

export const SendPaymentScreen: React.FC<SendPaymentScreenProps> = ({ navigation, route }) => {
  const { getFamilyMembers } = useAuthStore();
  const selectedStudentId = route?.params?.selectedStudentId;
  const selectedStudentName = route?.params?.selectedStudentName;
  
  const [familyMembers, setFamilyMembers] = useState<{ parents: any[]; students: any[] }>({ parents: [], students: [] });
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<'paypal' | 'venmo' | 'cashapp' | 'zelle' | null>(null);
  const [amount, setAmount] = useState('10.00');
  const [note, setNote] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [spendingInfo, setSpendingInfo] = useState<any>(null);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [members, providersConfig, caps] = await Promise.all([
        getFamilyMembers(),
        getPaymentProviders(),
        getCurrentSpendingCaps()
      ]);
      
      setFamilyMembers(members);
      setProviders(providersConfig);
      
      console.log('Spending caps result:', caps);
      if (caps.success) {
        setSpendingInfo(caps);
      } else {
        // Fallback for testing - set high limits
        console.log('Using fallback spending limits for testing');
        setSpendingInfo({
          success: true,
          capCents: 10000, // $100
          spentCents: 0,
          remainingCents: 10000
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const targetStudent = selectedStudentName || familyMembers.students[0]?.full_name || 'Student';
  const targetStudentId = selectedStudentId || familyMembers.students[0]?.id;
  const amountCents = Math.round(parseFloat(amount || '0') * 100);


  const handleSendPayment = async () => {
    // Comprehensive input validation
    const validationResult = validatePaymentInput({
      amount,
      provider: selectedProvider,
      note: sanitizePaymentNote(note),
      studentId: targetStudentId || ''
    });

    if (!validationResult.isValid) {
      Alert.alert('Validation Error', validationResult.errors.join('\n'));
      return;
    }

    // Show warnings if any
    if (validationResult.warnings.length > 0) {
      const continuePayment = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Payment Warning',
          validationResult.warnings.join('\n') + '\n\nDo you want to continue?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Continue', onPress: () => resolve(true) }
          ]
        );
      });
      
      if (!continuePayment) return;
    }

    // Rate limiting check
    const { user } = useAuthStore.getState();
    if (user) {
      const rateLimitResult = await checkPaymentRateLimit(user.id, amountCents);
      if (!rateLimitResult.allowed) {
        Alert.alert('Payment Limit Reached', rateLimitResult.reason || 'Please try again later');
        return;
      }
    }

    // TESTING BYPASS: Skip limit checks for development
    const TESTING_MODE = true; // Set to false when ready for production

    console.log('🔍 [SendPayment] Starting payment process', { 
      provider: selectedProvider,
      amountCents, 
      targetStudentId,
      remainingCents: spendingInfo?.remainingCents || 0,
      TESTING_MODE
    });
    
    if (!TESTING_MODE && spendingInfo && amountCents > (spendingInfo.remainingCents || 0)) {
      Alert.alert(
        'Monthly Limit Exceeded',
        `This payment would exceed your monthly limit. You have $${((spendingInfo.remainingCents || 0) / 100).toFixed(2)} remaining.\n\nUpgrade your plan for a higher limit.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade Plan', onPress: () => {/* Navigate to upgrade */} }
        ]
      );
      return;
    }
    
    if (TESTING_MODE) {
      console.log('🧪 TESTING MODE: Skipping spending limit checks');
    }

    setIsLoading(true);

    try {
      if (selectedProvider === 'paypal') {
        // Use new PayPal P2P system
        console.log('🔍 [SendPayment] Using PayPal P2P system');
        
        const result = await createPayPalP2POrder(
          targetStudentId,
          amountCents,
          note || `Campus Life reward: ${formatPaymentAmount(amountCents)}`
        );

        console.log('🔍 [SendPayment] PayPal P2P result:', result);

        if (result.success && result.approvalUrl) {
          // Store the payment ID for potential cancellation
          if (result.paymentId) {
            setCurrentPaymentId(result.paymentId);
          }
          
          // Open PayPal for payment
          await Linking.openURL(result.approvalUrl);
          
          // Show user what to expect
          Alert.alert(
            'PayPal Payment Started',
            'Complete your payment in PayPal, then return to Campus Life. The payment will be automatically verified.',
            [
              { text: 'OK' },
              { 
                text: 'Debug: Test Success', 
                onPress: () => navigation.navigate('PayPalP2PReturn', { 
                  transactionId: result.transactionId,
                  orderId: result.orderId,
                  status: 'success'
                })
              }
            ]
          );
        } else {
          const friendlyError = getUserFriendlyError(result.error || 'PayPal payment creation failed', 'PayPal payment');
          Alert.alert('Payment Issue', friendlyError);
          logError(result.error, 'PayPal payment creation', { targetStudentId, amountCents });
        }
      } else {
        // Use legacy system for other providers
        if (selectedProvider === 'paypal') {
          console.log('🔍 [SendPayment] Using Cloud Function for PayPal');
          
          const result = await createPayPalP2POrder(
            targetStudentId,
            amountCents,
            note || `CampusLife reward: $${amount}`
          );

          if (result.success && result.approvalUrl) {
            // Open PayPal for payment
            await Linking.openURL(result.approvalUrl);
            
            // Navigate to confirmation screen with PayPal details
            navigation.navigate('PaymentReturn', {
              paymentId: result.paymentId,
              transactionId: result.transactionId,
              orderId: result.orderId,
              action: 'return'
            });
          } else {
            const friendlyError = getUserFriendlyError(result.error || 'PayPal payment creation failed', 'payment creation');
            Alert.alert('Payment Issue', friendlyError);
            logError(result.error, 'PayPal payment creation', { provider: selectedProvider, targetStudentId, amountCents });
          }
        } else {
          // For other providers, show temporary message
          Alert.alert(
            'Provider Not Available',
            `${selectedProvider} payments are being updated. Please use PayPal for now.`,
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error: any) {
      logError(error, 'Send payment operation', { provider: selectedProvider, targetStudentId, amountCents });
      const friendlyError = getUserFriendlyError(error, 'payment processing');
      Alert.alert('Payment Failed', friendlyError);
    } finally {
      setIsLoading(false);
      setCurrentPaymentId(null);
    }
  };

  const cancelPayment = async () => {
    if (!currentPaymentId) {
      // Simple cancel - just reset loading state
      setIsLoading(false);
      setCurrentPaymentId(null);
      Alert.alert('Cancelled', 'Payment has been cancelled.');
      return;
    }

    try {
      // Cancel payment in database by marking as cancelled
      
      await updateDoc(doc(db, 'payments', currentPaymentId), {
        status: 'cancelled',
        cancelled_at: Timestamp.now(),
        cancelled_reason: 'User cancelled during processing'
      });
      
      setIsLoading(false);
      setCurrentPaymentId(null);
      Alert.alert('Payment Cancelled', 'The payment has been cancelled successfully.');
      
    } catch (error) {
      console.error('Error cancelling payment:', error);
      Alert.alert('Cancel Failed', 'Unable to cancel payment. Please contact support if needed.');
    }
  };

  const getRemainingBudget = () => {
    if (!spendingInfo) return 'Loading...';
    return `$${((spendingInfo.remainingCents || 0) / 100).toFixed(2)} remaining`;
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Send Money to {targetStudent.split(' ')[0]}</Text>
          <Text style={styles.subtitle}>External payment via P2P apps</Text>
        </View>

        {/* Budget Info */}
        {spendingInfo && (
          <View style={styles.budgetCard}>
            <Text style={styles.budgetTitle}>Monthly Send Limit</Text>
            <View style={styles.budgetBar}>
              <View 
                style={[
                  styles.budgetFill, 
                  { width: `${((spendingInfo.spentCents || 0) / (spendingInfo.capCents || 1)) * 100}%` }
                ]} 
              />
            </View>
            <Text style={styles.budgetText}>
              ${((spendingInfo.spentCents || 0) / 100).toFixed(2)} used / {getRemainingBudget()}
            </Text>
          </View>
        )}

        {/* Amount Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Amount</Text>
          <View style={styles.amountInputContainer}>
            <Text style={styles.dollarSign}>$</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={(text) => {
                const formattedAmount = formatPaymentAmount(text);
                const validation = validatePaymentAmount(formattedAmount);
                
                setAmount(formattedAmount);
                setSelectedPreset(null);
                
                // Could add visual feedback here for invalid amounts
                if (!validation.isValid && formattedAmount !== '') {
                  console.warn('Invalid amount:', validation.error);
                }
              }}
              keyboardType="numeric"
              placeholder="10.00"
              placeholderTextColor="#9ca3af"
            />
          </View>
          
          {/* Preset Amount Buttons */}
          <View style={styles.presetContainer}>
            <Text style={styles.presetLabel}>Quick amounts:</Text>
            <View style={styles.presetButtons}>
              {[5, 10, 20, 25, 50].map((presetAmount) => (
                <TouchableOpacity
                  key={presetAmount}
                  style={[
                    styles.presetButton,
                    selectedPreset === presetAmount && styles.presetButtonActive
                  ]}
                  onPress={() => {
                    setAmount(presetAmount.toFixed(2));
                    setSelectedPreset(presetAmount);
                  }}
                >
                  <Text style={[
                    styles.presetButtonText,
                    selectedPreset === presetAmount && styles.presetButtonTextActive
                  ]}>
                    ${presetAmount}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Note Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Note (Optional)</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Great job on your wellness streak!"
            placeholderTextColor="#9ca3af"
            maxLength={140}
            multiline
          />
        </View>

        {/* Provider Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose Payment Method</Text>
          <View style={styles.providersGrid}>
            {providers.map((provider) => (
              <TouchableOpacity
                key={provider.id}
                style={[
                  styles.providerCard,
                  selectedProvider === provider.id && styles.providerCardActive,
                  !provider.available && styles.providerCardDisabled
                ]}
                onPress={() => provider.available && setSelectedProvider(provider.id)}
                disabled={!provider.available}
              >
                <Text style={styles.providerEmoji}>{provider.emoji}</Text>
                <Text style={styles.providerName}>{provider.name}</Text>
                <Text style={styles.providerDescription}>{provider.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Send Button */}
        <View style={styles.section}>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!selectedProvider || isLoading) && styles.sendButtonDisabled,
                isLoading && styles.sendButtonProcessing
              ]}
              onPress={handleSendPayment}
              disabled={!selectedProvider || isLoading}
            >
              <Text style={styles.sendButtonText}>
                {isLoading ? 'Processing...' : `Send $${amount} via ${selectedProvider || 'Provider'}`}
              </Text>
            </TouchableOpacity>
            
            {/* Cancel Button (only show when processing) */}
            {isLoading && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={cancelPayment}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimerCard}>
          <Text style={styles.disclaimerTitle}>Important</Text>
          <Text style={styles.disclaimerText}>
            • CampusLife does not process payments{'\n'}
            • Transfers happen entirely in the selected app{'\n'}
            • Family allowance between known parties only{'\n'}
            • You'll confirm after completing the transfer
          </Text>
          
          {/* Timeout Warning */}
          {selectedProvider && (
            <View style={styles.timeoutInfo}>
              <Text style={styles.timeoutInfoTitle}>⏰ Auto-Timeout</Text>
              <Text style={styles.timeoutInfoText}>
                {selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)} payments will automatically cancel after {getTimeoutDuration(selectedProvider)} if not completed.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardContainer: {
    flex: 1,
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
  budgetCard: {
    backgroundColor: theme.colors.backgroundCard,
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  budgetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  budgetBar: {
    height: 6,
    backgroundColor: theme.colors.backgroundTertiary,
    borderRadius: 3,
    marginBottom: 8,
  },
  budgetFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  budgetText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
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
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  dollarSign: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    padding: 16,
  },
  presetContainer: {
    marginTop: 16,
  },
  presetLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  presetButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  presetButton: {
    flex: 1,
    backgroundColor: theme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  presetButtonActive: {
    backgroundColor: '#1e1b4b',
    borderColor: theme.colors.primary,
  },
  presetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  presetButtonTextActive: {
    color: theme.colors.primary,
  },
  noteInput: {
    backgroundColor: theme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  providersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  providerCard: {
    width: '48%',
    backgroundColor: theme.colors.backgroundCard,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    marginBottom: 12,
  },
  providerCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: '#1e1b4b',
  },
  providerCardDisabled: {
    opacity: 0.5,
  },
  providerEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  providerName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  providerDescription: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 14,
  },
  sendButton: {
    backgroundColor: '#059669',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.buttonPrimary,
  },
  sendButtonProcessing: {
    backgroundColor: '#f59e0b',
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.backgroundSecondary,
  },
  buttonContainer: {
    gap: 12,
  },
  cancelButton: {
    backgroundColor: '#dc2626',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.backgroundSecondary,
  },
  disclaimerCard: {
    backgroundColor: theme.colors.backgroundCard,
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 40,
  },
  disclaimerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f59e0b',
    marginBottom: 8,
  },
  disclaimerText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  timeoutInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  timeoutInfoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f59e0b',
    marginBottom: 6,
  },
  timeoutInfoText: {
    fontSize: 12,
    color: '#d97706',
    lineHeight: 16,
  },
});