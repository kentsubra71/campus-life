import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { showMessage } from 'react-native-flash-message';
import { theme } from '../../styles/theme';
import { StatusHeader } from '../../components/StatusHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';
import { createItemRequest } from '../../lib/firebase';

interface ItemRequestScreenProps {
  navigation: any;
}

const ItemRequestScreen: React.FC<ItemRequestScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, getFamilyMembers } = useAuthStore();
  const [familyMembers, setFamilyMembers] = useState<{ parents: any[]; students: any[] }>({ parents: [], students: [] });
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [loading, setLoading] = useState(false);

  const predefinedAmounts = [10, 25, 50, 75, 100, 150];

  useEffect(() => {
    const loadFamilyMembers = async () => {
      if (user) {
        try {
          const members = await getFamilyMembers();
          setFamilyMembers(members);
        } catch (error) {
          console.error('Failed to load family members:', error);
        }
      }
    };
    loadFamilyMembers();
  }, [user, getFamilyMembers]);

  const handleSendRequest = async () => {
    if (!itemName.trim() || !itemPrice.trim() || !requestReason.trim()) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    const price = parseFloat(itemPrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price amount.');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'Please log in to send requests.');
      return;
    }

    // Find parent from family members
    const parent = familyMembers.parents[0];
    if (!parent) {
      Alert.alert('Error', 'No parent found in your family. Please contact support.');
      return;
    }

    try {
      setLoading(true);

      const { id, error } = await createItemRequest({
        student_id: user.id,
        parent_id: parent.id,
        item_name: itemName.trim(),
        item_price: Math.round(price * 100), // Convert to cents
        item_description: itemDescription.trim() || undefined,
        reason: requestReason.trim(),
      });

      if (error) {
        throw new Error(error);
      }

      showMessage({
        message: 'Request Sent!',
        description: `Your request for "${itemName}" has been sent to your family.`,
        type: 'success',
        backgroundColor: theme.colors.success,
        color: theme.colors.backgroundSecondary,
      });

      navigation.goBack();
    } catch (error: any) {
      console.error('Error sending item request:', error);
      Alert.alert('Error', error.message || 'Failed to send request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusHeader title="Request Item" />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
        style={[styles.scrollContainer, { paddingTop: 50 }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Request an Item</Text>
          <Text style={styles.subtitle}>Ask your family for something you need</Text>
        </View>

        {/* Item Name */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>What do you need? *</Text>
          <TextInput
            style={styles.textInput}
            value={itemName}
            onChangeText={setItemName}
            placeholder="e.g., New headphones, Textbook, Winter coat"
            placeholderTextColor={theme.colors.textTertiary}
          />
        </View>

        {/* Item Price */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Estimated Price *</Text>
          <View style={styles.priceSection}>
            <TextInput
              style={styles.priceInput}
              value={itemPrice}
              onChangeText={setItemPrice}
              placeholder="0.00"
              placeholderTextColor={theme.colors.textTertiary}
              keyboardType="decimal-pad"
            />
            <Text style={styles.pricePrefix}>$</Text>
          </View>
          
          {/* Quick Amount Buttons */}
          <Text style={styles.quickAmountLabel}>Quick amounts:</Text>
          <View style={styles.quickAmounts}>
            {predefinedAmounts.map((amount) => (
              <TouchableOpacity
                key={amount}
                style={styles.quickAmountButton}
                onPress={() => setItemPrice(amount.toString())}
              >
                <Text style={styles.quickAmountText}>${amount}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Item Description */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Description (Optional)</Text>
          <TextInput
            style={styles.textAreaInput}
            value={itemDescription}
            onChangeText={setItemDescription}
            placeholder="Brand, model, where to buy, or other details..."
            placeholderTextColor={theme.colors.textTertiary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Reason */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Why do you need this? *</Text>
          <TextInput
            style={styles.textAreaInput}
            value={requestReason}
            onChangeText={setRequestReason}
            placeholder="e.g., For my classes, My old one broke, For the winter weather..."
            placeholderTextColor={theme.colors.textTertiary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Send Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.sendButton,
              (loading || !itemName.trim() || !itemPrice.trim() || !requestReason.trim()) && styles.sendButtonDisabled
            ]}
            onPress={handleSendRequest}
            disabled={loading || !itemName.trim() || !itemPrice.trim() || !requestReason.trim()}
          >
            <Text style={styles.sendButtonText}>
              {loading ? 'Sending...' : 'Send Request'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.helpText}>
            Your family will receive this request and can choose to approve it
          </Text>
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
    marginBottom: 30,
    paddingTop: 10,
    paddingHorizontal: 24,
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  textAreaInput: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.colors.textPrimary,
    minHeight: 100,
  },
  priceSection: {
    position: 'relative',
    marginBottom: 16,
  },
  priceInput: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 16,
    paddingLeft: 40,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  pricePrefix: {
    position: 'absolute',
    left: 16,
    top: 18,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  quickAmountLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    fontWeight: '500',
  },
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAmountButton: {
    backgroundColor: theme.colors.backgroundTertiary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 16,
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 48,
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
  helpText: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
});

export default ItemRequestScreen;