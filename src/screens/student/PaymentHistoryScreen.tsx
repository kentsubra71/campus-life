import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../stores/authStore';
import { useRewardsStore } from '../../stores/rewardsStore';
import { theme } from '../../styles/theme';

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
  item_context?: {
    item_request_id?: string;
    item_name?: string;
    item_description?: string;
  };
}

interface SupportRequest {
  id: string;
  student_id: string;
  timestamp: any;
  type: 'support_request';
  content: string;
}

interface SupportMessage {
  id: string;
  content: string;
  type: string;
  timestamp: any;
  read: boolean;
}

type ActivityItem = Payment | SupportRequest | SupportMessage;

interface PaymentHistoryScreenProps {
  navigation: any;
}

type TimeFilter = 'today' | 'week' | 'month' | 'all';
type TypeFilter = 'all' | 'payments' | 'messages' | 'support';

export const PaymentHistoryScreen: React.FC<PaymentHistoryScreenProps> = ({ navigation }) => {
  const { user } = useAuthStore();
  const { supportMessages } = useRewardsStore();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  useEffect(() => {
    if (user) {
      loadAllActivities();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [activities, timeFilter, typeFilter]);

  const loadAllActivities = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const allActivities: ActivityItem[] = [];

      // Load payments using the same approach as ReceivedPayments component
      try {
        console.log('Loading payments for user:', user.id);
        const paymentsQuery = query(
          collection(db, 'payments'),
          where('student_id', '==', user.id),
          where('status', 'in', ['completed', 'confirmed_by_parent', 'initiated', 'pending', 'processing', 'sent'])
        );
        
        const paymentsSnapshot = await getDocs(paymentsQuery);
        console.log('Found payments:', paymentsSnapshot.size);
        
        // Process each payment - use simpler approach without parent name lookup
        paymentsSnapshot.docs.forEach(doc => {
          const paymentData = doc.data();
          allActivities.push({
            id: doc.id,
            parent_id: paymentData.parent_id,
            student_id: paymentData.student_id,
            provider: paymentData.provider,
            intent_cents: paymentData.intent_cents,
            note: paymentData.note,
            status: paymentData.status,
            created_at: paymentData.created_at,
            confirmed_at: paymentData.confirmed_at,
            parent_name: 'Parent', // Use generic name to avoid users collection access
            item_context: paymentData.item_context // Include item context if present
          } as Payment);
        });
      } catch (paymentsError) {
        console.log('Could not load payments:', paymentsError);
      }

      // Add support messages from rewards store (already loaded and accessible)
      supportMessages.forEach(message => {
        allActivities.push({
          ...message,
          type: message.type || 'message'
        } as SupportMessage);
      });

      console.log('📊 Loaded', allActivities.length, 'activities total');

      // Sort all activities by timestamp
      allActivities.sort((a, b) => {
        const aTime = getActivityTimestamp(a);
        const bTime = getActivityTimestamp(b);
        return bTime - aTime;
      });

      setActivities(allActivities);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityTimestamp = (activity: ActivityItem): number => {
    if ('intent_cents' in activity) {
      // Payment
      return (activity.confirmed_at || activity.created_at)?.seconds * 1000 || 0;
    } else if ('content' in activity && 'timestamp' in activity) {
      // Support message or request
      return new Date(activity.timestamp).getTime();
    }
    return 0;
  };

  const applyFilters = () => {
    let filtered = [...activities];

    // Apply time filter
    if (timeFilter !== 'all') {
      const now = new Date();
      let cutoffTime: Date;
      
      switch (timeFilter) {
        case 'today':
          cutoffTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          cutoffTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffTime = new Date(0);
      }

      filtered = filtered.filter(activity => {
        const activityTime = getActivityTimestamp(activity);
        return activityTime >= cutoffTime.getTime();
      });
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(activity => {
        switch (typeFilter) {
          case 'payments':
            return 'intent_cents' in activity;
          case 'messages':
            return 'content' in activity && activity.type !== 'support_request';
          case 'support':
            return 'type' in activity && activity.type === 'support_request';
          default:
            return true;
        }
      });
    }

    setFilteredActivities(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllActivities();
    setRefreshing(false);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
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
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const renderActivity = (activity: ActivityItem) => {
    if ('intent_cents' in activity) {
      // Check if this is an item payment or regular payment
      const isItemPayment = activity.item_context && activity.item_context.item_name;
      
      return (
        <View key={activity.id} style={styles.activityCard}>
          <View style={styles.activityHeader}>
            <View style={isItemPayment ? styles.itemIcon : styles.paymentIcon}>
              <Text style={styles.iconText}>{isItemPayment ? '📦' : '💰'}</Text>
            </View>
            <View style={styles.activityContent}>
              <View style={styles.titleRow}>
                <Text style={styles.activityTitle}>
                  {isItemPayment 
                    ? `${activity.item_context!.item_name} ${activity.status === 'completed' || activity.status === 'confirmed_by_parent' ? 'received' : 'being sent'}`
                    : `+$${(activity.intent_cents / 100).toFixed(2)} ${activity.status === 'completed' || activity.status === 'confirmed_by_parent' ? 'received' : 'pending'}`
                  }
                </Text>
                {(activity.status !== 'completed' && activity.status !== 'confirmed_by_parent') && (
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>
                      {activity.status === 'initiated' || activity.status === 'pending' || activity.status === 'processing' ? 'Processing' : 
                       activity.status === 'sent' ? 'Sent' : activity.status}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.activitySubtitle}>
                {isItemPayment 
                  ? `Item ${activity.status === 'completed' || activity.status === 'confirmed_by_parent' ? 'sent' : 'being processed'} by ${activity.parent_name?.split(' ')[0] || 'Parent'} via ${activity.provider} ($${(activity.intent_cents / 100).toFixed(2)})`
                  : `${activity.status === 'completed' || activity.status === 'confirmed_by_parent' ? 'from' : 'being sent by'} ${activity.parent_name?.split(' ')[0] || 'Parent'} via ${activity.provider}`
                }
              </Text>
              {isItemPayment && activity.item_context!.item_description && (
                <Text style={styles.activityNote}>"{activity.item_context!.item_description}"</Text>
              )}
              {!isItemPayment && activity.note && (
                <Text style={styles.activityNote}>"{activity.note}"</Text>
              )}
            </View>
            <Text style={styles.activityTime}>
              {formatTime(getActivityTimestamp(activity))}
            </Text>
          </View>
        </View>
      );
    } else if (activity.type === 'support_request') {
      // Support request
      return (
        <View key={activity.id} style={styles.activityCard}>
          <View style={styles.activityHeader}>
            <View style={styles.supportIcon}>
              <Text style={styles.iconText}>🆘</Text>
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>Support Requested</Text>
              <Text style={styles.activitySubtitle}>{activity.content}</Text>
            </View>
            <Text style={styles.activityTime}>
              {formatTime(getActivityTimestamp(activity))}
            </Text>
          </View>
        </View>
      );
    } else {
      // Support message
      const getMessageEmoji = (type: string) => {
        switch (type) {
          case 'voice': return '🎤';
          case 'care_package': return '📦';
          case 'video_call': return '📹';
          case 'boost': return '⚡';
          default: return '💌';
        }
      };

      return (
        <View key={activity.id} style={styles.activityCard}>
          <View style={styles.activityHeader}>
            <View style={styles.messageIcon}>
              <Text style={styles.iconText}>{getMessageEmoji(activity.type)}</Text>
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>Family Message</Text>
              <Text style={styles.activitySubtitle}>{activity.content}</Text>
            </View>
            <Text style={styles.activityTime}>
              {formatTime(getActivityTimestamp(activity))}
            </Text>
          </View>
        </View>
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity History</Text>
        <View style={styles.headerSpacer} />
      </View>
      
      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {/* Time Filters */}
          {(['today', 'week', 'month', 'all'] as TimeFilter[]).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterButton, timeFilter === filter && styles.activeFilter]}
              onPress={() => setTimeFilter(filter)}
            >
              <Text style={[styles.filterText, timeFilter === filter && styles.activeFilterText]}>
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
          
          <View style={styles.filterDivider} />
          
          {/* Type Filters */}
          {(['all', 'payments', 'messages', 'support'] as TypeFilter[]).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterButton, typeFilter === filter && styles.activeFilter]}
              onPress={() => setTypeFilter(filter)}
            >
              <Text style={[styles.filterText, typeFilter === filter && styles.activeFilterText]}>
                {filter === 'all' ? 'All' : 
                 filter === 'payments' ? 'Money' :
                 filter === 'messages' ? 'Messages' : 'Support'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Activities List */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading activities...</Text>
          </View>
        ) : filteredActivities.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No activities found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
          </View>
        ) : (
          filteredActivities.map(renderActivity)
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.backgroundCard,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginLeft: -32, // Compensate for back button width
  },
  headerSpacer: {
    width: 32, // Same width as back button for centering
  },
  filtersContainer: {
    backgroundColor: theme.colors.backgroundCard,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filterScroll: {
    paddingHorizontal: 16,
  },
  filterButton: {
    backgroundColor: theme.colors.backgroundSecondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  activeFilter: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  activeFilterText: {
    color: 'white',
  },
  filterDivider: {
    width: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: 8,
    alignSelf: 'stretch',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  activityCard: {
    backgroundColor: theme.colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  supportIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  messageIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 18,
  },
  activityContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  activitySubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  activityNote: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  activityTime: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginLeft: 8,
  },
});