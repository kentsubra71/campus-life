import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { testPayPalConnection, createPayPalP2POrder, getTransactionStatus } from '../../lib/paypalP2P';
import { useAuthStore } from '../../stores/authStore';

interface PayPalTestScreenProps {
  navigation: any;
}

export const PayPalTestScreen: React.FC<PayPalTestScreenProps> = ({ navigation }) => {
  const { getFamilyMembers } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);

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
});