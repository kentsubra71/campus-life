import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
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
}

interface PaymentSummary {
  thisWeek: number;
  thisMonth: number;
  recentCount: number;
}

export const ReceivedPaymentsSummary: React.FC = () => {
  const { user } = useAuthStore();
  const [summary, setSummary] = useState<PaymentSummary>({
    thisWeek: 0,
    thisMonth: 0,
    recentCount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPaymentsSummary();
    }
  }, [user]);

  const loadPaymentsSummary = async () => {
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
      const payments: Payment[] = [];
      
      snapshot.docs.forEach(doc => {
        payments.push({
          id: doc.id,
          ...doc.data()
        } as Payment);
      });
      
      // Calculate date ranges
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // Calculate summary stats
      const thisWeek = payments
        .filter(payment => {
          const paymentDate = new Date((payment.confirmed_at || payment.created_at).seconds * 1000);
          return paymentDate >= oneWeekAgo;
        })
        .reduce((sum, payment) => sum + payment.intent_cents, 0);
      
      const thisMonth = payments
        .filter(payment => {
          const paymentDate = new Date((payment.confirmed_at || payment.created_at).seconds * 1000);
          return paymentDate >= oneMonthAgo;
        })
        .reduce((sum, payment) => sum + payment.intent_cents, 0);
      
      setSummary({
        thisWeek,
        thisMonth,
        recentCount: payments.length
      });
    } catch (error) {
      console.error('Error loading payments summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Money Received</Text>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (summary.recentCount === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Money Received</Text>
        <View style={styles.emptyState}>
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
      <View style={styles.summaryItem}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryTitle}>Money Received</Text>
          <Text style={styles.summaryTotal}>
            ${(summary.thisMonth / 100).toFixed(2)}
          </Text>
        </View>
        <Text style={styles.summarySubtitle}>
          ${(summary.thisWeek / 100).toFixed(2)} this week • {summary.recentCount} payments total
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
  },
  loadingText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  summaryItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  summaryTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
  },
  summarySubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
});