import React, { useState } from 'react';
import { 
  ScrollView, 
  View, 
  Text, 
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Image
} from 'react-native';
import { useRewardsStore } from '../../stores/rewardsStore';
import { useAuthStore } from '../../stores/authStore';
import { sendMessage, getCurrentUser } from '../../lib/firebase';
import { createPaymentIntent, getCurrentSpendingCaps } from '../../lib/payments';
import { createTestSubscription } from '../../lib/subscriptionWebhooks';
import * as Linking from 'expo-linking';
import { theme } from '../../styles/theme';

interface SendSupportScreenProps {
  navigation: any;
  route?: {
    params?: {
      preselectedType?: 'message' | 'boost';
      selectedStudentId?: string;
      selectedStudentName?: string;
      selectedStudentIndex?: number;
    };
  };
}

export const SendSupportScreen: React.FC<SendSupportScreenProps> = ({ navigation, route }) => {
  const { monthlyEarned } = useRewardsStore();
  const { getFamilyMembers } = useAuthStore();
  const preselectedType = route?.params?.preselectedType || 'message';
  const selectedStudentName = route?.params?.selectedStudentName;
  const selectedStudentId = route?.params?.selectedStudentId;
  const selectedStudentIndex = route?.params?.selectedStudentIndex || 0;
  
  const [selectedType, setSelectedType] = useState<'message' | 'boost'>(preselectedType || 'message');
  const [customMessage, setCustomMessage] = useState('');
  const [boostAmount, setBoostAmount] = useState(5);
  const [selectedProvider, setSelectedProvider] = useState<'paypal' | 'venmo' | 'cashapp' | 'zelle' | null>(null);
  const [spendingInfo, setSpendingInfo] = useState<any>(null);
  const [familyMembers, setFamilyMembers] = useState<{ parents: any[]; students: any[] }>({ parents: [], students: [] });

  React.useEffect(() => {
    const loadFamilyData = async () => {
      const members = await getFamilyMembers();
      setFamilyMembers(members);
      
      // Load spending caps for boost payments
      try {
        const caps = await getCurrentSpendingCaps();
        if (caps.success) {
          setSpendingInfo(caps);
        } else {
          console.log('No subscription found, creating test subscription');
          // Create a test subscription for this user
          const currentUser = getCurrentUser();
          if (currentUser) {
            await createTestSubscription(currentUser.uid, 'basic');
            // Try loading caps again
            const retrycaps = await getCurrentSpendingCaps();
            if (retrycaps.success) {
              setSpendingInfo(retrycaps);
            } else {
              // Fallback to default
              setSpendingInfo({
                capCents: 2500,
                spentCents: 0,
                remainingCents: 2500,
                periodStart: new Date(),
                periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
              });
            }
          }
        }
      } catch (error) {
        console.error('Error loading spending caps:', error);
        // Set default for testing
        setSpendingInfo({
          capCents: 2500,
          spentCents: 0,
          remainingCents: 2500,
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });
      }
    };
    loadFamilyData();
  }, []);

  // Get the target student for display
  const targetStudent = selectedStudentName || 
    (familyMembers.students[selectedStudentIndex]?.name) || 
    familyMembers.students[0]?.name || 
    'Student';

  // Debug logging
  console.log('🎯 SendSupport Debug:', {
    selectedStudentName,
    selectedStudentId,
    selectedStudentIndex,
    targetStudent,
    familyStudents: familyMembers.students.map(s => ({ id: s.id, name: s.name }))
  });

  const supportTemplates = {
    message: [
      "So proud of how you're taking care of yourself!",
      "Just wanted you to know I'm thinking of you today",
      "You're doing an amazing job growing and learning!",
      "Miss you and love seeing your progress",
      "Remember that you're strong and capable of anything!"
    ],
    boost: [
      "Great job maintaining your wellness routine!",
      "Proud of your consistency this week!",
      "Amazing streak - you deserve a treat!",
      "Noticed you've been taking great care of yourself!",
      "Your hard work is paying off!"
    ]
  };

  const sendSupport = async () => {
    if (selectedType === 'boost') {
      // For care boost, we need actual payment
      if (!selectedProvider) {
        Alert.alert('Select Payment Method', 'Choose how you want to send the money (PayPal, Venmo, etc.)');
        return;
      }

      // Check spending limits
      if (spendingInfo && boostAmount * 100 > (spendingInfo.remainingCents || 0)) {
        const remaining = (spendingInfo.remainingCents || 0) / 100;
        Alert.alert(
          'Monthly Limit Exceeded',
          `This would exceed your monthly limit. You have $${remaining.toFixed(2)} remaining.\n\nUpgrade your plan for a higher limit.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Choose Different Support', onPress: () => setSelectedType('message') }
          ]
        );
        return;
      }

      // Create real payment intent
      const studentId = selectedStudentId || familyMembers.students[selectedStudentIndex]?.id || familyMembers.students[0]?.id;
      
      if (!studentId) {
        Alert.alert('Error', 'Unable to find student to send payment to.');
        return;
      }

      try {
        const result = await createPaymentIntent(
          studentId,
          boostAmount * 100, // Convert to cents
          selectedProvider,
          customMessage || `Care boost from Mom/Dad: $${boostAmount}`
        );

        if (result.success) {
          // Open the provider app/website
          if (result.redirectUrl) {
            await Linking.openURL(result.redirectUrl);
          }

          // Navigate to confirmation screen
          navigation.navigate('PaymentReturn', {
            paymentId: result.paymentId,
            action: 'return'
          });
        } else {
          Alert.alert('Payment Error', result.error || 'Failed to create payment');
        }
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to create payment');
      }
      return;
    }

    // For messages, use the existing flow
    const message = customMessage || supportTemplates[selectedType][0];
    const currentUser = getCurrentUser();
    const { user, family } = useAuthStore.getState();
    
    if (!currentUser || !user || !family) {
      Alert.alert('Error', 'Unable to send message. Please try again.');
      return;
    }

    // Get the correct student info
    const studentId = selectedStudentId || familyMembers.students[selectedStudentIndex]?.id || familyMembers.students[0]?.id;
    const studentName = targetStudent;
    
    if (!studentId) {
      Alert.alert('Error', 'Unable to find student to send message to.');
      return;
    }

    try {
      const messageData = {
        from_user_id: currentUser.uid,
        to_user_id: studentId,
        from_name: user.name || currentUser.displayName || 'Parent',
        to_name: studentName,
        message_type: selectedType,
        content: message,
        family_id: family.id,
        read: false
      };
      
      const result = await sendMessage(messageData);

      if (result.success) {
        Alert.alert(
          'Message Sent! 💙',
          `Your message has been sent to ${studentName.split(' ')[0]}.\n\n"${message}"`,
          [
            { text: 'Send Another', onPress: () => {
              setCustomMessage('');
            }},
            { text: 'Done', onPress: () => navigation.goBack() }
          ]
        );
      } else {
        Alert.alert('Failed to Send', result.error || 'Unable to send message');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Something went wrong while sending your message.');
    }
  };

  const getRemainingBudget = () => 50 - monthlyEarned;


  const getProviderLogo = (providerId: string) => {
    switch (providerId) {
      case 'paypal': return require('../../../assets/icons/paypal.png');
      case 'venmo': return require('../../../assets/icons/venmo.png');
      case 'cashapp': return require('../../../assets/icons/cashapp.png');
      case 'zelle': return null; // DEV: Use proper Zelle logo later
      default: return null;
    }
  };

  const getProviderTempColor = (providerId: string) => {
    switch (providerId) {
      case 'zelle': return '#6d1ed3';
      default: return theme.colors.primary;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Send Support to {targetStudent}</Text>
          {route?.params?.preselectedType ? (
            <View style={styles.statusRow}>
              <View style={styles.supportRequestBadge}>
                <Text style={styles.supportRequestBadgeText}>Support Request</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.subtitle}>Choose how to show you care</Text>
          )}
        </View>

        {/* Support Request Context */}
        {route?.params?.preselectedType && (
          <View style={styles.contextSection}>
            <Text style={styles.contextTitle}>{targetStudent} requested support</Text>
            <Text style={styles.contextText}>
              They're letting you know they could use some extra care right now. 
              Choose the best way to support them below.
            </Text>
          </View>
        )}

        {/* Monthly Budget - Clean Progress */}
        <View style={styles.budgetSection}>
          <View style={styles.budgetHeader}>
            <Text style={styles.budgetTitle}>Monthly Budget</Text>
            <Text style={styles.budgetRemaining}>${getRemainingBudget()} left</Text>
          </View>
          <View style={styles.budgetBarContainer}>
            <View style={styles.budgetBar}>
              <View 
                style={[
                  styles.budgetFill, 
                  { width: `${(monthlyEarned / 50) * 100}%` }
                ]} 
              />
            </View>
            <Text style={styles.budgetText}>
              ${monthlyEarned} of $50 used
            </Text>
          </View>
        </View>

        {/* Support Type Selection - Segmented Control */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Type of Support</Text>
          <View style={styles.segmentedControl}>
            <TouchableOpacity 
              style={[styles.segment, selectedType === 'message' && styles.activeSegment]}
              onPress={() => setSelectedType('message')}
            >
              <Text style={[styles.segmentText, selectedType === 'message' && styles.activeSegmentText]}>
                Message
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.segment, selectedType === 'boost' && styles.activeSegment]}
              onPress={() => setSelectedType('boost')}
            >
              <Text style={[styles.segmentText, selectedType === 'boost' && styles.activeSegmentText]}>
                Care Boost
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Care Boost Amount - Simple Cards */}
        {selectedType === 'boost' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Care Boost Amount</Text>
            <View style={styles.amountOptions}>
              {[5, 10, 15, 20, 25, 30].map(amount => (
                <TouchableOpacity
                  key={amount}
                  style={[
                    styles.amountOption,
                    boostAmount === amount && styles.amountOptionActive,
                    spendingInfo && amount * 100 > (spendingInfo.remainingCents || 0) && styles.amountOptionDisabled
                  ]}
                  onPress={() => setBoostAmount(amount)}
                  disabled={spendingInfo && amount * 100 > (spendingInfo.remainingCents || 0)}
                >
                  <Text style={[
                    styles.amountText,
                    boostAmount === amount && styles.amountTextActive,
                    spendingInfo && amount * 100 > (spendingInfo.remainingCents || 0) && styles.amountTextDisabled
                  ]}>
                    ${amount}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Payment Method Selection for Care Boost */}
        {selectedType === 'boost' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <Text style={styles.sectionSubtitle}>Choose how to send the money</Text>
            <View style={styles.paymentProviders}>
              {[
                { id: 'paypal', name: 'PayPal', desc: 'Best experience', available: true },
                { id: 'venmo', name: 'Venmo', desc: 'Coming Soon', available: false },
                { id: 'cashapp', name: 'Cash App', desc: 'Coming Soon', available: false },
                { id: 'zelle', name: 'Zelle', desc: 'Coming Soon', available: false }
              ].map((provider) => (
                <TouchableOpacity
                  key={provider.id}
                  style={[
                    styles.providerRow,
                    selectedProvider === provider.id && styles.providerRowActive,
                    !provider.available && styles.providerRowDisabled
                  ]}
                  onPress={() => provider.available && setSelectedProvider(provider.id as any)}
                  disabled={!provider.available}
                >
                  <View style={styles.providerContent}>
                    <View style={styles.providerLogoContainer}>
                      {getProviderLogo(provider.id) ? (
                        <Image
                          source={getProviderLogo(provider.id)}
                          style={styles.providerLogoImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={[styles.tempLogoContainer, { backgroundColor: getProviderTempColor(provider.id) }]}>
                          <Text style={styles.tempLogoText}>
                            {provider.id === 'zelle' ? 'Z' : provider.name.charAt(0)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.providerInfo}>
                      <Text style={styles.providerName}>{provider.name}</Text>
                      <Text style={styles.providerDesc}>{provider.desc}</Text>
                    </View>
                  </View>
                  {selectedProvider === provider.id && (
                    <View style={styles.selectedIndicator}>
                      <Text style={styles.selectedIndicatorText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Template Messages */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Message Templates</Text>
          <Text style={styles.sectionSubtitle}>Tap to use, or write your own below</Text>
          <View style={styles.templateList}>
            {supportTemplates[selectedType].map((template, index) => (
              <TouchableOpacity
                key={index}
                style={styles.templateRow}
                onPress={() => setCustomMessage(template)}
              >
                <Text style={styles.templateText}>{template.replace(/[💜☀️🌟💙💪]/g, '').trim()}</Text>
                <Text style={styles.templateArrow}>→</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Custom Message */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Message</Text>
          <TextInput
            style={styles.messageInput}
            multiline
            numberOfLines={4}
            placeholder={`Write your ${selectedType === 'boost' ? 'care boost' : selectedType.replace('_', ' ')} message...`}
            placeholderTextColor="#9ca3af"
            value={customMessage}
            onChangeText={setCustomMessage}
          />
        </View>

        {/* Send Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[
              styles.sendButton,
              (selectedType === 'boost' && (!selectedProvider || (spendingInfo && boostAmount * 100 > (spendingInfo.remainingCents || 0)))) && styles.sendButtonDisabled
            ]}
            onPress={sendSupport}
            disabled={selectedType === 'boost' && (!selectedProvider || (spendingInfo && boostAmount * 100 > (spendingInfo.remainingCents || 0)))}
          >
            <Text style={styles.sendButtonText}>
              {selectedType === 'boost' 
                ? `Send $${boostAmount}`
                : 'Send Message'
              }
            </Text>
          </TouchableOpacity>
          
          {selectedType === 'boost' && !selectedProvider && (
            <Text style={styles.limitWarning}>
              Select a payment method to continue
            </Text>
          )}
          
          {selectedType === 'boost' && spendingInfo && boostAmount * 100 > (spendingInfo.remainingCents || 0) && (
            <Text style={styles.limitWarning}>
              This amount would exceed your monthly limit
            </Text>
          )}
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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
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
  // Status Row for Support Request
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  supportRequestBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  supportRequestBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  // Context Section
  contextSection: {
    paddingHorizontal: 24,
    marginBottom: 20,
    backgroundColor: theme.colors.secondary,
    marginHorizontal: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  contextTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  contextText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
  // Budget Section - Clean Progress
  budgetSection: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  budgetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  budgetRemaining: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  budgetBarContainer: {
    gap: 8,
  },
  budgetBar: {
    height: 6,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  budgetFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  budgetText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  // Segmented Control
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  activeSegment: {
    backgroundColor: theme.colors.secondary,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  activeSegmentText: {
    color: theme.colors.primaryDark,
    fontWeight: '600',
  },
  // Amount Options - Clean Grid
  amountOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  amountOption: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: theme.colors.backgroundSecondary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  amountOptionActive: {
    backgroundColor: theme.colors.secondary,
    borderColor: theme.colors.primary,
  },
  amountOptionDisabled: {
    opacity: 0.3,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  amountTextActive: {
    color: theme.colors.primaryDark,
  },
  amountTextDisabled: {
    color: theme.colors.textTertiary,
  },
  exceededText: {
    fontSize: 10,
    color: theme.colors.error,
    marginTop: 4,
  },
  // Template Messages
  templateList: {
    gap: 4,
  },
  templateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  templateText: {
    fontSize: 15,
    color: theme.colors.textPrimary,
    flex: 1,
    lineHeight: 20,
  },
  templateArrow: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  messageInput: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 25,
    alignItems: 'center',
    minWidth: 200,
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.textTertiary,
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  limitWarning: {
    fontSize: 12,
    color: theme.colors.error,
    textAlign: 'center',
    marginTop: 8,
  },
  // Payment Providers - Clean List
  paymentProviders: {
    gap: 4,
  },
  providerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  providerRowActive: {
    backgroundColor: theme.colors.secondary,
    marginHorizontal: -24,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  providerRowDisabled: {
    opacity: 0.5,
  },
  providerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  providerLogoContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  providerLogoImage: {
    width: 28,
    height: 28,
  },
  tempLogoContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tempLogoText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  providerDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  selectedIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedIndicatorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
});