import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { theme } from '../../styles/theme';
import { commonStyles } from '../../styles/components';
import { StatusHeader } from '../../components/StatusHeader';
import { NavigationProp } from '@react-navigation/native';
import { getUserFriendlyError, logError } from '../../utils/userFriendlyErrors';
import { 
  isPaymentNearTimeout, 
  formatTimeRemaining, 
  isPaymentTimedOut 
} from '../../utils/paymentTimeout';
import { cache, CACHE_CONFIGS } from '../../utils/universalCache';

interface ActivityItem {
  id: string;
  type: 'payment' | 'message' | 'item_request';
  timestamp: Date;
  amount?: number;
  provider?: string;
  status: string;
  note?: string;
  student_name?: string;
  message_content?: string;
  message_type?: string;
  item_name?: string;
  item_price?: number;
  item_description?: string;
  request_reason?: string;
}

type ParentStackParamList = {
  ActivityHistory: undefined;
  [key: string]: undefined | object;
};

interface ActivityHistoryScreenProps {
  navigation: NavigationProp<ParentStackParamList>;
}

type FilterPeriod = 'all' | '7days' | '30days' | '90days';
type FilterType = 'all' | 'payments' | 'messages' | 'requests';

export const ActivityHistoryScreen: React.FC<ActivityHistoryScreenProps> = ({ navigation }) => {
  const { user } = useAuthStore();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('30days');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [newActivityIds, setNewActivityIds] = useState<string[]>([]);
  const [usingCache, setUsingCache] = useState(false);
  const [lastCacheLoad, setLastCacheLoad] = useState<Date | null>(null);
  const animatedValues = useRef<{ [key: string]: Animated.Value }>({});

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async (isRefresh = false, forceRefresh = false) => {
    if (!user) return;

    try {
      // Try to load from cache first (only on initial load, not on refresh)
      if (!isRefresh && !forceRefresh && activities.length === 0) {
        console.log('🔍 Checking for cached activity data...');
        const cachedData = await cache.get(CACHE_CONFIGS.ACTIVITY_HISTORY, user.id);
        
        if (cachedData) {
          setActivities(cachedData);
          setUsingCache(true);
          setLastCacheLoad(new Date());
          console.log(`📦 Loaded ${cachedData.length} activities from cache`);
          
          // Start background refresh to get latest data
          setTimeout(() => loadActivities(true), 1000);
          return;
        }
      }

      // Show appropriate loading state
      if (!isRefresh && activities.length === 0) {
        setLoading(true);
      } else {
        setBackgroundLoading(true);
      }
      
      console.log(`🔄 Loading activities from database (${isRefresh ? 'refresh' : 'initial'})...`);
      
      const allActivities: ActivityItem[] = [];
      const studentNamesCache: { [key: string]: string } = {};

      // Load payments with optimized student name caching
      const paymentsQuery = query(
        collection(db, 'payments'),
        where('parent_id', '==', user.id),
        orderBy('created_at', 'desc')
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      
      console.log(`📄 Found ${paymentsSnapshot.size} payments`);
      
      for (const doc of paymentsSnapshot.docs) {
        const payment = doc.data();
        const studentId = payment.student_id;
        
        // Check cache first for student name
        let studentName = await cache.get(CACHE_CONFIGS.STUDENT_NAMES, `${user.id}_${studentId}`);
        
        if (!studentName) {
          // Query database for student name
          const studentQuery = query(
            collection(db, 'users'),
            where('id', '==', studentId)
          );
          const studentSnapshot = await getDocs(studentQuery);
          studentName = studentSnapshot.docs[0]?.data()?.full_name || 'Student';
          
          // Cache the student name
          await cache.set(CACHE_CONFIGS.STUDENT_NAMES, studentName, `${user.id}_${studentId}`);
        }

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

      // Load messages with caching
      try {
        const messagesQuery = query(
          collection(db, 'messages'),
          where('from_user_id', '==', user.id),
          orderBy('created_at', 'desc')
        );
        const messagesSnapshot = await getDocs(messagesQuery);
        
        console.log(`💬 Found ${messagesSnapshot.size} messages`);
        
        for (const doc of messagesSnapshot.docs) {
          const message = doc.data();
          const recipientId = message.to_user_id;
          
          // Check cache first for recipient name
          let recipientName = await cache.get(CACHE_CONFIGS.STUDENT_NAMES, `${user.id}_${recipientId}`);
          
          if (!recipientName) {
            const recipientQuery = query(
              collection(db, 'users'),
              where('id', '==', recipientId)
            );
            const recipientSnapshot = await getDocs(recipientQuery);
            recipientName = recipientSnapshot.docs[0]?.data()?.full_name || 'Student';
            
            // Cache the recipient name
            await cache.set(CACHE_CONFIGS.STUDENT_NAMES, recipientName, `${user.id}_${recipientId}`);
          }

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
        console.log('Messages query failed, trying fallback...', messageError);
        // Fallback without orderBy
        const messagesQuery = query(
          collection(db, 'messages'),
          where('from_user_id', '==', user.id)
        );
        const messagesSnapshot = await getDocs(messagesQuery);
        
        for (const doc of messagesSnapshot.docs) {
          const message = doc.data();
          const recipientId = message.to_user_id;
          
          let recipientName = await cache.get(CACHE_CONFIGS.STUDENT_NAMES, `${user.id}_${recipientId}`);
          if (!recipientName) {
            const recipientQuery = query(
              collection(db, 'users'),
              where('id', '==', recipientId)
            );
            const recipientSnapshot = await getDocs(recipientQuery);
            recipientName = recipientSnapshot.docs[0]?.data()?.full_name || 'Student';
            await cache.set(CACHE_CONFIGS.STUDENT_NAMES, recipientName, `${user.id}_${recipientId}`);
          }

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

      // Load item requests
      try {
        const requestsQuery = query(
          collection(db, 'item_requests'),
          where('parent_id', '==', user.id),
          orderBy('created_at', 'desc')
        );
        const requestsSnapshot = await getDocs(requestsQuery);
        
        console.log(`📦 Found ${requestsSnapshot.size} item requests`);
        
        for (const doc of requestsSnapshot.docs) {
          const request = doc.data();
          const studentId = request.student_id;
          
          let studentName = await cache.get(CACHE_CONFIGS.STUDENT_NAMES, `${user.id}_${studentId}`);
          if (!studentName) {
            const studentQuery = query(
              collection(db, 'users'),
              where('id', '==', studentId)
            );
            const studentSnapshot = await getDocs(studentQuery);
            studentName = studentSnapshot.docs[0]?.data()?.full_name || 'Student';
            await cache.set(CACHE_CONFIGS.STUDENT_NAMES, studentName, `${user.id}_${studentId}`);
          }

          allActivities.push({
            id: doc.id,
            type: 'item_request',
            timestamp: request.created_at.toDate(),
            status: request.status || 'pending',
            item_name: request.item_name,
            item_price: request.item_price,
            item_description: request.item_description,
            request_reason: request.request_reason,
            student_name: studentName
          });
        }
      } catch (requestsError) {
        console.log('Item requests query failed, trying fallback...', requestsError);
        try {
          const requestsQuery = query(
            collection(db, 'item_requests'),
            where('parent_id', '==', user.id)
          );
          const requestsSnapshot = await getDocs(requestsQuery);
          
          for (const doc of requestsSnapshot.docs) {
            const request = doc.data();
            const studentId = request.student_id;
            
            let studentName = await cache.get(CACHE_CONFIGS.STUDENT_NAMES, `${user.id}_${studentId}`);
            if (!studentName) {
              const studentQuery = query(
                collection(db, 'users'),
                where('id', '==', studentId)
              );
              const studentSnapshot = await getDocs(studentQuery);
              studentName = studentSnapshot.docs[0]?.data()?.full_name || 'Student';
              await cache.set(CACHE_CONFIGS.STUDENT_NAMES, studentName, `${user.id}_${studentId}`);
            }

            allActivities.push({
              id: doc.id,
              type: 'item_request',
              timestamp: request.created_at.toDate(),
              status: request.status || 'pending',
              item_name: request.item_name,
              item_price: request.item_price,
              item_description: request.item_description,
              request_reason: request.request_reason,
              student_name: studentName
            });
          }
        } catch (fallbackError) {
          console.log('Item requests fallback also failed:', fallbackError);
        }
      }

      // Sort all activities by timestamp
      allActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      // Cache the results
      await cache.set(CACHE_CONFIGS.ACTIVITY_HISTORY, allActivities, user.id);
      
      // Animate new activities if this is a refresh
      if (activities.length > 0) {
        const newIds = allActivities
          .filter(newActivity => !activities.some(existing => existing.id === newActivity.id))
          .map(activity => activity.id);
        
        if (newIds.length > 0) {
          console.log(`🆕 Found ${newIds.length} new activities`);
          setNewActivityIds(newIds);
          
          newIds.forEach(id => {
            animatedValues.current[id] = new Animated.Value(0);
          });
          
          setTimeout(() => {
            newIds.forEach(id => {
              Animated.spring(animatedValues.current[id], {
                toValue: 1,
                useNativeDriver: false,
                tension: 100,
                friction: 8,
              }).start();
            });
          }, 100);
          
          setTimeout(() => setNewActivityIds([]), 3000);
        }
      }
      
      setActivities(allActivities);
      setUsingCache(false);
      
      console.log(`✅ Loaded ${allActivities.length} activities from database`);
      
      // Start PayPal verification for both old and new systems
      setTimeout(async () => {
        try {
          console.log('🔄 Auto-verifying pending PayPal payments (both systems)...');
          
          // Try old system first
          const { autoVerifyPendingPayPalPayments } = await import('../../lib/paypalIntegration');
          const oldSystemCount = await autoVerifyPendingPayPalPayments(user.id);
          
          // Try P2P system for any remaining payments
          let p2pCount = 0;
          try {
            const { collection, query, where, getDocs } = await import('firebase/firestore');
            const { db } = await import('../../lib/firebase');
            const { verifyPayPalP2PPayment } = await import('../../lib/paypalP2P');
            
            // Find P2P payments that might need verification
            const p2pQuery = query(
              collection(db, 'payments'),
              where('parent_id', '==', user.id),
              where('provider', '==', 'paypal'),
              where('status', '==', 'initiated')
            );
            
            const p2pSnapshot = await getDocs(p2pQuery);
            console.log(`🔍 Found ${p2pSnapshot.size} potential P2P payments to verify`);
            
            for (const doc of p2pSnapshot.docs) {
              const payment = doc.data();
              if (payment.p2p_transaction_id && payment.p2p_order_id) {
                console.log(`🔄 Attempting P2P verification for ${doc.id}`);
                const result = await verifyPayPalP2PPayment(
                  payment.p2p_transaction_id,
                  payment.p2p_order_id
                );
                if (result.success) {
                  p2pCount++;
                  console.log(`✅ P2P verified payment: ${doc.id}`);
                }
              }
            }
          } catch (p2pError) {
            console.log('P2P verification skipped:', p2pError);
          }
          
          const totalVerified = oldSystemCount + p2pCount;
          if (totalVerified > 0) {
            console.log(`✅ Total verified: ${totalVerified} payments (${oldSystemCount} old + ${p2pCount} P2P)`);
            loadActivities(true);
          }
          
        } catch (verifyError: any) {
          console.error('⚠️ PayPal verification failed:', verifyError);
          const errorMessage = verifyError?.message || 'Unknown error occurred';
          
          if (errorMessage.includes('404') || errorMessage.includes('RESOURCE_NOT_FOUND')) {
            console.log('ℹ️ PayPal 404 errors are normal - expired orders cleaned up automatically');
          } else {
            logError(verifyError, 'PayPal verification', { userId: user.id });
          }
        }
      }, 100); // Minimal delay - almost immediate

    } catch (error) {
      logError(error, 'Loading activity history', { userId: user?.id });
      const friendlyMessage = getUserFriendlyError(error, 'loading activity history');
      Alert.alert('Unable to Load Activities', friendlyMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setBackgroundLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadActivities(true);
  };

  // Filter activities when period or type changes
  useEffect(() => {
    filterActivities();
  }, [activities, filterPeriod, filterType]);

  const filterActivities = () => {
    let filtered = [...activities];

    // Filter by time period
    if (filterPeriod !== 'all') {
      const now = new Date();
      const daysBack = filterPeriod === '7days' ? 7 : filterPeriod === '30days' ? 30 : 90;
      const cutoffDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
      
      filtered = filtered.filter(activity => activity.timestamp >= cutoffDate);
    }

    // Filter by type
    if (filterType !== 'all') {
      if (filterType === 'requests') {
        filtered = filtered.filter(activity => activity.type === 'item_request');
      } else {
        filtered = filtered.filter(activity => activity.type === filterType.slice(0, -1)); // Remove 's' from 'payments'/'messages'
      }
    }

    setFilteredActivities(filtered);
  };

  const getPeriodLabel = (period: FilterPeriod) => {
    switch (period) {
      case 'all': return 'All Time';
      case '7days': return 'Last 7 Days';
      case '30days': return 'Last 30 Days';
      case '90days': return 'Last 90 Days';
      default: return 'All Time';
    }
  };

  const getTypeLabel = (type: FilterType) => {
    switch (type) {
      case 'all': return 'All Activities';
      case 'payments': return 'Payments Only';
      case 'messages': return 'Messages Only';
      case 'requests': return 'Item Requests';
      default: return 'All Activities';
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
    } else if (type === 'item_request') {
      switch (status) {
        case 'approved': return '#10b981';
        case 'denied': return '#dc2626';
        case 'pending': return '#f59e0b';
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
    } else if (type === 'item_request') {
      switch (status) {
        case 'approved': return 'Approved';
        case 'denied': return 'Denied';
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

  const cancelPayment = async (paymentId: string) => {
    try {
      const { doc, updateDoc, Timestamp } = await import('firebase/firestore');
      
      await updateDoc(doc(db, 'payments', paymentId), {
        status: 'cancelled',
        cancelled_at: Timestamp.now(),
        cancelled_reason: 'User cancelled from activity history'
      });
      
      Alert.alert('Payment Cancelled', 'The payment has been cancelled successfully.');
      
      // Refresh the activities list
      loadActivities(true);
      
    } catch (error) {
      console.error('Error cancelling payment:', error);
      Alert.alert('Cancel Failed', 'Unable to cancel payment. Please contact support if needed.');
    }
  };

  const renderActivityItem = (item: ActivityItem) => {
    const isNew = newActivityIds.includes(item.id);
    const animatedValue = animatedValues.current[item.id] || new Animated.Value(1);
    
    const animatedStyle = isNew ? {
      opacity: animatedValue,
      transform: [
        {
          translateY: animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [20, 0],
          }),
        },
        {
          scale: animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0.95, 1],
          }),
        },
      ],
    } : {};

    return (
      <Animated.View key={item.id} style={[animatedStyle]}>
        <TouchableOpacity 
          style={[
            styles.activityItem, 
            isNew && styles.activityItemNew
          ]}
        >
        <View style={styles.activityHeader}>
          <View style={styles.activityInfo}>
            <Text style={styles.activityType}>
              {item.type === 'payment' ? 'Payment' : 
               item.type === 'item_request' ? 'Item Request' : 'Message'}
              {item.student_name && ` ${item.type === 'item_request' ? 'from' : 'to'} ${item.student_name.split(' ')[0]}`}
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
            
            {/* Timeout Warning and Cancel Button for Processing Payments */}
            {(item.status === 'initiated' || item.status === 'pending' || item.status === 'processing') && (
              (() => {
                const isTimedOut = isPaymentTimedOut(item.timestamp, item.provider || '');
                const isNearTimeout = !isTimedOut && isPaymentNearTimeout(item.timestamp, item.provider || '');
                
                if (isTimedOut) {
                  return (
                    <View style={styles.timeoutWarning}>
                      <Text style={styles.timeoutWarningText}>⏰ Payment Expired</Text>
                      <Text style={styles.timeoutWarningSubtext}>This payment has been automatically cancelled</Text>
                    </View>
                  );
                } else {
                  return (
                    <View style={styles.processingActions}>
                      {isNearTimeout && (
                        <View style={styles.timeoutNearing}>
                          <Text style={styles.timeoutNearingText}>⏳ {formatTimeRemaining(item.timestamp, item.provider || '')}</Text>
                          <Text style={styles.timeoutNearingSubtext}>Payment will auto-cancel if not completed</Text>
                        </View>
                      )}
                      
                      {/* Cancel Button */}
                      <TouchableOpacity
                        style={styles.cancelPaymentButton}
                        onPress={() => {
                          Alert.alert(
                            'Cancel Payment',
                            'Are you sure you want to cancel this payment?',
                            [
                              { text: 'No', style: 'cancel' },
                              { text: 'Yes, Cancel', style: 'destructive', onPress: () => cancelPayment(item.id) }
                            ]
                          );
                        }}
                      >
                        <Text style={styles.cancelPaymentButtonText}>Cancel Payment</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }
              })()
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

        {item.type === 'item_request' && (
          <View style={styles.requestDetails}>
            <Text style={styles.requestItem}>
              {item.item_name} - ${item.item_price?.toFixed(2)}
            </Text>
            {item.item_description && (
              <Text style={styles.requestDescription} numberOfLines={2}>
                {item.item_description}
              </Text>
            )}
            <Text style={styles.requestReason}>
              Reason: {item.request_reason}
            </Text>
          </View>
        )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusHeader title="Activity" />
      <View style={[styles.header, { paddingTop: 50 }]}>
        <Text style={styles.title}>Activity History</Text>
        <Text style={styles.subtitle}>Payments and messages sent</Text>
        
        {/* Filter Controls */}
        <View style={styles.filterContainer}>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Time:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
              {(['all', '7days', '30days', '90days'] as FilterPeriod[]).map((period) => (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.filterButton,
                    filterPeriod === period && styles.filterButtonActive
                  ]}
                  onPress={() => setFilterPeriod(period)}
                >
                  <Text style={[
                    styles.filterButtonText,
                    filterPeriod === period && styles.filterButtonTextActive
                  ]}>
                    {getPeriodLabel(period)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Type:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
              {(['all', 'payments', 'messages', 'requests'] as FilterType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.filterButton,
                    filterType === type && styles.filterButtonActive
                  ]}
                  onPress={() => setFilterType(type)}
                >
                  <Text style={[
                    styles.filterButtonText,
                    filterType === type && styles.filterButtonTextActive
                  ]}>
                    {getTypeLabel(type)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
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
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsCount}>
                {filteredActivities.length} of {activities.length} activities
              </Text>
              <Text style={styles.resultsFilter}>
                {getPeriodLabel(filterPeriod)} • {getTypeLabel(filterType)}
              </Text>
            </View>
            
            {filteredActivities.length === 0 ? (
              <View style={styles.emptyFilterContainer}>
                <Text style={styles.emptyFilterTitle}>No matching activities</Text>
                <Text style={styles.emptyFilterText}>
                  Try adjusting your filters above
                </Text>
              </View>
            ) : (
              filteredActivities.map(renderActivityItem)
            )}
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
    marginBottom: 30,
    paddingTop: 10,
    paddingHorizontal: 24,
  },
  backButton: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  headerLoader: {
    marginLeft: 12,
  },
  cacheIndicator: {
    marginLeft: 8,
    fontSize: 16,
    opacity: 0.7,
  },
  subtitle: {
    ...commonStyles.subtitle,
  },
  pullHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
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
  activityItemNew: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    backgroundColor: `${theme.colors.primary}15`, // 15% opacity
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
  timeoutWarning: {
    backgroundColor: '#dc26261a', // Red with low opacity
    borderColor: '#dc2626',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  timeoutWarningText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: 2,
  },
  timeoutWarningSubtext: {
    fontSize: 12,
    color: '#991b1b',
  },
  timeoutNearing: {
    backgroundColor: '#f59e0b1a', // Orange with low opacity
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  timeoutNearingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
    marginBottom: 2,
  },
  timeoutNearingSubtext: {
    fontSize: 12,
    color: '#92400e',
  },
  processingActions: {
    marginTop: 12,
  },
  cancelPaymentButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  cancelPaymentButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
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
  filterContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    minWidth: 50,
    marginRight: 12,
  },
  filterScrollView: {
    flex: 1,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  filterButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  resultsCount: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  resultsFilter: {
    fontSize: 12,
    color: theme.colors.textTertiary,
  },
  emptyFilterContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyFilterTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  emptyFilterText: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    textAlign: 'center',
  },
  requestDetails: {
    marginTop: 12,
  },
  requestItem: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  requestDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  requestReason: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    lineHeight: 18,
  },
});