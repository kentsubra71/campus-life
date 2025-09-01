import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db, getItemRequestsForParent, updateItemRequestStatus } from '../../lib/firebase';
import { theme } from '../../styles/theme';
import { commonStyles } from '../../styles/components';
import { StatusHeader } from '../../components/StatusHeader';
import { NavigationProp } from '@react-navigation/native';
import { getUserFriendlyError, logError } from '../../utils/userFriendlyErrors';
import { showMessage } from 'react-native-flash-message';
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
  student_id?: string; // Add student_id for item requests
  message_content?: string;
  message_type?: string;
  item_name?: string;
  item_price?: number;
  item_description?: string;
  reason?: string;
}

type ParentStackParamList = {
  ActivityHistory: undefined;
  [key: string]: undefined | object;
};

interface ActivityHistoryScreenProps {
  navigation: NavigationProp<ParentStackParamList>;
}

type FilterPeriod = 'day' | 'week' | 'month' | 'all';
type FilterType = 'all' | 'payments' | 'messages' | 'items';

export const ActivityHistoryScreen: React.FC<ActivityHistoryScreenProps> = ({ navigation }) => {
  const { user } = useAuthStore();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityItem[]>([]);
  const [displayedActivities, setDisplayedActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('month');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage] = useState(10);
  const [newActivityIds, setNewActivityIds] = useState<string[]>([]);
  const animatedValues = useRef<{ [key: string]: Animated.Value }>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const allActivityRef = useRef<View>(null);

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
        
        if (cachedData && Array.isArray(cachedData)) {
          setActivities(cachedData as ActivityItem[]);
          console.log(`📦 Loaded ${cachedData.length} activities from cache`);
          
          // Start background refresh to get latest data
          setTimeout(() => loadActivities(true), 1000);
          return;
        }
      }

      // Show appropriate loading state
      if (!isRefresh && activities.length === 0) {
        setLoading(true);
      }
      
      console.log(`🔄 Loading activities from database (${isRefresh ? 'refresh' : 'initial'})...`);
      
      const allActivities: ActivityItem[] = [];

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
        let studentName: string = (await cache.get(CACHE_CONFIGS.STUDENT_NAMES, `${user.id}_${studentId}`)) as string || '';
        
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
          timestamp: payment.created_at && payment.created_at.toDate ? payment.created_at.toDate() : new Date(),
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
          let recipientName: string = (await cache.get(CACHE_CONFIGS.STUDENT_NAMES, `${user.id}_${recipientId}`)) as string || '';
          
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
            timestamp: message.created_at && message.created_at.toDate ? message.created_at.toDate() : new Date(),
            status: message.read ? 'read' : 'sent',
            message_content: message.content,
            message_type: message.type || 'message',
            student_name: recipientName
          });
        }
      } catch (messageError) {
        console.log('Messages query failed, trying fallback...', messageError);
      }

      // Load item requests
      try {
        const requests = await getItemRequestsForParent(user.id);
        
        console.log(`📦 Found ${requests.length} item requests`);
        
        for (const request of requests) {
          const studentId = request.student_id;
          
          let studentName: string = (await cache.get(CACHE_CONFIGS.STUDENT_NAMES, `${user.id}_${studentId}`)) as string || '';
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
            id: request.id,
            type: 'item_request',
            timestamp: request.created_at && request.created_at.toDate ? request.created_at.toDate() : new Date(),
            status: request.status || 'pending',
            item_name: request.item_name,
            item_price: request.item_price,
            item_description: request.item_description,
            reason: request.reason,
            student_name: studentName,
            student_id: request.student_id
          });
        }
      } catch (requestsError) {
        console.log('Item requests query failed, trying fallback...', requestsError);
      }

      // Sort all activities by timestamp (newest first)
      allActivities.sort((a, b) => {
        const aTime = a.timestamp && a.timestamp.getTime ? a.timestamp.getTime() : 0;
        const bTime = b.timestamp && b.timestamp.getTime ? b.timestamp.getTime() : 0;
        return bTime - aTime;
      });

      // Mark new activities for animation
      const existingIds = new Set(activities.map(a => a.id));
      const newIds = allActivities.filter(a => !existingIds.has(a.id)).map(a => a.id);
      
      if (newIds.length > 0) {
        setNewActivityIds(newIds);
        // Clear new activity indicators after animation
        setTimeout(() => setNewActivityIds([]), 3000);
      }

      setActivities(allActivities);
      
      // Cache the fresh data (only cache after successful load)
      if (!isRefresh || allActivities.length > 0) {
        await cache.set(CACHE_CONFIGS.ACTIVITY_HISTORY, allActivities, user.id);
        console.log(`💾 Cached ${allActivities.length} activities`);
      }
      
    } catch (error) {
      console.error('Error loading activities:', error);
      logError(error, 'Loading activity history', { userId: user.id });
    } finally {
      setLoading(false);
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setCurrentPage(0); // Reset to first page on refresh
    loadActivities(true);
  };

  // Filter activities when period, type, or activities change
  useEffect(() => {
    filterActivities();
  }, [activities, filterPeriod, filterType]);

  // Update displayed activities when filtered activities or page changes
  useEffect(() => {
    updateDisplayedActivities();
  }, [filteredActivities, currentPage]);

  const filterActivities = () => {
    let filtered = [...activities];

    // Filter by time period
    if (filterPeriod !== 'all') {
      const now = new Date();
      let daysBack: number;
      
      switch (filterPeriod) {
        case 'day': daysBack = 1; break;
        case 'week': daysBack = 7; break;
        case 'month': daysBack = 30; break;
        default: daysBack = 0;
      }
      
      if (daysBack > 0) {
        const cutoffDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
        filtered = filtered.filter(activity => activity.timestamp >= cutoffDate);
      }
    }

    // Filter by type
    if (filterType !== 'all') {
      if (filterType === 'items') {
        filtered = filtered.filter(activity => activity.type === 'item_request');
      } else if (filterType === 'payments') {
        filtered = filtered.filter(activity => activity.type === 'payment');
      } else if (filterType === 'messages') {
        filtered = filtered.filter(activity => activity.type === 'message');
      }
    }

    setFilteredActivities(filtered);
    setCurrentPage(0); // Reset to first page when filters change
  };

  const updateDisplayedActivities = () => {
    const startIndex = currentPage * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setDisplayedActivities(filteredActivities.slice(startIndex, endIndex));
  };

  const nextPage = () => {
    const maxPages = Math.ceil(filteredActivities.length / itemsPerPage);
    if (currentPage < maxPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const previousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleDeclineItem = async (requestId: string, itemName: string) => {
    Alert.alert(
      'Decline Request',
      `Are you sure you want to decline the request for "${itemName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Decline', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { success, error } = await updateItemRequestStatus(requestId, 'declined', 'Declined by parent');
              if (success) {
                showMessage({
                  message: 'Request Declined',
                  description: `The request for "${itemName}" has been declined.`,
                  type: 'info',
                  backgroundColor: theme.colors.warning,
                  color: theme.colors.backgroundSecondary,
                });
                loadActivities(true); // Refresh activities
              } else {
                throw new Error(error);
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to decline request. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleApproveItem = async (requestId: string, itemName: string, itemPrice: number, studentId: string, itemDescription?: string) => {
    // Convert cents to dollars for display
    const priceInDollars = itemPrice / 100;
    
    Alert.alert(
      'Send Item',
      `Send $${priceInDollars.toFixed(2)} via PayPal for "${itemName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Send via PayPal', 
          onPress: () => sendItemPayment(requestId, itemName, itemPrice, studentId, 'paypal', itemDescription)
        }
      ]
    );
  };

  const sendItemPayment = async (
    requestId: string, 
    itemName: string, 
    itemPrice: number, 
    studentId: string, 
    provider: string,
    itemDescription?: string
  ) => {
    if (!user) return;

    console.log('🔍 Starting item payment:', {
      requestId,
      itemName,
      itemPrice,
      studentId,
      provider,
      itemDescription
    });

    try {
      // First update the item request status to approved
      const { success, error: updateError } = await updateItemRequestStatus(requestId, 'approved', 'Payment processing');
      if (!success) {
        throw new Error(updateError);
      }

      console.log('✅ Item request status updated to approved');

      // Use existing PayPal P2P system (same as support payments)
      const { createPayPalP2POrder } = await import('../../lib/paypalP2P');
      
      console.log('🔍 Calling createPayPalP2POrder with:', {
        studentId,
        itemPrice,
        note: `Item: ${itemName}${itemDescription ? ` - ${itemDescription}` : ''}`
      });
      
      const result = await createPayPalP2POrder(
        studentId,
        itemPrice, // itemPrice is already in cents from database
        `Item: ${itemName}${itemDescription ? ` - ${itemDescription}` : ''}`
      );

      console.log('🔍 PayPal P2P order result:', result);

      if (result.success && result.approvalUrl) {
        // Store the transaction ID for potential cancellation (same as regular payments)
        if (result.transactionId) {
          console.log('✅ Item payment created with ID:', result.transactionId);
        }
        
        // Open PayPal for payment (same as regular payments)
        const { Linking } = await import('react-native');
        await Linking.openURL(result.approvalUrl);
        
        // Show user what to expect (same as regular payments)
        Alert.alert(
          'PayPal Payment Started',
          `Complete your payment in PayPal, then return to Campus Life. The payment for "${itemName}" will be automatically verified.`,
          [{ text: 'OK' }]
        );

        loadActivities(true); // Refresh activities
      } else {
        console.error('❌ PayPal order creation failed:', result);
        throw new Error(result.error || 'Failed to create PayPal order');
      }
    } catch (error: any) {
      console.error('❌ Error sending item payment:', error);
      Alert.alert('Error', `Failed to make payment: ${error.message || 'Unknown error'}`);
    }
  };

  const getPeriodLabel = (period: FilterPeriod) => {
    switch (period) {
      case 'day': return 'Past Day';
      case 'week': return 'Past Week';
      case 'month': return 'Past Month';
      case 'all': return 'All Time';
      default: return 'All Time';
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
    if (!date || !date.getTime) {
      return 'Recently';
    }
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

  const retryPayment = async (payment: ActivityItem) => {
    if (!payment.amount || !payment.student_name) {
      Alert.alert('Error', 'Unable to retry payment - missing payment details.');
      return;
    }

    Alert.alert(
      'Retry Payment',
      `Retry sending $${payment.amount.toFixed(2)} via ${payment.provider?.charAt(0).toUpperCase()}${payment.provider?.slice(1)} to ${payment.student_name.split(' ')[0]}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Retry Payment',
          onPress: async () => {
            try {
              // Get the student ID from family members or from the original payment
              const { getFamilyMembers } = useAuthStore.getState();
              const familyMembers = await getFamilyMembers();
              const targetStudent = familyMembers.students.find(s => 
                s.name === payment.student_name
              );

              if (!targetStudent) {
                Alert.alert('Error', 'Unable to find student for retry payment.');
                return;
              }

              const amountCents = Math.round(payment.amount! * 100);
              const provider = payment.provider as 'paypal' | 'venmo' | 'cashapp' | 'zelle';

              if (provider === 'paypal') {
                // Use PayPal P2P system
                const { createPayPalP2POrder } = await import('../../lib/paypalP2P');
                const result = await createPayPalP2POrder(
                  targetStudent.id,
                  amountCents,
                  payment.note || `Retry payment: $${payment.amount?.toFixed(2) || '0.00'}`
                );

                if (result.success && result.approvalUrl) {
                  // Open PayPal for payment
                  const { Linking } = await import('react-native');
                  await Linking.openURL(result.approvalUrl);
                  
                  Alert.alert(
                    'PayPal Payment Started',
                    'Complete your payment in PayPal, then return to Campus Life.',
                    [{ text: 'OK' }]
                  );
                  
                  loadActivities(true); // Refresh activities
                } else {
                  throw new Error(result.error || 'Failed to create PayPal order');
                }
              } else {
                // Use regular payment intent for other providers
                const { createPaymentIntent } = await import('../../lib/payments');
                const result = await createPaymentIntent(
                  targetStudent.id,
                  amountCents,
                  provider,
                  payment.note || `Retry payment: $${payment.amount?.toFixed(2) || '0.00'}`
                );

                if (result.success) {
                  // Open the provider app/website
                  if (result.redirectUrl) {
                    const { Linking } = await import('react-native');
                    await Linking.openURL(result.redirectUrl);
                  }

                  Alert.alert(
                    'Payment Started',
                    `Complete your payment in ${provider.charAt(0).toUpperCase()}${provider.slice(1)}, then return to Campus Life.`,
                    [{ text: 'OK' }]
                  );
                  
                  loadActivities(true); // Refresh activities
                } else {
                  throw new Error(result.error || 'Failed to create payment');
                }
              }
            } catch (error: any) {
              console.error('Error retrying payment:', error);
              Alert.alert('Retry Failed', error.message || 'Unable to retry payment. Please try again.');
            }
          }
        }
      ]
    );
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
            
            {/* Payment Actions - Cancel, Retry, or Status Info */}
            {item.timestamp && (
              (() => {
                const isTimedOut = isPaymentTimedOut(item.timestamp, item.provider || '');
                const isProcessing = item.status === 'initiated' || item.status === 'pending' || item.status === 'processing';
                const canRetry = item.status === 'failed' || item.status === 'cancelled' || item.status === 'timeout' || isTimedOut;
                const isNearTimeout = isProcessing && !isTimedOut && isPaymentNearTimeout(item.timestamp, item.provider || '');
                
                if (isTimedOut || item.status === 'timeout') {
                  return (
                    <View style={styles.timeoutWarning}>
                      <Text style={styles.timeoutWarningText}>⏰ Payment Expired</Text>
                      <Text style={styles.timeoutWarningSubtext}>This payment has been automatically cancelled</Text>
                      
                      {/* Retry Button for Timed Out Payments */}
                      <TouchableOpacity
                        style={styles.retryPaymentButton}
                        onPress={() => retryPayment(item)}
                      >
                        <Text style={styles.retryPaymentButtonText}>🔄 Retry Payment</Text>
                      </TouchableOpacity>
                    </View>
                  );
                } else if (isProcessing) {
                  return (
                    <View style={styles.processingActions}>
                      {isNearTimeout && (
                        <View style={styles.timeoutNearing}>
                          <Text style={styles.timeoutNearingText}>⏳ {formatTimeRemaining(item.timestamp, item.provider || '')}</Text>
                          <Text style={styles.timeoutNearingSubtext}>Payment will auto-cancel if not completed</Text>
                        </View>
                      )}
                      
                      {/* Cancel Button for Processing Payments */}
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
                } else if (canRetry) {
                  return (
                    <View style={styles.failedPaymentActions}>
                      <Text style={styles.failedPaymentText}>
                        {item.status === 'failed' ? '❌ Payment Failed' : 
                         item.status === 'cancelled' ? '🚫 Payment Cancelled' : '⏰ Payment Expired'}
                      </Text>
                      
                      {/* Retry Button for Failed/Cancelled Payments */}
                      <TouchableOpacity
                        style={styles.retryPaymentButton}
                        onPress={() => retryPayment(item)}
                      >
                        <Text style={styles.retryPaymentButtonText}>🔄 Retry Payment</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }
                
                return null;
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
              {item.item_name} - ${item.item_price ? (item.item_price / 100).toFixed(2) : '0.00'}
            </Text>
            {item.item_description && (
              <Text style={styles.requestDescription} numberOfLines={2}>
                {item.item_description}
              </Text>
            )}
            <Text style={styles.requestReason}>
              Reason: {item.reason}
            </Text>
            
            {/* Approval buttons for pending requests */}
            {item.status === 'pending' && (
              <View style={styles.requestActions}>
                <TouchableOpacity
                  style={styles.declineButton}
                  onPress={() => handleDeclineItem(item.id, item.item_name || 'item')}
                >
                  <Text style={styles.declineButtonText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.approveButton}
                  onPress={() => handleApproveItem(
                    item.id, 
                    item.item_name || 'item', 
                    item.item_price || 0,
                    item.student_id || '',
                    item.item_description
                  )}
                >
                  <Text style={styles.approveButtonText}>Approve & Send</Text>
                </TouchableOpacity>
              </View>
            )}
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
        <Text style={styles.subtitle}>All your family activity in one place</Text>
        
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{activities?.length || 0}</Text>
            <Text style={styles.statLabel}>Total Activity</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{activities?.filter(a => a.type === 'payment').length || 0}</Text>
            <Text style={styles.statLabel}>Payments</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{activities?.filter(a => a.type === 'item_request').length || 0}</Text>
            <Text style={styles.statLabel}>Requests</Text>
          </View>
        </View>
        
        {/* Activity List Header */}
        <View ref={allActivityRef} style={styles.activityListHeader}>
          <Text style={styles.activityListTitle}>All Activity</Text>
        </View>
        
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
            
            {filteredActivities.length === 0 ? (
              <View style={styles.emptyFilterContainer}>
                <Text style={styles.emptyFilterTitle}>No matching activities</Text>
                <Text style={styles.emptyFilterText}>
                  Try adjusting your filters above
                </Text>
              </View>
            ) : (
              <>
                {displayedActivities.map(renderActivityItem)}
                
                {/* Pagination Controls */}
                {filteredActivities.length > itemsPerPage && (
                  <View style={styles.paginationContainer}>
                    <TouchableOpacity
                      style={[styles.paginationButton, currentPage === 0 && styles.paginationButtonDisabled]}
                      onPress={previousPage}
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
                      style={[styles.paginationButton, currentPage >= Math.ceil(filteredActivities.length / itemsPerPage) - 1 && styles.paginationButtonDisabled]}
                      onPress={nextPage}
                      disabled={currentPage >= Math.ceil(filteredActivities.length / itemsPerPage) - 1}
                    >
                      <Text style={[styles.paginationButtonText, currentPage >= Math.ceil(filteredActivities.length / itemsPerPage) - 1 && styles.paginationButtonTextDisabled]}>
                        Next
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
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
    marginBottom: 20,
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
  activityListHeader: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: 8,
  },
  activityListTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
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
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: 16,
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
  failedPaymentActions: {
    backgroundColor: '#fef2f2', // Light red background
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  failedPaymentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: 8,
    textAlign: 'center',
  },
  retryPaymentButton: {
    backgroundColor: '#059669', // Green background for retry
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'center',
    marginTop: 4,
  },
  retryPaymentButtonText: {
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
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 12,
  },
  declineButton: {
    flex: 1,
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.error,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  declineButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.error,
  },
  approveButton: {
    flex: 1,
    backgroundColor: theme.colors.success,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  approveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  paginationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    minWidth: 80,
  },
  paginationButtonDisabled: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
  },
  paginationButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
  paginationInfo: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
});