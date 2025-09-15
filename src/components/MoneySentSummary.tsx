import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../stores/authStore';
import { theme } from '../styles/theme';
import { formatTimeAgo } from '../utils/dateUtils';

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

interface MoneySentSummaryProps {
  onViewAll: () => void;
}

export const MoneySentSummary: React.FC<MoneySentSummaryProps> = ({ onViewAll }) => {
  const { user, familyMembers } = useAuthStore();
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [totalThisWeek, setTotalThisWeek] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadRecentPayments();
    }
  }, [user]);

  const loadRecentPayments = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const q = query(
        collection(db, 'payments'),
        where('parent_id', '==', user.id),
        where('status', 'in', ['completed', 'confirmed_by_parent', 'initiated'])
      );
      
      const snapshot = await getDocs(q);
      const payments: Payment[] = [];
      
      snapshot.docs.forEach(doc => {
        payments.push({
          id: doc.id,
          ...doc.data()
        } as Payment);
      });
      
      // Sort by date and get recent ones
      payments.sort((a, b) => {
        const aTime = (a.confirmed_at || a.created_at)?.seconds || 0;
        const bTime = (b.confirmed_at || b.created_at)?.seconds || 0;
        return bTime - aTime;
      });
      
      // Calculate this week's total
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const weekTotal = payments
        .filter(payment => {
          const paymentDate = new Date((payment.confirmed_at || payment.created_at).seconds * 1000);
          return paymentDate >= oneWeekAgo;
        })
        .reduce((sum, payment) => sum + payment.intent_cents, 0);
      
      setRecentPayments(payments.slice(0, 3));
      setTotalThisWeek(weekTotal);
    } catch (error) {
      console.error('Error loading recent payments:', error);
      setRecentPayments([]);
      setTotalThisWeek(0);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (payment: Payment) => {
    const timestamp = payment.confirmed_at || payment.created_at;
    if (!timestamp) return 'Recently';
    
    return formatTimeAgo(timestamp.seconds * 1000);
  };

  const getStudentName = (studentId: string) => {
    if (!familyMembers || !familyMembers.students || familyMembers.students.length === 0) {
      return 'Student';
    }
    const student = familyMembers.students.find((member: any) =>
      member.id === studentId
    );
    return student ? student.name.split(' ')[0] : 'Student';
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'confirmed_by_parent': return 'Confirmed';
      case 'initiated': return 'Pending';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'confirmed_by_parent': 
        return '#10b981';
      case 'initiated': 
        return '#f59e0b';
      default: 
        return theme.colors.textSecondary;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Money Sent</Text>
        </View>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (recentPayments.length === 0) {
    return (
      <TouchableOpacity style={styles.container} onPress={onViewAll}>
        <View style={styles.header}>
          <Text style={styles.title}>Money Sent</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No payments sent yet</Text>
          <Text style={styles.tapText}>Tap to view details</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.container} onPress={onViewAll}>
      <View style={styles.header}>
        <Text style={styles.title}>Money Sent</Text>
        <Text style={styles.weekTotal}>
          ${(totalThisWeek / 100).toFixed(2)} this week
        </Text>
      </View>

      <View style={styles.recentList}>
        {recentPayments.map((payment) => (
          <View key={payment.id} style={styles.paymentRow}>
            <View style={styles.paymentInfo}>
              <Text style={styles.amount}>
                ${(payment.intent_cents / 100).toFixed(2)} to {getStudentName(payment.student_id)}
              </Text>
              <Text style={styles.time}>{formatTime(payment)}</Text>
            </View>
            <View style={styles.statusContainer}>
              <Text style={[styles.statusText, { color: getStatusColor(payment.status) }]}>
                {getStatusText(payment.status)}
              </Text>
              <Text style={styles.provider}>
                {payment.provider?.charAt(0).toUpperCase()}{payment.provider?.slice(1)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.viewAllText}>Tap to view all payments →</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  weekTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  loadingText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    padding: 20,
    paddingHorizontal: 24,
  },
  emptyState: {
    alignItems: 'center',
    padding: 20,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  tapText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  recentList: {
    marginBottom: 8,
    paddingHorizontal: 24,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  paymentInfo: {
    flex: 1,
    marginRight: 12,
  },
  amount: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  time: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  provider: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    backgroundColor: theme.colors.backgroundTertiary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 3,
  },
  viewAllText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 24,
  },
});