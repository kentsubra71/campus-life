import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { getMessagesForUser, getMessagesSentByUser, getUserProfile } from '../lib/firebase';
import { useAuthStore } from '../stores/authStore';
import { theme } from '../styles/theme';
import { formatTimeAgo } from '../utils/dateUtils';

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  type: string;
  content: string;
  amount_cents?: number;
  created_at: any;
  read: boolean;
}

interface MessagesSummaryProps {
  onViewAll: () => void;
  userType: 'parent' | 'student';
}

export const MessagesSummary: React.FC<MessagesSummaryProps> = ({ onViewAll, userType }) => {
  const { user } = useAuthStore();
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [totalThisWeek, setTotalThisWeek] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadRecentMessages();
    }
  }, [user]);

  const loadRecentMessages = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Get user profile to determine if parent or student
      const userProfile = await getUserProfile(user.id);
      
      let firebaseMessages;
      if (userProfile?.user_type === 'parent') {
        // Parents want to see messages they SENT
        firebaseMessages = await getMessagesSentByUser(user.id);
      } else {
        // Students want to see messages they RECEIVED
        firebaseMessages = await getMessagesForUser(user.id);
      }
      
      const messages: Message[] = firebaseMessages.slice(0, 10).map(msg => ({
        id: msg.id,
        sender_id: msg.from_user_id,
        recipient_id: msg.to_user_id,
        type: msg.message_type,
        content: msg.content,
        amount_cents: msg.boost_amount,
        created_at: msg.created_at,
        read: msg.read || false
      }));
      
      // Calculate this week's message count
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const weekCount = messages.filter(message => {
        const messageDate = new Date(message.created_at.seconds * 1000);
        return messageDate >= oneWeekAgo;
      }).length;
      
      setRecentMessages(messages.slice(0, 3));
      setTotalThisWeek(weekCount);
    } catch (error) {
      console.error('Error loading recent messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMessageTypeText = (type: string) => {
    switch (type) {
      case 'message': return 'Message';
      case 'support_request': return 'Support Request';
      case 'care_request': return 'Care Request';
      case 'payment_notification': return 'Payment';
      default: return 'Update';
    }
  };

  const formatMessage = (message: Message) => {
    if (message.type === 'payment_notification' && message.amount_cents) {
      return `Payment of $${(message.amount_cents / 100).toFixed(2)}`;
    }
    return message.content.length > 50 
      ? `${message.content.substring(0, 50)}...` 
      : message.content;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Recent Messages</Text>
        </View>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (recentMessages.length === 0) {
    return (
      <TouchableOpacity style={styles.container} onPress={onViewAll}>
        <View style={styles.header}>
          <Text style={styles.title}>Recent Messages</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.tapText}>Tap to view details</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.container} onPress={onViewAll}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent Messages</Text>
        <Text style={styles.weekTotal}>
          {totalThisWeek} this week
        </Text>
      </View>

      <View style={styles.recentList}>
        {recentMessages.map((message) => (
          <View key={message.id} style={styles.messageRow}>
            <View style={styles.messageInfo}>
              <Text style={styles.messageContent}>
                {formatMessage(message)}
              </Text>
              <Text style={styles.time}>{formatTimeAgo(message.created_at.seconds * 1000)}</Text>
            </View>
            <View style={styles.messageType}>
              <Text style={styles.typeText}>
                {getMessageTypeText(message.type)}
              </Text>
              {!message.read && <View style={styles.unreadDot} />}
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.viewAllText}>Tap to view all messages →</Text>
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
    color: theme.colors.primary,
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
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  messageInfo: {
    flex: 1,
    marginRight: 12,
  },
  messageContent: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: 2,
    lineHeight: 18,
  },
  time: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  messageType: {
    alignItems: 'flex-end',
  },
  typeText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    backgroundColor: theme.colors.backgroundTertiary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    marginTop: 4,
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