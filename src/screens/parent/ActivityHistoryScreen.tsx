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
  AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../stores/authStore';
import { collection, query, where, orderBy, getDocs, Timestamp, limit } from 'firebase/firestore';
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
  type: 'payment' | 'message' | 'item_request' | 'support_request';
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
type FilterType = 'all' | 'payments' | 'messages' | 'items' | 'support';

export const ActivityHistoryScreen: React.FC<ActivityHistoryScreenProps> = ({ navigation }) => {
  const { user } = useAuthStore();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityItem[]>([]);
  const [displayedActivities, setDisplayedActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('month');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage] = useState(10);
  const [newActivityIds, setNewActivityIds] = useState<string[]>([]);
  const [seenActivityIds, setSeenActivityIds] = useState<Set<string>>(new Set());
  const [seenActivitiesLoaded, setSeenActivitiesLoaded] = useState(false);
  const [previousActivities, setPreviousActivities] = useState<ActivityItem[]>([]);
  const animatedValues = useRef<{ [key: string]: Animated.Value }>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const allActivityRef = useRef<View>(null);

  // Load seen activities from storage
  const loadSeenActivities = async () => {
    if (!user) {
      console.log('⚠️ No user found, cannot load seen activities');
      setSeenActivitiesLoaded(true);
      return;
    }
    
    try {
      const seenKey = `seen_activities_${user.id}`;
      console.log(`🔍 Loading seen activities with key: ${seenKey}`);
      
      // Test AsyncStorage is working
      const testKey = `test_${user.id}`;
      await AsyncStorage.setItem(testKey, 'test_value');
      const testValue = await AsyncStorage.getItem(testKey);
      console.log(`🧪 AsyncStorage test: ${testValue === 'test_value' ? 'WORKING' : 'FAILED'}`);
      
      const seenData = await AsyncStorage.getItem(seenKey);
      console.log(`🔍 Raw seen data from storage:`, seenData ? `"${seenData}"` : 'null');
      
      if (seenData) {
        const seenIds = JSON.parse(seenData) as string[];
        setSeenActivityIds(new Set(seenIds));
        console.log(`📖 Loaded ${seenIds.length} seen activities from storage:`, seenIds.slice(0, 5));
      } else {
        console.log('📖 No seen activities found in storage - first time user or empty');
        setSeenActivityIds(new Set());
      }
    } catch (error) {
      console.error('❌ Error loading seen activities:', error);
      setSeenActivityIds(new Set()); // Fallback to empty set
    } finally {
      setSeenActivitiesLoaded(true);
      console.log('✅ Seen activities loading completed');
    }
  };

  // Save seen activities to storage
  const saveSeenActivities = async (seenIds: Set<string>) => {
    if (!user) {
      console.log('⚠️ No user found, cannot save seen activities');
      return;
    }
    
    try {
      const seenKey = `seen_activities_${user.id}`;
      const seenArray = Array.from(seenIds);
      await AsyncStorage.setItem(seenKey, JSON.stringify(seenArray));
      console.log(`💾 Saved ${seenIds.size} seen activities to storage with key: ${seenKey}`);
      console.log(`💾 Sample saved IDs:`, seenArray.slice(0, 5));
    } catch (error) {
      console.error('❌ Error saving seen activities:', error);
    }
  };

  // Mark activities as seen when they become visible
  const markActivitiesAsSeen = (activityIds: string[]) => {
    if (activityIds.length === 0) return;
    
    const updatedSeenIds = new Set(seenActivityIds);
    const newlySeenIds: string[] = [];
    
    for (const id of activityIds) {
      if (!updatedSeenIds.has(id)) {
        updatedSeenIds.add(id);
        newlySeenIds.push(id);
      }
    }
    
    if (newlySeenIds.length > 0) {
      console.log(`👁️ Marking ${newlySeenIds.length} activities as seen:`, newlySeenIds.slice(0, 3));
      setSeenActivityIds(updatedSeenIds);
      // Save immediately instead of waiting for app state changes
      saveSeenActivities(updatedSeenIds).catch(error => {
        console.error('Failed to save seen activities immediately:', error);
      });
    }
  };


  // Manual PayPal verification for debugging
  const runManualPayPalVerification = async () => {
    if (!user) return;
    
    console.log('🔧 Running manual PayPal verification...');
    try {
      const { autoVerifyPendingPayPalPayments } = await import('../../lib/paypalIntegration');
      const verifiedCount = await autoVerifyPendingPayPalPayments(user.id);
      console.log(`🔧 Manual verification completed: ${verifiedCount} payments verified`);
      
      // Refresh activities to show updates
      await loadActivities(true);
      
      Alert.alert(
        'PayPal Verification Complete',
        `${verifiedCount} payments were verified and updated.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('🔧 Manual PayPal verification failed:', error);
      Alert.alert('Error', `Verification failed: ${error.message}`);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      console.log('🚀 Starting data initialization...');
      await loadSeenActivities(); // Wait for seen activities to load first
      console.log('📋 Seen activities loaded, now loading fresh activities...');
    };
    
    initializeData();

    // Set up auto-reload every 15 seconds (reduced from 10)
    const autoReloadInterval = setInterval(() => {
      console.log('🔄 Auto-reloading activity history...');
      loadActivities(true);
    }, 15000);

    // Set up more frequent checking for processing payments (every 2 seconds - increased frequency)
    const frequentCheckInterval = setInterval(() => {
      const hasProcessingPayments = activities.some(activity => 
        activity.type === 'payment' && 
        (activity.status === 'initiated' || activity.status === 'pending' || activity.status === 'processing')
      );
      
      if (hasProcessingPayments) {
        console.log('🔄 Quick check for processing payments...');
        loadActivities(true);
      }
    }, 2000);

    // Set up ultra-frequent checking for very recent processing payments (every 1 second for first 30 seconds)
    const ultraFrequentCheckInterval = setInterval(() => {
      const now = new Date();
      const recentProcessingPayments = activities.some(activity => 
        activity.type === 'payment' && 
        (activity.status === 'initiated' || activity.status === 'pending' || activity.status === 'processing') &&
        activity.timestamp &&
        (now.getTime() - activity.timestamp.getTime()) < 30000 // Within last 30 seconds
      );
      
      if (recentProcessingPayments) {
        console.log('⚡ Ultra-quick check for very recent processing payments...');
        loadActivities(true);
      }
    }, 1000);

    // Set up PayPal auto-verification (every 10 seconds) - will be created later when activities are loaded

    // Clear intervals on component unmount
    return () => {
      clearInterval(autoReloadInterval);
      clearInterval(frequentCheckInterval);
      clearInterval(ultraFrequentCheckInterval);
    };
  }, []);

  // Save seen activities when app goes to background or component unmounts
  // Also refresh when app comes back to foreground (user might have completed payments)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        console.log('📱 App going to background, saving seen activities');
        saveSeenActivities(seenActivityIds);
      } else if (nextAppState === 'active') {
        console.log('📱 App returning to foreground, refreshing activities...');
        loadActivities(true); // Immediate refresh when app becomes active
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Also save on component unmount
    return () => {
      console.log('🔄 Component unmounting, saving seen activities');
      saveSeenActivities(seenActivityIds);
      subscription?.remove();
    };
  }, [seenActivityIds]);

  // Load activities only after seen activities are loaded
  useEffect(() => {
    if (seenActivitiesLoaded) {
      console.log('📋 Seen activities are loaded, loading activities now...');
      loadActivities();
    }
  }, [seenActivitiesLoaded]);

  // Set up PayPal auto-verification based on current activities
  useEffect(() => {
    if (!user || activities.length === 0) return;

    const hasPayPalProcessing = activities.some(activity => 
      activity.type === 'payment' && 
      activity.provider === 'paypal' &&
      (activity.status === 'initiated' || activity.status === 'pending' || activity.status === 'processing')
    );

    console.log(`🔍 PayPal verification check: ${hasPayPalProcessing ? 'NEEDED' : 'NOT NEEDED'} (${activities.length} activities total)`);

    let paypalVerifyInterval: NodeJS.Timeout | null = null;

    if (hasPayPalProcessing) {
      console.log('⚡ Starting PayPal auto-verification timer...');
      
      // Check if there are very recent PayPal payments (last 2 minutes) - use faster verification
      const now = new Date();
      const hasRecentPayPalProcessing = activities.some(activity => 
        activity.type === 'payment' && 
        activity.provider === 'paypal' &&
        (activity.status === 'initiated' || activity.status === 'pending' || activity.status === 'processing') &&
        activity.timestamp &&
        (now.getTime() - activity.timestamp.getTime()) < 120000 // Within last 2 minutes
      );
      
      const verificationInterval = hasRecentPayPalProcessing ? 3000 : 10000; // 3s for recent, 10s for older
      console.log(`💙 Using ${verificationInterval/1000}s PayPal verification interval (recent payments: ${hasRecentPayPalProcessing})`);
      
      paypalVerifyInterval = setInterval(async () => {
        console.log('💙 Running scheduled PayPal auto-verification...');
        try {
          const { autoVerifyPendingPayPalPayments } = await import('../../lib/paypalIntegration');
          const verifiedCount = await autoVerifyPendingPayPalPayments(user.id);
          if (verifiedCount > 0) {
            console.log(`✅ Auto-verified ${verifiedCount} PayPal payments`);
            loadActivities(true);
          } else {
            console.log('💙 No PayPal payments were verified');
          }
        } catch (error) {
          console.error('⚠️ PayPal auto-verification failed:', error);
        }
      }, verificationInterval);
    }

    // Cleanup
    return () => {
      if (paypalVerifyInterval) {
        console.log('🛑 Stopping PayPal auto-verification timer');
        clearInterval(paypalVerifyInterval);
      }
    };
  }, [activities, user]);

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
      } else if (isRefresh && activities.length > 0) {
        setBackgroundRefreshing(true);
      }
      
      console.log(`🔄 Loading activities from database (${isRefresh ? 'refresh' : 'initial'})...`);
      
      const allActivities: ActivityItem[] = [];

      // Load payments with optimized student name caching - limit to latest 15
      const paymentsQuery = query(
        collection(db, 'payments'),
        where('parent_id', '==', user.id),
        orderBy('created_at', 'desc'),
        limit(15)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      
      console.log(`📄 Found ${paymentsSnapshot.size} payments (latest 15)`);
      
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
          student_name: studentName,
          student_id: studentId // Include student ID for reliable retry payments
        });
      }

      // Load messages with caching
      try {
        const messagesQuery = query(
          collection(db, 'messages'),
          where('from_user_id', '==', user.id),
          orderBy('created_at', 'desc'),
          limit(10)
        );
        const messagesSnapshot = await getDocs(messagesQuery);
        
        console.log(`💬 Found ${messagesSnapshot.size} messages (latest 10)`);
        
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
        const requests = await getItemRequestsForParent(user.id, 10);
        
        console.log(`📦 Found ${requests.length} item requests (latest 10)`);
        
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

      // Load support requests - limit to latest 10
      try {
        const { getUserProfile } = await import('../../lib/firebase');
        const userProfile = await getUserProfile(user.id);
        
        if (userProfile?.family_id) {
          const supportRequestsQuery = query(
            collection(db, 'support_requests'),
            where('family_id', '==', userProfile.family_id),
            orderBy('created_at', 'desc'),
            limit(10)
          );
          const supportRequestsSnapshot = await getDocs(supportRequestsQuery);
          
          console.log(`🆘 Found ${supportRequestsSnapshot.size} support requests (latest 10)`);
          
          for (const doc of supportRequestsSnapshot.docs) {
            const supportRequest = doc.data();
            const requesterId = supportRequest.from_user_id;
            
            // Check cache first for requester name
            let requesterName: string = (await cache.get(CACHE_CONFIGS.STUDENT_NAMES, `${user.id}_${requesterId}`)) as string || '';
            if (!requesterName) {
              const requesterQuery = query(
                collection(db, 'users'),
                where('id', '==', requesterId)
              );
              const requesterSnapshot = await getDocs(requesterQuery);
              requesterName = requesterSnapshot.docs[0]?.data()?.full_name || 'Student';
              await cache.set(CACHE_CONFIGS.STUDENT_NAMES, requesterName, `${user.id}_${requesterId}`);
            }

            allActivities.push({
              id: doc.id,
              type: 'support_request',
              timestamp: supportRequest.created_at && supportRequest.created_at.toDate ? supportRequest.created_at.toDate() : new Date(),
              status: supportRequest.acknowledged ? 'acknowledged' : 'pending',
              message_content: supportRequest.message,
              student_name: requesterName,
              student_id: requesterId
            });
          }
        }
      } catch (supportRequestsError) {
        console.log('Support requests query failed:', supportRequestsError);
      }

      // Sort all activities by timestamp (newest first)
      allActivities.sort((a, b) => {
        const aTime = a.timestamp && a.timestamp.getTime ? a.timestamp.getTime() : 0;
        const bTime = b.timestamp && b.timestamp.getTime ? b.timestamp.getTime() : 0;
        return bTime - aTime;
      });

      // Only process "new" activities if seen activities have been loaded
      if (seenActivitiesLoaded) {
        // Mark truly new activities (not previously seen) for highlighting
        const existingIds = new Set(activities.map(a => a.id));
        const allActivityIds = allActivities.map(a => a.id);
        
        console.log(`🔍 Checking for new activities and status changes:`);
        console.log(`  - Current activities: ${activities.length}`);
        console.log(`  - New activities from DB: ${allActivities.length}`);
        console.log(`  - Previous activities: ${previousActivities.length}`);
        console.log(`  - Seen activities in memory: ${seenActivityIds.size}`);
        console.log(`  - Seen activities loaded: ${seenActivitiesLoaded}`);
        
        // Find truly new activities
        const brandNewIds = allActivities
          .filter(a => !seenActivityIds.has(a.id))
          .map(a => a.id);
        
        // Find activities with status changes
        const statusChangedIds: string[] = [];
        if (previousActivities.length > 0) {
          const previousMap = new Map(previousActivities.map(a => [a.id, a.status]));
          allActivities.forEach(currentActivity => {
            const previousStatus = previousMap.get(currentActivity.id);
            if (previousStatus && previousStatus !== currentActivity.status) {
              console.log(`📊 Status change detected for ${currentActivity.id.slice(-6)}: ${previousStatus} → ${currentActivity.status}`);
              statusChangedIds.push(currentActivity.id);
            }
          });
        }
        
        // Combine new activities and status changes
        const allHighlightIds = [...new Set([...brandNewIds, ...statusChangedIds])];
        
        console.log(`  - Activities not in seen set: ${brandNewIds.length}`);
        console.log(`  - Activities with status changes: ${statusChangedIds.length}`);
        console.log(`  - Total to highlight: ${allHighlightIds.length}`);
        
        if (allHighlightIds.length > 0) {
          setNewActivityIds(allHighlightIds);
          console.log(`✨ Highlighting ${allHighlightIds.length} activities (${brandNewIds.length} new + ${statusChangedIds.length} status changes):`, allHighlightIds.slice(0, 3));
          
          // Mark new activities as seen immediately to prevent re-highlighting
          // But don't mark status changes as "seen" - they should highlight until user sees them
          if (brandNewIds.length > 0) {
            markActivitiesAsSeen(brandNewIds);
          }
          
          // Clear new activity indicators after animation
          setTimeout(() => {
            setNewActivityIds([]);
            // Mark status changed activities as seen after the animation
            if (statusChangedIds.length > 0) {
              markActivitiesAsSeen(statusChangedIds);
            }
          }, 5000);
        } else {
          console.log(`✅ No new activities or status changes to highlight`);
        }
      } else {
        console.log(`⏳ Seen activities not loaded yet, skipping new activity detection`);
        setNewActivityIds([]); // Clear any existing new activity indicators
      }

      // Store current activities for next comparison
      setPreviousActivities([...allActivities]);

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
      setBackgroundRefreshing(false);
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

  // Mark displayed activities as seen after a short delay (only if not already seen)
  useEffect(() => {
    if (displayedActivities.length > 0 && seenActivitiesLoaded) {
      const unseenVisibleIds = displayedActivities
        .filter(a => !seenActivityIds.has(a.id))
        .map(a => a.id);
      
      if (unseenVisibleIds.length > 0) {
        // Mark as seen after 2 seconds of being visible
        const timer = setTimeout(() => {
          console.log(`⏰ Auto-marking ${unseenVisibleIds.length} unseen displayed activities as seen`);
          markActivitiesAsSeen(unseenVisibleIds);
        }, 2000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [displayedActivities, seenActivityIds, seenActivitiesLoaded]);

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
      } else if (filterType === 'support') {
        filtered = filtered.filter(activity => activity.type === 'support_request');
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

  const handleAcknowledgeSupport = async (requestId: string, studentName: string) => {
    Alert.alert(
      'Acknowledge Support Request',
      `Let ${studentName} know you've seen their support request and will help them.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Acknowledge', 
          onPress: async () => {
            try {
              const { doc, updateDoc } = await import('firebase/firestore');
              await updateDoc(doc(db, 'support_requests', requestId), {
                acknowledged: true,
                acknowledged_at: new Date(),
                acknowledged_by: user?.id
              });
              
              // Refresh activities to show updated status
              loadActivities(true);
              
              Alert.alert(
                'Support Acknowledged',
                `${studentName} will be notified that you've seen their request.`,
                [{ text: 'OK' }]
              );
            } catch (error) {
              console.error('Error acknowledging support request:', error);
              Alert.alert('Error', 'Failed to acknowledge support request. Please try again.');
            }
          }
        }
      ]
    );
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
    } else if (type === 'support_request') {
      switch (status) {
        case 'acknowledged': return '#10b981';
        case 'pending': return '#dc2626';
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
    } else if (type === 'support_request') {
      switch (status) {
        case 'acknowledged': return 'Acknowledged';
        case 'pending': return 'Needs Response';
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

    console.log('🔄 Starting retry payment for:', {
      amount: payment.amount,
      student_name: payment.student_name,
      provider: payment.provider,
      payment_id: payment.id
    });

    Alert.alert(
      'Retry Payment',
      `Retry sending $${payment.amount.toFixed(2)} via ${payment.provider?.charAt(0).toUpperCase()}${payment.provider?.slice(1)} to ${payment.student_name.split(' ')[0]}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Retry Payment',
          onPress: async () => {
            try {
              let targetStudent: { id: string; name: string } | undefined;
              
              // First try using direct student_id if available (most reliable)
              if (payment.student_id) {
                console.log('🎯 Using direct student ID:', payment.student_id);
                targetStudent = { id: payment.student_id, name: payment.student_name || 'Student' };
              } else {
                // Fallback to family member lookup by name
                console.log('👥 Loading family members for name lookup...');
                const { getFamilyMembers } = useAuthStore.getState();
                const familyMembers = await getFamilyMembers();
                console.log('👥 Family members loaded:', {
                  students: familyMembers.students.map(s => ({ id: s.id, name: s.name }))
                });
                
                // Try exact match first, then partial match
                targetStudent = familyMembers.students.find(s => 
                  s.name === payment.student_name
                );
                
                if (!targetStudent) {
                  console.log('🔍 Exact match failed, trying partial match...');
                  // Try partial match (in case names are formatted differently)
                  targetStudent = familyMembers.students.find(s => 
                    s.name.includes(payment.student_name || '') || 
                    (payment.student_name && payment.student_name.includes(s.name)) ||
                    s.name.toLowerCase() === payment.student_name?.toLowerCase()
                  );
                }

                if (!targetStudent) {
                  console.error('❌ No student found for retry payment:', {
                    searching_for: payment.student_name,
                    available_students: familyMembers.students.map(s => s.name)
                  });
                  Alert.alert('Error', `Unable to find student "${payment.student_name}" in your family. Please try creating a new payment instead.`);
                  return;
                }
              }
              
              console.log('✅ Found target student:', targetStudent);

              const amountCents = Math.round(payment.amount! * 100);
              const provider = payment.provider as 'paypal' | 'venmo' | 'cashapp' | 'zelle';
              
              console.log('💰 Creating retry payment:', {
                studentId: targetStudent.id,
                amountCents,
                provider,
                note: payment.note
              });

              if (provider === 'paypal') {
                // Use PayPal P2P system
                console.log('💙 Creating PayPal P2P order...');
                const { createPayPalP2POrder } = await import('../../lib/paypalP2P');
                const result = await createPayPalP2POrder(
                  targetStudent.id,
                  amountCents,
                  payment.note || `Retry payment: $${payment.amount?.toFixed(2) || '0.00'}`
                );
                
                console.log('💙 PayPal P2P result:', result);

                if (result.success && result.approvalUrl) {
                  console.log('✅ PayPal order created, opening URL:', result.approvalUrl);
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
                  console.error('❌ PayPal order creation failed:', result);
                  throw new Error(result.error || 'Failed to create PayPal order');
                }
              } else {
                // Use regular payment intent for other providers
                console.log(`💳 Creating ${provider} payment intent...`);
                const { createPaymentIntent } = await import('../../lib/payments');
                const result = await createPaymentIntent(
                  targetStudent.id,
                  amountCents,
                  provider,
                  payment.note || `Retry payment: $${payment.amount?.toFixed(2) || '0.00'}`
                );
                
                console.log(`💳 ${provider} payment intent result:`, result);

                if (result.success) {
                  // Open the provider app/website
                  if (result.redirectUrl) {
                    console.log(`🔗 Opening ${provider} URL:`, result.redirectUrl);
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
                  console.error(`❌ ${provider} payment creation failed:`, result);
                  throw new Error(result.error || 'Failed to create payment');
                }
              }
            } catch (error: any) {
              console.error('❌ Error retrying payment:', error);
              
              // More specific error messages
              let errorMessage = 'Unable to retry payment. Please try again.';
              if (error.message) {
                if (error.message.includes('permission')) {
                  errorMessage = 'Permission denied. Please make sure you are logged in.';
                } else if (error.message.includes('network') || error.message.includes('fetch')) {
                  errorMessage = 'Network error. Please check your internet connection.';
                } else if (error.message.includes('student')) {
                  errorMessage = error.message; // Keep student-related error messages as is
                } else {
                  errorMessage = error.message;
                }
              }
              
              Alert.alert('Retry Failed', errorMessage);
            }
          }
        }
      ]
    );
  };

  const renderActivityItem = (item: ActivityItem) => {
    return (
      <View key={item.id}>
        <TouchableOpacity 
          style={styles.activityItem}
        >
        <View style={styles.activityHeader}>
          <View style={styles.activityInfo}>
            <Text style={styles.activityType}>
              {item.type === 'payment' ? 'Payment' : 
               item.type === 'item_request' ? 'Item Request' : 
               item.type === 'support_request' ? 'Support Request' : 'Message'}
              {item.student_name && ` ${item.type === 'item_request' ? 'from' : item.type === 'support_request' ? 'from' : 'to'} ${item.student_name.split(' ')[0]}`}
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

        {item.type === 'support_request' && (
          <View style={styles.supportDetails}>
            <Text style={styles.supportMessage}>
              "{item.message_content}"
            </Text>
            
            {/* Acknowledge button for pending support requests */}
            {item.status === 'pending' && (
              <TouchableOpacity
                style={styles.acknowledgeButton}
                onPress={() => handleAcknowledgeSupport(item.id, item.student_name || 'Student')}
              >
                <Text style={styles.acknowledgeButtonText}>Acknowledge & Respond</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusHeader title="Activity History" />
      <ScrollView
        ref={scrollViewRef}
        style={[styles.scrollView, { paddingTop: 50 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
        contentContainerStyle={{ paddingBottom: 80 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>All Activity</Text>
            {backgroundRefreshing && (
              <ActivityIndicator 
                size="small" 
                color={theme.colors.primary} 
                style={styles.backgroundRefreshIndicator}
              />
            )}
          </View>
          <Text style={styles.subtitle}>
            Your family connections and support
            {backgroundRefreshing && <Text style={styles.refreshingText}> • Refreshing...</Text>}
          </Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#10b981' }]}>{activities?.filter(a => a.type === 'payment').length || 0}</Text>
            <Text style={styles.statLabel}>Payments</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#3b82f6' }]}>{activities?.filter(a => a.type === 'message').length || 0}</Text>
            <Text style={styles.statLabel}>Messages</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#f59e0b' }]}>{activities?.filter(a => a.type === 'item_request').length || 0}</Text>
            <Text style={styles.statLabel}>Items</Text>
          </View>
        </View>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading activity...</Text>
          </View>
        ) : activities.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No activities found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
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
                {(['all', 'payments', 'messages', 'items', 'support'] as FilterType[]).map((type, index) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.segment,
                      index === 0 && styles.segmentFirst,
                      index === 4 && styles.segmentLast,
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
                       type === 'messages' ? 'Messages' : 
                       type === 'items' ? 'Items' : 'Support'}
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
                {displayedActivities.map(renderActivityItem)}
              </View>
            )}

            {/* Pagination */}
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
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  backgroundRefreshIndicator: {
    marginLeft: 12,
  },
  refreshingText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '500',
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
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  activitiesList: {
    gap: 1,
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
  // Support request styles
  supportDetails: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  supportMessage: {
    fontSize: 14,
    color: theme.colors.text,
    fontStyle: 'italic',
    marginBottom: 12,
    lineHeight: 20,
  },
  acknowledgeButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  acknowledgeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
});