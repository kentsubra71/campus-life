import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../stores/authStore';
import { useRewardsStore } from '../../stores/rewardsStore';
import { StatusHeader } from '../../components/StatusHeader';
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

type FilterPeriod = 'all' | 'day' | 'week' | 'month';
type FilterType = 'all' | 'payments' | 'messages' | 'items';

export const PaymentHistoryScreen: React.FC<PaymentHistoryScreenProps> = ({ navigation }) => {
  const { user } = useAuthStore();
  const { supportMessages } = useRewardsStore();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 20;

  useEffect(() => {
    if (user) {
      loadAllActivities();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [activities, filterPeriod, filterType]);

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
    if (filterPeriod !== 'all') {
      const now = new Date();
      let cutoffTime: Date;
      
      switch (filterPeriod) {
        case 'day':
          cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
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
    if (filterType !== 'all') {
      filtered = filtered.filter(activity => {
        switch (filterType) {
          case 'payments':
            return 'intent_cents' in activity;
          case 'messages':
            return 'content' in activity && activity.type !== 'support_request';
          case 'items':
            return 'intent_cents' in activity && activity.item_context;
          default:
            return true;
        }
      });
    }

    setFilteredActivities(filtered);
  };

  const getPeriodLabel = (period: FilterPeriod) => {
    switch (period) {
      case 'day': return 'Past 24h';
      case 'week': return 'Past Week';
      case 'month': return 'Past Month';
      case 'all': return 'All Time';
      default: return 'All Time';
    }
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

  const getStatusColor = (type: string, status: string) => {
    if (type === 'payment') {
      switch (status) {
        case 'completed': return '#10b981';
        case 'confirmed_by_parent': return '#10b981';
        case 'sent': return '#f59e0b';
        case 'initiated': return theme.colors.primary;
        case 'pending': return theme.colors.primary;
        case 'timeout': return '#dc2626';
        case 'cancelled': return '#9ca3af';
        case 'failed': return '#dc2626';
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
        case 'timeout': return 'Timed Out';
        case 'cancelled': return 'Cancelled';
        case 'failed': return 'Failed';
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

  const renderActivity = (activity: ActivityItem) => {
    const timestamp = getActivityTimestamp(activity);
    const activityType = 'intent_cents' in activity ? 'payment' : 
                        activity.type === 'support_request' ? 'request' : 'message';
    
    return (
      <View key={activity.id} style={styles.activityItem}>
        <View style={styles.activityHeader}>
          <View style={styles.activityInfo}>
            <Text style={styles.activityType}>
              {'intent_cents' in activity && activity.item_context 
                ? `Item Request` 
                : 'intent_cents' in activity 
                ? 'Payment'
                : activity.type === 'support_request' 
                ? 'Support Request'
                : 'Family Message'
              }
            </Text>
            <Text style={styles.activityTime}>{formatTime(timestamp)}</Text>
          </View>
          <View style={[styles.statusBadge, { 
            backgroundColor: getStatusColor(activityType, 'intent_cents' in activity ? activity.status : activity.type || 'message') 
          }]}>
            <Text style={styles.statusText}>
              {getStatusText(activityType, 'intent_cents' in activity ? activity.status : activity.type || 'message')}
            </Text>
          </View>
        </View>

        {'intent_cents' in activity && (
          <View style={styles.paymentDetails}>
            <Text style={styles.paymentAmount}>
              ${(activity.intent_cents / 100).toFixed(2)} via {activity.provider?.charAt(0).toUpperCase()}{activity.provider?.slice(1)}
            </Text>
            {activity.item_context && activity.item_context.item_name && (
              <Text style={styles.itemName}>
                Item: {activity.item_context.item_name}
              </Text>
            )}
            {activity.item_context && activity.item_context.item_description && (
              <Text style={styles.paymentNote}>"{activity.item_context.item_description}"</Text>
            )}
            {!activity.item_context && activity.note && (
              <Text style={styles.paymentNote}>"{activity.note}"</Text>
            )}
          </View>
        )}

        {'content' in activity && (
          <View style={styles.messageDetails}>
            <Text style={styles.messageContent} numberOfLines={2}>
              {activity.content}
            </Text>
            <Text style={styles.messageType}>
              {activity.type === 'support_request' ? 'Support Request' : 'Family Message'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const insets = useSafeAreaInsets();
  const paginatedActivities = filteredActivities.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  return (
    <View style={styles.container}>
      <StatusHeader title="Activity History" />
      <ScrollView
        style={[styles.scrollView, { paddingTop: 50 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>All Activity</Text>
          <Text style={styles.subtitle}>Your family connections and support</Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#10b981' }]}>{activities.filter(a => 'intent_cents' in a).length}</Text>
            <Text style={styles.statLabel}>Payments</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#3b82f6' }]}>{activities.filter(a => 'content' in a).length}</Text>
            <Text style={styles.statLabel}>Messages</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#f59e0b' }]}>{activities.filter(a => 'intent_cents' in a && a.item_context).length}</Text>
            <Text style={styles.statLabel}>Items</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading activities...</Text>
          </View>
        ) : (
          <View style={styles.activitiesContainer}>
            {/* Time Period Filter */}
            <View style={styles.filterSection}>
              <View style={styles.segmentedControl}>
                {(['all', 'day', 'week', 'month'] as FilterPeriod[]).map((period, index) => (
                  <TouchableOpacity
                    key={period}
                    style={[
                      styles.segment,
                      index === 0 && styles.segmentFirst,
                      index === 3 && styles.segmentLast,
                      filterPeriod === period && styles.segmentActive
                    ]}
                    onPress={() => setFilterPeriod(period)}
                  >
                    <Text style={[
                      styles.segmentText,
                      filterPeriod === period && styles.segmentTextActive
                    ]}>
                      {period === 'all' ? 'All' :
                       period === 'day' ? '24h' : 
                       period === 'week' ? '7d' : '30d'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Activity Type Filter */}
            <View style={styles.filterSection}>
              <View style={styles.segmentedControl}>
                {(['all', 'payments', 'messages', 'items'] as FilterType[]).map((type, index) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.segment,
                      index === 0 && styles.segmentFirst,
                      index === 3 && styles.segmentLast,
                      filterType === type && styles.segmentActive
                    ]}
                    onPress={() => setFilterType(type)}
                  >
                    <Text style={[
                      styles.segmentText,
                      filterType === type && styles.segmentTextActive
                    ]}>
                      {type === 'all' ? 'All' : 
                       type === 'payments' ? 'Payments' :
                       type === 'messages' ? 'Messages' : 'Items'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Results Info */}
            <View style={styles.resultsInfo}>
              <Text style={styles.resultsText}>
                {filteredActivities.length} {filteredActivities.length === 1 ? 'activity' : 'activities'}
              </Text>
            </View>

            {/* Activities List */}
            {filteredActivities.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No activities found</Text>
                <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
              </View>
            ) : (
              <View style={styles.activitiesList}>
                {paginatedActivities.map(renderActivity)}
              </View>
            )}

            {/* Pagination */}
            {filteredActivities.length > itemsPerPage && (
              <View style={styles.paginationContainer}>
                <TouchableOpacity
                  style={[styles.paginationButton, currentPage === 0 && styles.paginationButtonDisabled]}
                  onPress={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                >
                  <Text style={[styles.paginationButtonText, currentPage === 0 && styles.paginationButtonTextDisabled]}>
                    Previous
                  </Text>
                </TouchableOpacity>
                
                <Text style={styles.paginationInfo}>
                  Page {currentPage + 1} of {Math.ceil(filteredActivities.length / itemsPerPage)}
                </Text>
                
                <TouchableOpacity
                  style={[
                    styles.paginationButton, 
                    (currentPage + 1) * itemsPerPage >= filteredActivities.length && styles.paginationButtonDisabled
                  ]}
                  onPress={() => setCurrentPage(currentPage + 1)}
                  disabled={(currentPage + 1) * itemsPerPage >= filteredActivities.length}
                >
                  <Text style={[
                    styles.paginationButtonText,
                    (currentPage + 1) * itemsPerPage >= filteredActivities.length && styles.paginationButtonTextDisabled
                  ]}>
                    Next
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    marginBottom: 20,
    paddingTop: 10,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: 16,
  },
  activitiesContainer: {
    paddingHorizontal: 24,
  },
  filterSection: {
    marginBottom: 16,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 8,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentFirst: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  segmentLast: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  segmentActive: {
    backgroundColor: theme.colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  segmentTextActive: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  resultsInfo: {
    paddingBottom: 12,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  resultsText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  activitiesList: {
    gap: 1,
  },
  activityItem: {
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: 16,
    paddingHorizontal: 0,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  activityInfo: {
    flex: 1,
    marginRight: 12,
  },
  activityType: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
    textTransform: 'uppercase',
  },
  paymentDetails: {
    marginTop: 4,
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.success,
    marginBottom: 4,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  paymentNote: {
    fontSize: 13,
    color: theme.colors.textTertiary,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  messageDetails: {
    marginTop: 4,
  },
  messageContent: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
    lineHeight: 18,
  },
  messageType: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    fontWeight: '500',
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
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  paginationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    borderColor: theme.colors.border,
    opacity: 0.5,
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  paginationButtonTextDisabled: {
    color: theme.colors.textTertiary,
  },
  paginationInfo: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
});