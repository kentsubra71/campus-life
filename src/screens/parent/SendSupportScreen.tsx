import React, { useState } from 'react';
import { 
  ScrollView, 
  View, 
  Text, 
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert
} from 'react-native';
import { useRewardsStore } from '../../stores/rewardsStore';
import { useAuthStore } from '../../stores/authStore';
import { sendMessage, getCurrentUser } from '../../lib/firebase';

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
  
  const [selectedType, setSelectedType] = useState<'message' | 'boost'>(preselectedType === 'voice' ? 'message' : preselectedType);
  const [customMessage, setCustomMessage] = useState('');
  const [boostAmount, setBoostAmount] = useState(5);
  const [familyMembers, setFamilyMembers] = useState<{ parents: any[]; students: any[] }>({ parents: [], students: [] });

  React.useEffect(() => {
    const loadFamilyData = async () => {
      const members = await getFamilyMembers();
      setFamilyMembers(members);
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
      "So proud of how you're taking care of yourself! 💜",
      "Just wanted you to know I'm thinking of you today ☀️",
      "You're doing an amazing job growing and learning! 🌟",
      "Miss you and love seeing your progress 💙",
      "Remember that you're strong and capable of anything! 💪"
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
      if (monthlyEarned + boostAmount > 50) {
        Alert.alert(
          'Monthly Limit Reached',
          `This would exceed your $50 monthly limit. You have $${50 - monthlyEarned} remaining this month.\n\nConsider sending a message or care package instead!`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Choose Different Support', onPress: () => setSelectedType('message') }
          ]
        );
        return;
      }
    }

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

    console.log('📤 Sending message:', {
      from: currentUser.uid,
      to: studentId,
      type: selectedType,
      content: message,
      boost_amount: selectedType === 'boost' ? boostAmount : undefined
    });

    try {
      const messageData = {
        from_user_id: currentUser.uid,
        to_user_id: studentId,
        from_name: user.name || currentUser.displayName || 'Parent',
        to_name: studentName,
        message_type: selectedType,
        content: message,
        family_id: family.id,
        read: false,
        ...(selectedType === 'boost' && { boost_amount: boostAmount })
      };
      
      const result = await sendMessage(messageData);

      if (result.success) {
        console.log('✅ Message sent successfully!');
        Alert.alert(
          'Support Sent! 💙',
          `Your ${selectedType === 'boost' ? `$${boostAmount} care boost` : selectedType.replace('_', ' ')} has been sent to ${studentName.split(' ')[0]}.\n\n"${message}"`,
          [
            { text: 'Send Another', onPress: () => {
              setCustomMessage('');
            }},
            { text: 'Done', onPress: () => navigation.goBack() }
          ]
        );
      } else {
        console.error('❌ Failed to send message:', result.error);
        Alert.alert(
          'Failed to Send',
          `Unable to send your message: ${result.error}. Please try again.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('❌ Error sending message:', error);
      Alert.alert(
        'Error',
        'Something went wrong while sending your message. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const getRemainingBudget = () => 50 - monthlyEarned;

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
            <Text style={styles.subtitle}>💙 Responding to their support request</Text>
          ) : (
            <Text style={styles.subtitle}>Choose how to show you care</Text>
          )}
        </View>

        {/* Support Request Context */}
        {route?.params?.preselectedType && (
          <View style={styles.contextCard}>
            <Text style={styles.contextTitle}>💙 {targetStudent} requested support</Text>
            <Text style={styles.contextText}>
              They're letting you know they could use some extra care right now. 
              Choose the best way to support them below.
            </Text>
          </View>
        )}

        {/* Monthly Budget Indicator */}
        <View style={styles.budgetCard}>
          <Text style={styles.budgetTitle}>Monthly Care Budget</Text>
          <View style={styles.budgetBar}>
            <View 
              style={[
                styles.budgetFill, 
                { width: `${(monthlyEarned / 50) * 100}%` }
              ]} 
            />
          </View>
          <Text style={styles.budgetText}>
            ${monthlyEarned} used / ${getRemainingBudget()} remaining of $50
          </Text>
        </View>

        {/* Support Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Type of Support</Text>
          <View style={styles.typeGrid}>
            <TouchableOpacity 
              style={[styles.typeCard, selectedType === 'message' && styles.typeCardActive]}
              onPress={() => setSelectedType('message')}
            >
              <Text style={styles.typeEmoji}>💬</Text>
              <Text style={styles.typeTitle}>Message</Text>
              <Text style={styles.typeDesc}>Words of love</Text>
            </TouchableOpacity>



            <TouchableOpacity 
              style={[styles.typeCard, selectedType === 'boost' && styles.typeCardActive]}
              onPress={() => setSelectedType('boost')}
            >
              <Text style={styles.typeEmoji}>✨</Text>
              <Text style={styles.typeTitle}>Care Boost</Text>
              <Text style={styles.typeDesc}>Small surprise</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Care Boost Amount Selection */}
        {selectedType === 'boost' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Care Boost Amount</Text>
            <View style={styles.amountOptions}>
              {[5, 10, 15, 20].map(amount => (
                <TouchableOpacity
                  key={amount}
                  style={[
                    styles.amountOption,
                    boostAmount === amount && styles.amountOptionActive,
                    monthlyEarned + amount > 50 && styles.amountOptionDisabled
                  ]}
                  onPress={() => setBoostAmount(amount)}
                  disabled={monthlyEarned + amount > 50}
                >
                  <Text style={[
                    styles.amountText,
                    boostAmount === amount && styles.amountTextActive,
                    monthlyEarned + amount > 50 && styles.amountTextDisabled
                  ]}>
                    ${amount}
                  </Text>
                  {monthlyEarned + amount > 50 && (
                    <Text style={styles.exceededText}>Exceeds limit</Text>
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
          {supportTemplates[selectedType].map((template, index) => (
            <TouchableOpacity
              key={index}
              style={styles.templateCard}
              onPress={() => setCustomMessage(template)}
            >
              <Text style={styles.templateText}>{template}</Text>
            </TouchableOpacity>
          ))}
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
              selectedType === 'boost' && monthlyEarned + boostAmount > 50 && styles.sendButtonDisabled
            ]}
            onPress={sendSupport}
            disabled={selectedType === 'boost' && monthlyEarned + boostAmount > 50}
          >
            <Text style={styles.sendButtonText}>
              Send {selectedType === 'boost' ? `$${boostAmount} Care Boost` : selectedType.replace('_', ' ')} 💙
            </Text>
          </TouchableOpacity>
          
          {selectedType === 'boost' && monthlyEarned + boostAmount > 50 && (
            <Text style={styles.limitWarning}>
              This amount would exceed your monthly $50 limit
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
    fontSize: 22,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 16,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  typeCard: {
    width: '48%',
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#374151',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeCardActive: {
    borderColor: '#6366f1',
    backgroundColor: '#1e1b4b',
  },
  typeEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  typeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 4,
  },
  typeDesc: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
  amountOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  amountOption: {
    flex: 1,
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#374151',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  amountOptionActive: {
    borderColor: '#6366f1',
    backgroundColor: '#1e1b4b',
  },
  amountOptionDisabled: {
    backgroundColor: '#0f172a',
    borderColor: '#374151',
  },
  amountText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f9fafb',
  },
  amountTextActive: {
    color: '#6366f1',
  },
  amountTextDisabled: {
    color: '#6b7280',
  },
  exceededText: {
    fontSize: 10,
    color: '#dc2626',
    marginTop: 4,
  },
  templateCard: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  templateText: {
    fontSize: 14,
    color: '#f9fafb',
    lineHeight: 20,
  },
  messageInput: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#f9fafb',
    textAlignVertical: 'top',
    minHeight: 100,
  },
  sendButton: {
    backgroundColor: '#6366f1',
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
  limitWarning: {
    fontSize: 12,
    color: '#dc2626',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  contextCard: {
    backgroundColor: '#1e40af',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  contextTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  contextText: {
    fontSize: 14,
    color: '#dbeafe',
    lineHeight: 20,
    textAlign: 'center',
  },
});