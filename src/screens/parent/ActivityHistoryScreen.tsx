import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface ActivityItem {
  id: string;
  type: 'payment' | 'message';
  timestamp: Date;
  amount?: number;
  provider?: string;
  status: string;
  note?: string;
  student_name?: string;
  message_content?: string;
  message_type?: string;
}

export const ActivityHistoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuthStore();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const allActivities: ActivityItem[] = [];

      // Load payments
      const paymentsQuery = query(
        collection(db, 'payments'),
        where('parent_id', '==', user.id),
        orderBy('created_at', 'desc')
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      
      for (const doc of paymentsSnapshot.docs) {
        const payment = doc.data();
        // Get student name
        const studentQuery = query(
          collection(db, 'users'),
          where('id', '==', payment.student_id)
        );
        const studentSnapshot = await getDocs(studentQuery);
        const studentName = studentSnapshot.docs[0]?.data()?.full_name || 'Student';

        allActivities.push({
          id: doc.id,
          type: 'payment',
          timestamp: payment.created_at.toDate(),
          amount: payment.intent_cents / 100,
          provider: payment.provider,
          status: payment.status,
          note: payment.note,
          student_name: studentName
        });
      }

      // Load messages
      try {
        const messagesQuery = query(
          collection(db, 'messages'),
          where('from_user_id', '==', user.id),
          orderBy('created_at', 'desc')
        );
        const messagesSnapshot = await getDocs(messagesQuery);
        
        for (const doc of messagesSnapshot.docs) {
          const message = doc.data();
          // Get recipient name
          const recipientQuery = query(
            collection(db, 'users'),
            where('id', '==', message.to_user_id)
          );
          const recipientSnapshot = await getDocs(recipientQuery);
          const recipientName = recipientSnapshot.docs[0]?.data()?.full_name || 'Student';

          allActivities.push({
            id: doc.id,
            type: 'message',
            timestamp: message.created_at.toDate(),
            status: message.read ? 'read' : 'sent',
            message_content: message.content,
            message_type: message.type || 'message',
            student_name: recipientName
          });
        }
      } catch (messageError) {
        console.log('Messages query failed (using fallback):', messageError);
        // Try fallback query without orderBy
        const messagesQuery = query(
          collection(db, 'messages'),
          where('from_user_id', '==', user.id)
        );
        const messagesSnapshot = await getDocs(messagesQuery);
        
        for (const doc of messagesSnapshot.docs) {
          const message = doc.data();
          const recipientQuery = query(
            collection(db, 'users'),
            where('id', '==', message.to_user_id)
          );
          const recipientSnapshot = await getDocs(recipientQuery);
          const recipientName = recipientSnapshot.docs[0]?.data()?.full_name || 'Student';

          allActivities.push({
            id: doc.id,
            type: 'message',
            timestamp: message.created_at.toDate(),
            status: message.read ? 'read' : 'sent',
            message_content: message.content,
            message_type: message.type || 'message',
            student_name: recipientName
          });
        }
      }

      // Sort all activities by timestamp
      allActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setActivities(allActivities);

    } catch (error) {
      console.error('Error loading activities:', error);
      Alert.alert('Error', 'Failed to load activity history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadActivities();
  };

  const getStatusColor = (type: string, status: string) => {
    if (type === 'payment') {
      switch (status) {
        case 'completed': return '#10b981';
        case 'confirmed_by_parent': return '#10b981';
        case 'sent': return '#f59e0b';
        case 'initiated': return '#6366f1';
        case 'pending': return '#6366f1';
        default: return '#9ca3af';
      }
    } else {
      switch (status) {
        case 'read': return '#10b981';
        case 'sent': return '#6366f1';
        default: return '#9ca3af';
      }
    }
  };

  const getStatusText = (type: string, status: string) => {
    if (type === 'payment') {
      switch (status) {
        case 'completed': return 'Completed';
        case 'confirmed_by_parent': return 'Confirmed';
        case 'sent': return 'Sent';
        case 'initiated': return 'Processing';
        case 'pending': return 'Pending';
        default: return status;
      }
    } else {
      switch (status) {
        case 'read': return 'Read';
        case 'sent': return 'Sent';
        default: return status;
      }
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const renderActivityItem = (item: ActivityItem) => {
    return (
      <TouchableOpacity key={item.id} style={styles.activityItem}>
        <View style={styles.activityHeader}>
          <View style={styles.activityInfo}>
            <Text style={styles.activityType}>
              {item.type === 'payment' ? '💰' : '💬'} 
              {item.type === 'payment' ? ' Payment' : ' Message'}
              {item.student_name && ` to ${item.student_name.split(' ')[0]}`}
            </Text>
            <Text style={styles.activityTime}>{formatTime(item.timestamp)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.type, item.status) }]}>
            <Text style={styles.statusText}>{getStatusText(item.type, item.status)}</Text>
          </View>
        </View>

        {item.type === 'payment' && (
          <View style={styles.paymentDetails}>
            <Text style={styles.paymentAmount}>
              ${item.amount?.toFixed(2)} via {item.provider?.charAt(0).toUpperCase()}{item.provider?.slice(1)}
            </Text>
            {item.note && (
              <Text style={styles.paymentNote}>"{item.note}"</Text>
            )}
          </View>
        )}

        {item.type === 'message' && (
          <View style={styles.messageDetails}>
            <Text style={styles.messageContent} numberOfLines={2}>
              {item.message_content}
            </Text>
            <Text style={styles.messageType}>
              {item.message_type === 'voice' ? '🎙️ Voice Message' : '📝 Text Message'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity History</Text>
        <Text style={styles.subtitle}>Payments and messages sent</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366f1"
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading activity...</Text>
          </View>
        ) : activities.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📱</Text>
            <Text style={styles.emptyTitle}>No Activity Yet</Text>
            <Text style={styles.emptyText}>
              Your payments and messages will appear here
            </Text>
          </View>
        ) : (
          <View style={styles.activitiesContainer}>
            {activities.map(renderActivityItem)}
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
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#f9fafb',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#9ca3af',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
  },
  activitiesContainer: {
    padding: 20,
  },
  activityItem: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  activityInfo: {
    flex: 1,
  },
  activityType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 14,
    color: '#9ca3af',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  paymentDetails: {
    marginTop: 8,
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 4,
  },
  paymentNote: {
    fontSize: 14,
    color: '#d1d5db',
    fontStyle: 'italic',
  },
  messageDetails: {
    marginTop: 8,
  },
  messageContent: {
    fontSize: 14,
    color: '#d1d5db',
    marginBottom: 4,
  },
  messageType: {
    fontSize: 12,
    color: '#9ca3af',
  },
});