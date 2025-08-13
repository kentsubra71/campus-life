import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../stores/authStore';

interface Payment {
  id: string;
  parent_id: string;
  student_id: string;
  provider: string;
  intent_cents: number;
  note?: string;
  status: string;
  created_at: any;
  confirmed_at?: any;
  parent_name?: string;
}

export const ReceivedPayments: React.FC = () => {
  const { user } = useAuthStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadReceivedPayments();
    }
  }, [user]);

  const loadReceivedPayments = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Get completed payments for this student
      const q = query(
        collection(db, 'payments'),
        where('student_id', '==', user.id),
        where('status', 'in', ['completed', 'confirmed_by_parent'])
      );
      
      const snapshot = await getDocs(q);
      const paymentsData: Payment[] = [];
      
      // Get payment data and parent names
      for (const doc of snapshot.docs) {
        const paymentData = doc.data();
        
        // Get parent name
        try {
          const parentQuery = query(
            collection(db, 'users'),
            where('id', '==', paymentData.parent_id)
          );
          const parentSnapshot = await getDocs(parentQuery);
          const parentName = parentSnapshot.docs[0]?.data()?.full_name || 'Parent';
          
          paymentsData.push({
            id: doc.id,
            ...paymentData,
            parent_name: parentName
          } as Payment);
        } catch (error) {
          // If parent lookup fails, still include payment
          paymentsData.push({
            id: doc.id,
            ...paymentData,
            parent_name: 'Parent'
          } as Payment);
        }
      }
      
      // Sort by date (newest first)
      paymentsData.sort((a, b) => {
        const aTime = a.confirmed_at?.seconds || a.created_at?.seconds || 0;
        const bTime = b.confirmed_at?.seconds || b.created_at?.seconds || 0;
        return bTime - aTime;
      });
      
      setPayments(paymentsData);
    } catch (error) {
      console.error('Error loading received payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (payment: Payment) => {
    const timestamp = payment.confirmed_at || payment.created_at;
    if (!timestamp) return 'Recently';
    
    const date = new Date(timestamp.seconds * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const totalReceived = payments.reduce((sum, payment) => sum + payment.intent_cents, 0);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading payments...</Text>
      </View>
    );
  }

  if (payments.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>💰 Money Received</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>💸</Text>
          <Text style={styles.emptyTitle}>No payments yet</Text>
          <Text style={styles.emptyText}>
            When your parents send you money, it will appear here
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>💰 Money Received</Text>
        <Text style={styles.totalAmount}>
          ${(totalReceived / 100).toFixed(2)} total
        </Text>
      </View>

      <ScrollView style={styles.paymentsList} showsVerticalScrollIndicator={false}>
        {payments.map((payment) => (
          <View key={payment.id} style={styles.paymentCard}>
            <View style={styles.paymentHeader}>
              <View style={styles.paymentInfo}>
                <Text style={styles.amount}>
                  +${(payment.intent_cents / 100).toFixed(2)}
                </Text>
                <Text style={styles.fromText}>
                  from {payment.parent_name?.split(' ')[0] || 'Parent'}
                </Text>
              </View>
              <View style={styles.paymentMeta}>
                <Text style={styles.time}>{formatTime(payment)}</Text>
                <Text style={styles.provider}>
                  {payment.provider?.charAt(0).toUpperCase()}{payment.provider?.slice(1)}
                </Text>
              </View>
            </View>
            
            {payment.note && (
              <View style={styles.noteContainer}>
                <Text style={styles.note}>"{payment.note}"</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    margin: 16,
    padding: 16,
  },
  loadingText: {
    color: '#9ca3af',
    textAlign: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f9fafb',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
  paymentsList: {
    maxHeight: 300,
  },
  paymentCard: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  paymentInfo: {
    flex: 1,
  },
  amount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 2,
  },
  fromText: {
    fontSize: 14,
    color: '#d1d5db',
  },
  paymentMeta: {
    alignItems: 'flex-end',
  },
  time: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 2,
  },
  provider: {
    fontSize: 11,
    color: '#6b7280',
    backgroundColor: '#4b5563',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  noteContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#4b5563',
  },
  note: {
    fontSize: 13,
    color: '#d1d5db',
    fontStyle: 'italic',
  },
});