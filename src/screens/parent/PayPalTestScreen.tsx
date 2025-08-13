import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { testPayPalConnection, createPayPalP2POrder, getTransactionStatus } from '../../lib/paypalP2P';
import { verifyPayPalPayment, autoVerifyPendingPayPalPayments } from '../../lib/paypalIntegration';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../stores/authStore';

interface PayPalTestScreenProps {
  navigation: any;
}

export const PayPalTestScreen: React.FC<PayPalTestScreenProps> = ({ navigation }) => {
  const { user, getFamilyMembers } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [orderIdInput, setOrderIdInput] = useState('');
  const [pendingPayment, setPendingPayment] = useState<any>(null);

  const addTestResult = (name: string, success: boolean, data: any) => {
    const result = {
      id: Date.now(),
      name,
      success,
      data,
      timestamp: new Date().toLocaleTimeString()
    };
    setTestResults(prev => [result, ...prev]);
    console.log(`🔍 [PayPalTest] ${name}:`, { success, data });
  };

  const testConnection = async () => {
    setLoading(true);
    try {
      console.log('🔍 [PayPalTestScreen] Starting connection test...');
      const result = await testPayPalConnection();
      console.log('🔍 [PayPalTestScreen] Test result:', result);
      
      addTestResult('PayPal Connection Test', result.success, result);
      
      if (result.success) {
        Alert.alert('Success', 'PayPal connection is working!');
      } else {
        // Show detailed error information
        const errorMsg = result.error || 'PayPal connection failed';
        const details = result.details || '';
        const setupInstructions = (result as any).setupInstructions;
        
        let message = errorMsg;
        if (details) message += `\n\nDetails: ${details}`;
        if (setupInstructions) {
          message += '\n\nSetup Instructions:\n' + setupInstructions.join('\n');
        }
        
        Alert.alert('Connection Failed', message);
      }
    } catch (error: any) {
      console.error('🔍 [PayPalTestScreen] Test error:', error);
      addTestResult('PayPal Connection Test', false, { error: error.message, fullError: error });
      Alert.alert('Error', `Test failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testCreateOrder = async () => {
    setLoading(true);
    try {
      // Get a student to test with
      const members = await getFamilyMembers();
      const student = members.students[0];
      
      if (!student) {
        Alert.alert('Error', 'No students found in family');
        return;
      }

      const result = await createPayPalP2POrder(
        student.id,
        500, // $5.00
        'Test payment from Campus Life'
      );
      
      addTestResult('Create PayPal Order', result.success, result);
      
      if (result.success) {
        Alert.alert(
          'Order Created!',
          `Order ID: ${result.orderId}\nTransaction ID: ${result.transactionId}`,
          [
            { text: 'OK' },
            { 
              text: 'Test Return', 
              onPress: () => navigation.navigate('PayPalP2PReturn', {
                transactionId: result.transactionId,
                orderId: result.orderId,
                status: 'success'
              })
            }
          ]
        );
      } else {
        Alert.alert('Failed', result.error || 'Failed to create order');
      }
    } catch (error: any) {
      addTestResult('Create PayPal Order', false, { error: error.message });
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const testGetTransaction = async () => {
    if (testResults.length === 0) {
      Alert.alert('No Transactions', 'Create an order first to test transaction status');
      return;
    }

    // Find the most recent successful order creation
    const orderResult = testResults.find(r => r.name === 'Create PayPal Order' && r.success);
    
    if (!orderResult || !orderResult.data.transactionId) {
      Alert.alert('No Transaction ID', 'Create a successful order first');
      return;
    }

    setLoading(true);
    try {
      const result = await getTransactionStatus(orderResult.data.transactionId);
      addTestResult('Get Transaction Status', result.success, result);
      
      if (result.success) {
        Alert.alert(
          'Transaction Found!',
          `Status: ${result.transaction?.status}\nAmount: $${(result.transaction?.amountCents || 0) / 100}`
        );
      } else {
        Alert.alert('Failed', result.error || 'Failed to get transaction');
      }
    } catch (error: any) {
      addTestResult('Get Transaction Status', false, { error: error.message });
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const testVerifyPayment = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      console.log('🔍 Looking for pending payments for user:', user.id);
      
      // Get latest payment from Firebase
      let q = query(
        collection(db, 'payments'),
        where('parent_id', '==', user.id),
        where('status', '==', 'initiated')
      );
      
      const snapshot = await getDocs(q);
      console.log('🔍 Found payments:', snapshot.size);
      
      if (snapshot.empty) {
        Alert.alert('No Payments', 'No pending payments found. Create a payment first.');
        setLoading(false);
        return;
      }
      
      // Sort manually and get latest
      const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sortedPayments = payments.sort((a: any, b: any) => 
        b.created_at?.seconds - a.created_at?.seconds
      );
      const latestPayment = sortedPayments[0];
      
      console.log('🔍 Latest payment:', latestPayment);
      
      // Show modal for Order ID input
      setPendingPayment(latestPayment);
      setOrderIdInput('');
      setShowVerifyModal(true);
      
    } catch (error: any) {
      console.error('🔍 Error finding payments:', error);
      addTestResult('Find Pending Payment', false, { error: error.message });
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const executeVerification = async () => {
    if (!orderIdInput.trim() || !pendingPayment) return;
    
    setLoading(true);
    try {
      console.log('🔍 Verifying payment:', pendingPayment.id, 'with order:', orderIdInput.trim());
      
      const result = await verifyPayPalPayment(pendingPayment.id, orderIdInput.trim());
      
      console.log('🔍 Verification result:', result);
      
      addTestResult('Verify PayPal Payment', result.success, {
        paymentId: pendingPayment.id,
        orderId: orderIdInput.trim(),
        result
      });
      
      setShowVerifyModal(false);
      
      if (result.success) {
        Alert.alert('Success!', 'Payment verified and marked as completed!');
      } else {
        Alert.alert('Verification Failed', result.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error('🔍 Verification error:', error);
      addTestResult('Verify PayPal Payment', false, { error: error.message });
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const inspectPayments = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const q = query(
        collection(db, 'payments'),
        where('parent_id', '==', user.id),
        where('provider', '==', 'paypal')
      );
      
      const snapshot = await getDocs(q);
      const payments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('📋 All PayPal payments:', payments);
      
      addTestResult('Inspect PayPal Payments', true, {
        totalPayments: payments.length,
        paymentsWithOrderId: payments.filter(p => p.paypal_order_id).length,
        payments: payments.map(p => ({
          id: p.id,
          status: p.status,
          amount: (p.intent_cents / 100).toFixed(2),
          hasOrderId: !!p.paypal_order_id,
          orderIdPreview: p.paypal_order_id ? `${p.paypal_order_id.substring(0, 8)}...` : 'None'
        }))
      });
      
      Alert.alert(
        'Payment Inspection',
        `Found ${payments.length} PayPal payments\n${payments.filter(p => p.paypal_order_id).length} have Order IDs stored\n${payments.filter(p => p.status === 'initiated').length} are pending`
      );
      
    } catch (error: any) {
      addTestResult('Inspect PayPal Payments', false, { error: error.message });
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const testAutoVerify = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      console.log('🔍 Starting auto-verification of pending payments...');
      const verifiedCount = await autoVerifyPendingPayPalPayments(user.id);
      
      addTestResult('Auto-Verify PayPal Payments', true, {
        verifiedCount,
        message: `Checked and verified ${verifiedCount} payments`
      });
      
      Alert.alert(
        'Auto-Verification Complete',
        verifiedCount > 0 
          ? `✅ Verified ${verifiedCount} completed payments!`
          : `ℹ️ No completed payments found to verify.`
      );
      
    } catch (error: any) {
      addTestResult('Auto-Verify PayPal Payments', false, { error: error.message });
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>PayPal P2P Testing</Text>
        <Text style={styles.subtitle}>Debug and test PayPal integration</Text>
      </View>

      <View style={styles.testButtons}>
        <TouchableOpacity
          style={[styles.testButton, styles.primaryButton]}
          onPress={testConnection}
          disabled={loading}
        >
          <Text style={styles.testButtonText}>
            {loading ? 'Testing...' : '1. Test Connection'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, styles.secondaryButton]}
          onPress={testCreateOrder}
          disabled={loading}
        >
          <Text style={styles.testButtonText}>
            2. Create Test Order
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, styles.secondaryButton]}
          onPress={testGetTransaction}
          disabled={loading}
        >
          <Text style={styles.testButtonText}>
            3. Get Transaction Status
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, { backgroundColor: '#10b981' }]}
          onPress={testVerifyPayment}
          disabled={loading}
        >
          <Text style={styles.testButtonText}>
            🔧 Verify Stuck Payment
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, { backgroundColor: '#f59e0b' }]}
          onPress={inspectPayments}
          disabled={loading}
        >
          <Text style={styles.testButtonText}>
            🔍 Inspect All Payments
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, { backgroundColor: '#8b5cf6' }]}
          onPress={testAutoVerify}
          disabled={loading}
        >
          <Text style={styles.testButtonText}>
            🚀 Auto-Verify All Payments
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, styles.warningButton]}
          onPress={clearResults}
          disabled={loading}
        >
          <Text style={styles.testButtonText}>Clear Results</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Running test...</Text>
        </View>
      )}

      <ScrollView style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>Test Results ({testResults.length})</Text>
        
        {testResults.map((result) => (
          <View
            key={result.id}
            style={[
              styles.resultCard,
              result.success ? styles.successCard : styles.errorCard
            ]}
          >
            <View style={styles.resultHeader}>
              <Text style={styles.resultName}>{result.name}</Text>
              <Text style={styles.resultTime}>{result.timestamp}</Text>
            </View>
            
            <Text style={[
              styles.resultStatus,
              result.success ? styles.successText : styles.errorText
            ]}>
              {result.success ? '✅ Success' : '❌ Failed'}
            </Text>
            
            <Text style={styles.resultData}>
              {JSON.stringify(result.data, null, 2)}
            </Text>
          </View>
        ))}

        {testResults.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No test results yet</Text>
            <Text style={styles.emptySubtext}>Run a test to see results here</Text>
          </View>
        )}
      </ScrollView>

      {/* Verification Modal */}
      <Modal
        visible={showVerifyModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowVerifyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Verify Payment</Text>
            
            {pendingPayment && (
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentText}>
                  Payment: ${(pendingPayment.intent_cents / 100).toFixed(2)}
                </Text>
                <Text style={styles.paymentId}>
                  ID: {pendingPayment.id}
                </Text>
              </View>
            )}
            
            <Text style={styles.modalInstruction}>
              Enter PayPal Order ID from your transaction:
            </Text>
            
            <TextInput
              style={styles.orderIdInput}
              value={orderIdInput}
              onChangeText={setOrderIdInput}
              placeholder="e.g. 8XN12345678901234"
              placeholderTextColor="#9ca3af"
              autoCapitalize="characters"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowVerifyModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.verifyButton, !orderIdInput.trim() && styles.disabledButton]}
                onPress={executeVerification}
                disabled={!orderIdInput.trim() || loading}
              >
                <Text style={styles.modalButtonText}>
                  {loading ? 'Verifying...' : 'Verify'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 20,
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
  },
  testButtons: {
    padding: 20,
    gap: 12,
  },
  testButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#059669',
  },
  secondaryButton: {
    backgroundColor: '#6366f1',
  },
  warningButton: {
    backgroundColor: '#dc2626',
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 12,
  },
  resultsContainer: {
    flex: 1,
    padding: 20,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 16,
  },
  resultCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  successCard: {
    backgroundColor: '#064e3b',
    borderColor: '#059669',
  },
  errorCard: {
    backgroundColor: '#7f1d1d',
    borderColor: '#dc2626',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f9fafb',
    flex: 1,
  },
  resultTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  resultStatus: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  successText: {
    color: '#10b981',
  },
  errorText: {
    color: '#f87171',
  },
  resultData: {
    fontSize: 12,
    color: '#d1d5db',
    fontFamily: 'monospace',
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#374151',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f9fafb',
    textAlign: 'center',
    marginBottom: 16,
  },
  paymentInfo: {
    backgroundColor: '#374151',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  paymentText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 4,
  },
  paymentId: {
    fontSize: 12,
    color: '#9ca3af',
    fontFamily: 'monospace',
  },
  modalInstruction: {
    fontSize: 14,
    color: '#d1d5db',
    marginBottom: 12,
  },
  orderIdInput: {
    backgroundColor: '#374151',
    color: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6b7280',
  },
  verifyButton: {
    backgroundColor: '#10b981',
  },
  disabledButton: {
    backgroundColor: '#4b5563',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});