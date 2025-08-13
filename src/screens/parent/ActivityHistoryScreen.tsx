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
import { theme } from '../../styles/theme';
import { commonStyles } from '../../styles/components';
import { NavigationProp } from '@react-navigation/native';

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

type ParentStackParamList = {
  ActivityHistory: undefined;
  [key: string]: undefined | object;
};

interface ActivityHistoryScreenProps {
  navigation: NavigationProp<ParentStackParamList>;
}

export const ActivityHistoryScreen: React.FC<ActivityHistoryScreenProps> = ({ navigation }) => {
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
        case 'initiated': return theme.colors.primary;
        case 'pending': return theme.colors.primary;
        default: return '#9ca3af';
      }
    } else {
      switch (status) {
        case 'read': return '#10b981';
        case 'sent': return theme.colors.primary;
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
              {item.type === 'payment' ? 'Payment' : 'Message'}
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
              {item.message_type === 'voice' ? 'Voice Message' : 'Text Message'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Activity History</Text>
        <Text style={styles.subtitle}>Payments and messages sent</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading activity...</Text>
          </View>
        ) : activities.length === 0 ? (
          <View style={styles.emptyContainer}>
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
    ...commonStyles.container,
  },
  header: {
    ...commonStyles.headerWithSubtitle,
  },
  backButton: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    ...commonStyles.subtitle,
  },
  scrollView: {
    ...commonStyles.scrollContainer,
  },
  loadingContainer: {
    ...commonStyles.loadingContainer,
  },
  loadingText: {
    ...commonStyles.loadingText,
  },
  emptyContainer: {
    ...commonStyles.emptyContainer,
  },
  emptyEmoji: {
    ...commonStyles.emptyEmoji,
  },
  emptyTitle: {
    ...commonStyles.emptyTitle,
  },
  emptyText: {
    ...commonStyles.emptyText,
  },
  activitiesContainer: {
    ...commonStyles.containerPadding,
  },
  activityItem: {
    ...commonStyles.listItem,
  },
  activityHeader: {
    ...commonStyles.listItemHeader,
  },
  activityInfo: {
    ...commonStyles.listItemContent,
  },
  activityType: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  activityTime: {
    ...theme.typography.subtitleSmall,
  },
  statusBadge: {
    ...commonStyles.statusBadge,
  },
  statusText: {
    ...commonStyles.statusText,
  },
  paymentDetails: {
    marginTop: theme.spacing.sm,
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.success,
    marginBottom: theme.spacing.xs,
  },
  paymentNote: {
    ...theme.typography.bodySmall,
    color: theme.colors.textTertiary,
    fontStyle: 'italic',
  },
  messageDetails: {
    marginTop: theme.spacing.sm,
  },
  messageContent: {
    ...theme.typography.bodySmall,
    color: theme.colors.textTertiary,
    marginBottom: theme.spacing.xs,
  },
  messageType: {
    ...theme.typography.caption,
  },
});