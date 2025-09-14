import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { verifyPayPalPayment } from '../lib/paypalIntegration';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../stores/authStore';

export const PaymentTestPanel: React.FC = () => {
  const { user } = useAuthStore();
  const [paymentId, setPaymentId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);

  const getLatestPayment = async () => {
    if (!user) return;
    
    try {
      // First try with orderBy
      let q = query(
        collection(db, 'payments'),
        where('parent_id', '==', user.id),
        where('status', '==', 'initiated'),
        orderBy('created_at', 'desc'),
        limit(1)
      );
      
      let snapshot;
      try {
        snapshot = await getDocs(q);
      } catch (indexError) {
        // Fallback without orderBy if index doesn't exist
        console.log('Using fallback query without orderBy');
        q = query(
          collection(db, 'payments'),
          where('parent_id', '==', user.id),
          where('status', '==', 'initiated')
        );
        snapshot = await getDocs(q);
      }
      
      if (!snapshot.empty) {
        // Sort manually if using fallback
        const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const sortedPayments = payments.sort((a: any, b: any) => 
          b.created_at?.seconds - a.created_at?.seconds
        );
        
        const latestPayment = sortedPayments[0];
        setPaymentId(latestPayment.id);
        
        Alert.alert(
          'Latest Payment Found',
          `Payment ID: ${latestPayment.id}\nAmount: $${(latestPayment.intent_cents / 100).toFixed(2)}\nStatus: ${latestPayment.status}\n\nNow you need to get the PayPal Order ID from your PayPal transaction.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('No Payments', 'No pending payments found');
      }
    } catch (error: any) {
      console.error('Error getting latest payment:', error);
      Alert.alert('Error', error.message);
    }
  };

  const manualVerify = async () => {
    if (!paymentId || !orderId) {
      Alert.alert('Missing Info', 'Please enter both Payment ID and Order ID');
      return;
    }

    setLoading(true);
    try {
      const result = await verifyPayPalPayment(paymentId, orderId);
      
      if (result.success) {
        Alert.alert('Success!', 'Payment verified and marked as completed!');
        setPaymentId('');
        setOrderId('');
      } else {
        Alert.alert('Verification Failed', result.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🧪 Payment Test Panel</Text>
      
      <TouchableOpacity style={styles.button} onPress={getLatestPayment}>
        <Text style={styles.buttonText}>Get Latest Pending Payment</Text>
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Payment ID (from Firebase)"
        placeholderTextColor="#9ca3af"
        value={paymentId}
        onChangeText={setPaymentId}
        multiline
      />

      <TextInput
        style={styles.input}
        placeholder="PayPal Order ID (from PayPal transaction)"
        placeholderTextColor="#9ca3af"
        value={orderId}
        onChangeText={setOrderId}
      />

      <TouchableOpacity 
        style={[styles.verifyButton, loading && styles.disabled]} 
        onPress={manualVerify}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? '🔄 Verifying...' : '✅ Verify Payment'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.instructions}>
        Instructions:{'\n'}
        1. Tap "Get Latest Pending Payment" to auto-fill Payment ID{'\n'}
        2. Check PayPal sandbox for the Order ID{'\n'}
        3. Enter the Order ID manually{'\n'}
        4. Tap "Verify Payment" to complete it
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1f2937',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f9fafb',
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#6366f1',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  verifyButton: {
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  disabled: {
    backgroundColor: '#6b7280',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#374151',
    color: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 14,
  },
  instructions: {
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 16,
  },
});