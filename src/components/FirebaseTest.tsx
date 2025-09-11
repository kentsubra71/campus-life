import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { getCurrentUser, db, getUserProfile } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

export const FirebaseTest: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>(['Firebase Test Loading...']);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (message: string) => {
    console.log(message);
    setTestResults(prev => [...prev, message]);
  };

  useEffect(() => {
    runTests();
  }, []);

  const runTests = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setTestResults(['🔥 Firebase Test Starting...']);
    
    try {
      // Test 0: Check current user
      const user = getCurrentUser();
      if (!user) {
        addResult('❌ No authenticated user found');
        setIsRunning(false);
        return;
      }

      addResult(`✅ User authenticated: ${user.uid} (${user.email})`);

      // Test 1: Read own user document
      addResult('\n🧪 TEST 1: Reading own user document...');
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          addResult(`✅ Own user document SUCCESS: family_id=${userData.family_id}, user_type=${userData.user_type}`);
        } else {
          addResult('❌ Own user document does not exist');
        }
      } catch (error: any) {
        addResult(`❌ Own user document FAILED: ${error.message} (code: ${error.code})`);
      }

      // Test 2: getUserProfile function
      addResult('\n🧪 TEST 2: Testing getUserProfile function...');
      try {
        const profile = await getUserProfile(user.uid);
        if (profile) {
          addResult(`✅ getUserProfile SUCCESS: family_id=${profile.family_id}, user_type=${profile.user_type}`);
        } else {
          addResult('❌ getUserProfile returned null');
        }
      } catch (error: any) {
        addResult(`❌ getUserProfile FAILED: ${error.message} (code: ${error.code})`);
      }

      // Test 3: Query payments
      addResult('\n🧪 TEST 3: Querying payments...');
      try {
        const paymentsQuery = query(
          collection(db, 'payments'),
          where('parent_id', '==', user.uid)
        );
        const paymentsSnapshot = await getDocs(paymentsQuery);
        addResult(`✅ Payments query SUCCESS: ${paymentsSnapshot.size} documents`);
      } catch (error: any) {
        addResult(`❌ Payments query FAILED: ${error.message} (code: ${error.code})`);
      }

      // Test 4: Query messages
      addResult('\n🧪 TEST 4: Querying messages...');
      try {
        const messagesQuery = query(
          collection(db, 'messages'),
          where('from_user_id', '==', user.uid)
        );
        const messagesSnapshot = await getDocs(messagesQuery);
        addResult(`✅ Messages query SUCCESS: ${messagesSnapshot.size} documents`);
      } catch (error: any) {
        addResult(`❌ Messages query FAILED: ${error.message} (code: ${error.code})`);
      }

      addResult('\n🏁 Firebase tests complete');
    } catch (outerError: any) {
      addResult(`❌ OUTER ERROR: ${outerError.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Firebase Test Results</Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={() => runTests()}
          disabled={isRunning}
        >
          <Text style={styles.retryText}>
            {isRunning ? 'Running...' : 'Retry Tests'}
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scrollView}>
        {testResults.map((result, index) => (
          <Text key={index} style={styles.result}>
            {result}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    padding: 8,
    borderRadius: 4,
  },
  retryText: {
    color: 'white',
    fontSize: 12,
  },
  scrollView: {
    flex: 1,
    maxHeight: 200,
  },
  result: {
    fontSize: 10,
    fontFamily: 'monospace',
    marginBottom: 2,
    lineHeight: 12,
  },
});