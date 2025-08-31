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
      <Text style={styles.title}>Money Received</Text>
      
      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryAmount}>
            ${(summary.thisWeek / 100).toFixed(2)}
          </Text>
          <Text style={styles.summaryLabel}>This Week</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <Text style={styles.summaryAmount}>
            ${(summary.thisMonth / 100).toFixed(2)}
          </Text>
          <Text style={styles.summaryLabel}>This Month</Text>
        </View>
      </View>
      
      <View style={styles.singleCard}>
        <Text style={styles.summaryAmount}>
          {summary.recentCount}
        </Text>
        <Text style={styles.summaryLabel}>Recent Payments</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.backgroundCard,
    borderRadius: 12,
    margin: 16,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  loadingText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
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
  summaryGrid: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  singleCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 12,
  },
  summaryAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
});