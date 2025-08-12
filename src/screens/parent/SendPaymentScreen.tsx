import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking
} from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { createPaymentIntent, getCurrentSpendingCaps, SUBSCRIPTION_TIERS } from '../../lib/payments';

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
  const [selectedProvider, setSelectedProvider] = useState<'paypal' | 'venmo' | 'cashapp' | 'zelle' | null>(null);
  const [amount, setAmount] = useState('10.00');
  const [note, setNote] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [spendingInfo, setSpendingInfo] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const members = await getFamilyMembers();
      setFamilyMembers(members);
      
      const caps = await getCurrentSpendingCaps();
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

  const providers = [
    {
      id: 'paypal' as const,
      name: 'PayPal',
      emoji: '💙',
      description: 'Best experience. Returns to CampusLife.',
      available: true
    },
    {
      id: 'venmo' as const,
      name: 'Venmo',
      emoji: '💙',
      description: 'Opens app; confirm after.',
      available: true
    },
    {
      id: 'cashapp' as const,
      name: 'Cash App',
      emoji: '💚',
      description: 'Opens app; confirm after.',
      available: true
    },
    {
      id: 'zelle' as const,
      name: 'Zelle',
      emoji: '⚡',
      description: 'Opens your bank/Zelle; manual confirm.',
      available: true
    }
  ];

  const handleSendPayment = async () => {
    if (!selectedProvider) {
      Alert.alert('Error', 'Please select a payment provider');
      return;
    }

    if (!targetStudentId) {
      Alert.alert('Error', 'No student selected');
      return;
    }

    if (amountCents < 100) {
      Alert.alert('Error', 'Minimum amount is $1.00');
      return;
    }

    // TESTING BYPASS: Skip limit checks for development
    const TESTING_MODE = true; // Set to false when ready for production

    console.log('Checking limits:', { 
      amountCents, 
      remainingCents: spendingInfo?.remainingCents || 0,
      spendingInfo,
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
      const result = await createPaymentIntent(
        targetStudentId,
        amountCents,
        selectedProvider,
        note || `CampusLife reward: $${amount}`
      );

      if (result.success) {
        // Open the provider app/website
        if (result.redirectUrl) {
          await Linking.openURL(result.redirectUrl);
        }

        // Navigate to confirmation screen or wait for return
        if (result.manual) {
          // For manual providers, immediately show confirmation screen
          navigation.navigate('PaymentReturn', {
            paymentId: result.paymentId,
            action: 'return'
          });
        } else {
          // For PayPal, wait for return via deep link
          // TESTING: Since deep links don't work in dev, show manual option
          Alert.alert(
            'Payment Sent to PayPal',
            'After completing PayPal payment, tap "Test Return" to simulate the return flow.',
            [
              { text: 'OK' },
              { 
                text: 'Test Return', 
                onPress: () => navigation.navigate('PaymentReturn', { 
                  paymentId: result.paymentId,
                  action: 'return',
                  status: 'success'
                })
              }
            ]
          );
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to create payment');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send payment');
    } finally {
      setIsLoading(false);
    }
  };

  const getRemainingBudget = () => {
    if (!spendingInfo) return 'Loading...';
    return `$${((spendingInfo.remainingCents || 0) / 100).toFixed(2)} remaining`;
  };

  return (
    <View style={styles.container}>
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
                setAmount(text);
                setSelectedPreset(null);
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
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!selectedProvider || isLoading) && styles.sendButtonDisabled
            ]}
            onPress={handleSendPayment}
            disabled={!selectedProvider || isLoading}
          >
            <Text style={styles.sendButtonText}>
              {isLoading ? 'Processing...' : `Send $${amount} via ${selectedProvider || 'Provider'}`}
            </Text>
          </TouchableOpacity>
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
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
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
    color: '#6366f1',
    fontWeight: '600',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f9fafb',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 6,
  },
  budgetCard: {
    backgroundColor: '#1f2937',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  budgetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 12,
  },
  budgetBar: {
    height: 6,
    backgroundColor: '#374151',
    borderRadius: 3,
    marginBottom: 8,
  },
  budgetFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 3,
  },
  budgetText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 12,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  dollarSign: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f9fafb',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: '#f9fafb',
    padding: 16,
  },
  presetContainer: {
    marginTop: 16,
  },
  presetLabel: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 8,
  },
  presetButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  presetButton: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  presetButtonActive: {
    backgroundColor: '#1e1b4b',
    borderColor: '#6366f1',
  },
  presetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  presetButtonTextActive: {
    color: '#6366f1',
  },
  noteInput: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#f9fafb',
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
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#374151',
    alignItems: 'center',
    marginBottom: 12,
  },
  providerCardActive: {
    borderColor: '#6366f1',
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
    color: '#f9fafb',
    marginBottom: 4,
  },
  providerDescription: {
    fontSize: 11,
    color: '#9ca3af',
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
    backgroundColor: '#4b5563',
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  disclaimerCard: {
    backgroundColor: '#1f2937',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
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
    color: '#9ca3af',
    lineHeight: 18,
  },
});