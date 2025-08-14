import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../stores/authStore';
import { theme } from '../styles/theme';

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
        <View style={styles.header}>
          <Text style={styles.sectionTitle}>Money Received</Text>
        </View>
        <View style={styles.emptySection}>
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
        <Text style={styles.sectionTitle}>Money Received</Text>
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeText}>
            ${(totalReceived / 100).toFixed(2)} total
          </Text>
        </View>
      </View>

      <ScrollView style={styles.paymentsList} showsVerticalScrollIndicator={false}>
        {payments.map((payment) => (
          <View key={payment.id} style={styles.paymentItem}>
            <View style={styles.paymentContent}>
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
                  <View style={styles.providerTag}>
                    <Text style={styles.providerText}>
                      {payment.provider?.charAt(0).toUpperCase()}{payment.provider?.slice(1)}
                    </Text>
                  </View>
                </View>
              </View>
              
              {payment.note && (
                <View style={styles.noteSection}>
                  <Text style={styles.note}>\"{payment.note}\"</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  loadingText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    padding: 20,
  },
  
  // Header Section
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  totalBadge: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  totalBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // Empty State
  emptySection: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Payments List
  paymentsList: {
    maxHeight: 300,
  },
  paymentItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  paymentContent: {
    flex: 1,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  paymentInfo: {
    flex: 1,
  },
  amount: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.success,
    marginBottom: 2,
  },
  fromText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  paymentMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  time: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    marginBottom: 2,
  },
  providerTag: {
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  providerText: {
    fontSize: 11,
    color: theme.colors.primaryDark,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // Note Section
  noteSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  note: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
});