import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, updateDoc, collection, addDoc, Timestamp } from 'firebase/firestore';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushNotificationToken {
  token: string;
  userId: string;
  deviceId: string;
  platform: string;
  createdAt: Date;
  lastUpdated: Date;
}

export interface NotificationPreferences {
  enabled: boolean;
  supportMessages: boolean;
  paymentUpdates: boolean;
  wellnessReminders: boolean;
  careRequests: boolean;
  weeklyReports: boolean;
  dailySummaries: boolean;
  studentWellnessLogged: boolean;
}

export interface NotificationData {
  type: 'support_received' | 'payment_received' | 'wellness_reminder' | 'care_request' | 'payment_status' | 'weekly_report' | 'daily_summary' | 'student_wellness_logged';
  title: string;
  body: string;
  data?: { [key: string]: any };
  userId: string;
  priority?: 'default' | 'high';
  sound?: 'default' | 'none';
}

class PushNotificationService {
  private token: string | null = null;
  private isInitialized = false;

  /**
   * Initialize push notifications and register device token
   */
  async initialize(userId: string): Promise<string | null> {
    try {
      console.log('🔔 Initializing push notifications...');

      // Check if device supports push notifications
      if (!Device.isDevice) {
        console.log('⚠️ Push notifications only work on physical devices');
        return null;
      }

      // Suppress expo-notifications warnings by catching them
      const originalError = console.error;
      const originalWarn = console.warn;
      console.error = (...args: any[]) => {
        const message = args.join(' ');
        if (message.includes('expo-notifications') || message.includes('Android Push notifications')) {
          return; // Suppress these specific errors
        }
        originalError.apply(console, args);
      };
      console.warn = (...args: any[]) => {
        const message = args.join(' ');
        if (message.includes('expo-notifications') || message.includes('Android Push notifications')) {
          return; // Suppress these specific warnings
        }
        originalWarn.apply(console, args);
      };

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        console.log('📱 Requesting notification permissions...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('⚠️ Notification permissions denied - continuing without notifications');
        return null;
      }

      // Get push token
      let projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      
      // Fallback for development without EAS
      if (!projectId) {
        console.warn('⚠️ No EAS project ID found. Using Firebase project ID as fallback for development.');
        projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
      }
      
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });

      this.token = tokenData.data;
      this.isInitialized = true;

      console.log('✅ Push notification token obtained:', this.token);

      // Store token in Firebase
      await this.saveTokenToFirebase(userId, this.token);

      // Set up notification received listener
      this.setupNotificationListeners();

      // Restore console functions
      console.error = originalError;
      console.warn = originalWarn;

      return this.token;

    } catch (error) {
      // Restore console functions on error
      try {
        console.error = originalError;
        console.warn = originalWarn;
      } catch {}
      console.warn('⚠️ Error initializing push notifications:', error);
      return null;
    }
  }

  /**
   * Save push token to Firebase for this user
   */
  private async saveTokenToFirebase(userId: string, token: string): Promise<void> {
    try {
      // Ensure Firebase is initialized by importing it dynamically
      const { db: firebaseDb } = await import('../lib/firebase');
      
      const deviceId = Constants.deviceId || 'unknown';
      
      const tokenData: Omit<PushNotificationToken, 'id'> = {
        token,
        userId,
        deviceId,
        platform: Platform.OS,
        createdAt: new Date(),
        lastUpdated: new Date()
      };

      // Update user document with latest token and default notification preferences
      const defaultPreferences: NotificationPreferences = {
        enabled: true,
        supportMessages: true,
        paymentUpdates: true,
        wellnessReminders: true,
        careRequests: true,
        weeklyReports: true,
        dailySummaries: true,
        studentWellnessLogged: true
      };

      console.log('💾 Setting notification preferences for user:', userId, defaultPreferences);

      await updateDoc(doc(firebaseDb, 'users', userId), {
        pushToken: token,
        pushTokenUpdatedAt: Timestamp.now(),
        deviceInfo: {
          platform: Platform.OS,
          deviceId
        },
        notificationPreferences: defaultPreferences
      });

      // Also store in dedicated push_tokens collection for easier querying
      await addDoc(collection(firebaseDb, 'push_tokens'), {
        ...tokenData,
        createdAt: Timestamp.fromDate(tokenData.createdAt),
        lastUpdated: Timestamp.fromDate(tokenData.lastUpdated)
      });

      console.log('💾 Push token saved to Firebase');

    } catch (error) {
      console.error('❌ Error saving push token:', error);
    }
  }

  /**
   * Set up listeners for notification interactions
   */
  private setupNotificationListeners(): void {
    // Handle notification received while app is running
    Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 Notification received:', notification);
    });

    // Handle notification tapped/opened
    Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Notification tapped:', response);
      
      const data = response.notification.request.content.data;
      if (data?.type) {
        this.handleNotificationTap(data);
      }
    });
  }

  /**
   * Handle when user taps on a notification
   */
  private handleNotificationTap(data: any): void {
    console.log('🎯 Handling notification tap:', data);
    
    // You can add navigation logic here based on notification type
    switch (data.type) {
      case 'support_received':
        // Navigate to messages screen
        break;
      case 'payment_received':
        // Navigate to activity screen
        break;
      case 'wellness_reminder':
        // Navigate to wellness screen
        break;
      case 'care_request':
        // Navigate to support requests
        break;
      default:
        console.log('Unknown notification type:', data.type);
    }
  }

  /**
   * Send a local notification (for testing)
   */
  async sendLocalNotification(title: string, body: string, data?: any): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: 'default',
        },
        trigger: null, // Send immediately
      });

      console.log('📱 Local notification sent');
    } catch (error) {
      console.error('❌ Error sending local notification:', error);
    }
  }

  /**
   * Check if user has enabled a specific notification type
   */
  async checkNotificationPreferences(userId: string, notificationType: string): Promise<boolean> {
    try {
      const { doc: firestoreDoc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      
      const userDoc = await getDoc(firestoreDoc(db, 'users', userId));
      if (!userDoc.exists()) return false;
      
      const userData = userDoc.data();
      const preferences = userData.notificationPreferences as NotificationPreferences;
      
      if (!preferences || !preferences.enabled) return false;
      
      // Check specific notification type preferences
      switch (notificationType) {
        case 'support_received':
          return preferences.supportMessages;
        case 'payment_received':
        case 'payment_status':
          return preferences.paymentUpdates;
        case 'wellness_reminder':
          return preferences.wellnessReminders;
        case 'care_request':
          return preferences.careRequests;
        case 'weekly_report':
          return preferences.weeklyReports;
        case 'daily_summary':
          return preferences.dailySummaries;
        case 'student_wellness_logged':
          return preferences.studentWellnessLogged;
        default:
          return true; // Default to enabled for unknown types
      }
    } catch (error) {
      console.error('Error checking notification preferences:', error);
      return true; // Default to enabled if we can't check
    }
  }

  /**
   * Send push notification via Firebase Cloud Function
   */
  async sendPushNotification(notification: NotificationData): Promise<boolean> {
    try {
      // Call Firebase Cloud Function to send the notification
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('../lib/firebase');
      
      const sendNotification = httpsCallable(functions, 'sendPushNotification');
      
      const result = await sendNotification({
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        notificationData: notification.data || {}
      });

      const data = result.data as any;
      console.log('📤 Push notification sent via Cloud Function:', data);
      
      return data.success === true;
    } catch (error) {
      console.error('❌ Error sending push notification via Cloud Function:', error);
      
      // Fallback to direct Expo API call for development/testing
      console.log('🔄 Falling back to direct Expo API call...');
      return this.sendPushNotificationDirect(notification);
    }
  }

  /**
   * Fallback method: Send push notification directly to Expo (for development)
   */
  private async sendPushNotificationDirect(notification: NotificationData): Promise<boolean> {
    try {
      // Check if user has enabled this notification type
      const isEnabled = await this.checkNotificationPreferences(notification.userId, notification.type);
      if (!isEnabled) {
        console.log('📵 Notification disabled for user:', notification.userId, notification.type);
        return false;
      }

      // Get user's push token
      const { doc: firestoreDoc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      
      const userDoc = await getDoc(firestoreDoc(db, 'users', notification.userId));
      if (!userDoc.exists()) {
        console.log('📵 User not found:', notification.userId);
        return false;
      }
      
      const userData = userDoc.data();
      const userToken = userData.pushToken;
      
      if (!userToken) {
        console.log('📵 No push token for user:', notification.userId);
        return false;
      }

      // Direct call to Expo API (fallback for development)
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: userToken,
          title: notification.title,
          body: notification.body,
          data: {
            ...notification.data,
            type: notification.type,
            userId: notification.userId
          },
          priority: notification.priority || 'default',
          sound: notification.sound || 'default'
        }),
      });

      const result = await response.json();
      console.log('📤 Push notification sent (direct):', result);
      
      return result.data?.status === 'ok';
    } catch (error) {
      console.error('❌ Error sending push notification (direct):', error);
      return false;
    }
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
      console.log('🧹 All notifications cleared');
    } catch (error) {
      console.error('❌ Error clearing notifications:', error);
    }
  }

  /**
   * Get current push token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Check if notifications are initialized
   */
  isReady(): boolean {
    return this.isInitialized && !!this.token;
  }

  /**
   * Schedule daily wellness reminders for students
   */
  async scheduleDailyWellnessReminder(userId: string): Promise<void> {
    try {
      // Check if user is a student
      const { getUserProfile } = await import('../lib/firebase');
      const userProfile = await getUserProfile(userId);
      
      if (!userProfile || userProfile.user_type !== 'student') {
        return;
      }

      // Check if already scheduled today (prevent duplicates)
      const lastScheduledKey = `wellness_reminder_scheduled_${userId}`;
      const lastScheduled = await import('@react-native-async-storage/async-storage').then(module => 
        module.default.getItem(lastScheduledKey)
      );
      
      const today = new Date().toDateString();
      if (lastScheduled === today) {
        console.log('📅 Wellness reminder already scheduled for today');
        return;
      }

      // Cancel any existing wellness reminder notifications first
      const existingNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const wellnessNotifications = existingNotifications.filter(
        notif => notif.content.data?.type === 'wellness_reminder' && notif.content.data?.userId === userId
      );
      
      for (const notif of wellnessNotifications) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }

      // Schedule notification for 8 PM daily
      const now = new Date();
      const reminderTime = new Date();
      reminderTime.setHours(20, 0, 0, 0); // 8:00 PM
      
      // If it's already past 8 PM today, schedule for tomorrow
      if (now.getTime() > reminderTime.getTime()) {
        reminderTime.setDate(reminderTime.getDate() + 1);
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: NotificationTemplates.wellnessReminder().title,
          body: NotificationTemplates.wellnessReminder().body,
          data: {
            type: 'wellness_reminder',
            userId
          },
          sound: 'default',
        },
        trigger: {
          date: reminderTime,
          repeats: true,
        },
      });

      // Mark as scheduled for today
      await import('@react-native-async-storage/async-storage').then(module => 
        module.default.setItem(lastScheduledKey, today)
      );

      console.log('📅 Scheduled daily wellness reminder for', reminderTime);
    } catch (error) {
      console.error('❌ Error scheduling wellness reminder:', error);
    }
  }

  /**
   * Schedule daily summary notifications (9 PM)
   */
  async scheduleDailySummary(userId: string): Promise<void> {
    try {
      const { getUserProfile } = await import('../lib/firebase');
      const userProfile = await getUserProfile(userId);
      
      if (!userProfile) return;

      // Check if already scheduled today (prevent duplicates)
      const lastScheduledKey = `daily_summary_scheduled_${userId}`;
      const lastScheduled = await import('@react-native-async-storage/async-storage').then(module => 
        module.default.getItem(lastScheduledKey)
      );
      
      const today = new Date().toDateString();
      if (lastScheduled === today) {
        console.log('📅 Daily summary already scheduled for today');
        return;
      }

      // Cancel any existing daily summary notifications first
      const existingNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const dailySummaryNotifications = existingNotifications.filter(
        notif => notif.content.data?.type === 'daily_summary' && notif.content.data?.userId === userId
      );
      
      for (const notif of dailySummaryNotifications) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }

      // Schedule notification for 9 PM daily
      const now = new Date();
      const summaryTime = new Date();
      summaryTime.setHours(21, 0, 0, 0); // 9:00 PM
      
      // If it's already past 9 PM today, schedule for tomorrow
      if (now.getTime() > summaryTime.getTime()) {
        summaryTime.setDate(summaryTime.getDate() + 1);
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📅 Daily Summary',
          body: 'Check out your daily activity and wellness summary',
          data: {
            type: 'daily_summary',
            userId
          },
          sound: 'default',
        },
        trigger: {
          date: summaryTime,
          repeats: true,
        },
      });

      // Mark as scheduled for today
      await import('@react-native-async-storage/async-storage').then(module => 
        module.default.setItem(lastScheduledKey, today)
      );

      console.log('📅 Scheduled daily summary notification for', summaryTime);
    } catch (error) {
      console.error('❌ Error scheduling daily summary:', error);
    }
  }

  /**
   * Schedule weekly summary notifications (Sunday 7 PM)
   */
  async scheduleWeeklySummary(userId: string): Promise<void> {
    try {
      const { getUserProfile } = await import('../lib/firebase');
      const userProfile = await getUserProfile(userId);
      
      if (!userProfile) return;

      // Check if already scheduled this week (prevent duplicates)
      const lastScheduledKey = `weekly_summary_scheduled_${userId}`;
      const lastScheduled = await import('@react-native-async-storage/async-storage').then(module => 
        module.default.getItem(lastScheduledKey)
      );
      
      // Get current week identifier (year + week number)
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const weekNumber = Math.ceil((((now.getTime() - startOfYear.getTime()) / 86400000) + startOfYear.getDay() + 1) / 7);
      const thisWeek = `${now.getFullYear()}-${weekNumber}`;
      
      if (lastScheduled === thisWeek) {
        console.log('📊 Weekly summary already scheduled for this week');
        return;
      }

      // Cancel any existing weekly summary notifications first
      const existingNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const weeklySummaryNotifications = existingNotifications.filter(
        notif => notif.content.data?.type === 'weekly_report' && notif.content.data?.userId === userId
      );
      
      for (const notif of weeklySummaryNotifications) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }

      // Schedule for next Sunday at 7 PM
      const weeklyTime = new Date();
      const daysUntilSunday = (7 - now.getDay()) % 7;
      
      weeklyTime.setDate(now.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));
      weeklyTime.setHours(19, 0, 0, 0); // 7:00 PM

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📊 Weekly Wellness Report',
          body: 'Your weekly wellness summary is ready',
          data: {
            type: 'weekly_report',
            userId
          },
          sound: 'default',
        },
        trigger: {
          date: weeklyTime,
          repeats: true,
        },
      });

      // Mark as scheduled for this week
      await import('@react-native-async-storage/async-storage').then(module => 
        module.default.setItem(lastScheduledKey, thisWeek)
      );

      console.log('📊 Scheduled weekly summary notification for', weeklyTime);
    } catch (error) {
      console.error('❌ Error scheduling weekly summary:', error);
    }
  }

  /**
   * Cancel all scheduled notifications for a user
   */
  async cancelScheduledNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('🗑️ Cancelled all scheduled notifications');
    } catch (error) {
      console.error('❌ Error cancelling notifications:', error);
    }
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();

// Convenience functions for different notification types
export const NotificationTemplates = {
  supportReceived: (senderName: string, message: string): Omit<NotificationData, 'userId'> => ({
    type: 'support_received',
    title: `💙 Support from ${senderName}`,
    body: message.length > 100 ? `${message.substring(0, 100)}...` : message,
    priority: 'high',
    data: { senderName }
  }),

  paymentReceived: (amount: string, senderName: string): Omit<NotificationData, 'userId'> => ({
    type: 'payment_received',
    title: `💰 Payment Received!`,
    body: `You received ${amount} from ${senderName}`,
    priority: 'high',
    data: { amount, senderName }
  }),

  wellnessReminder: (): Omit<NotificationData, 'userId'> => ({
    type: 'wellness_reminder',
    title: `🌟 Daily Check-in`,
    body: `Don't forget to log your wellness for today!`,
    priority: 'default',
  }),

  careRequest: (studentName: string, message: string): Omit<NotificationData, 'userId'> => ({
    type: 'care_request',
    title: `🆘 Care Request from ${studentName}`,
    body: message,
    priority: 'high',
    data: { studentName }
  }),

  paymentStatus: (status: string, amount: string): Omit<NotificationData, 'userId'> => ({
    type: 'payment_status',
    title: `💳 Payment ${status}`,
    body: `Your ${amount} payment has been ${status.toLowerCase()}`,
    priority: 'default',
    data: { status, amount }
  }),

  weeklyReport: (studentName: string, score: number): Omit<NotificationData, 'userId'> => ({
    type: 'weekly_report',
    title: `📊 Weekly Report: ${studentName}`,
    body: `Wellness score this week: ${score}/10`,
    priority: 'default',
    data: { studentName, score }
  }),

  dailySummary: (studentName: string, activities: number, wellnessScore?: number): Omit<NotificationData, 'userId'> => ({
    type: 'daily_summary',
    title: `📅 Daily Summary: ${studentName}`,
    body: wellnessScore 
      ? `${activities} activities today • Wellness: ${wellnessScore}/10`
      : `${activities} activities today`,
    priority: 'default',
    data: { studentName, activities, wellnessScore }
  }),

  studentWellnessLogged: (studentName: string, score: number, mood: string): Omit<NotificationData, 'userId'> => ({
    type: 'student_wellness_logged',
    title: `✅ ${studentName} logged wellness`,
    body: `Feeling ${mood} today • Score: ${score}/10`,
    priority: 'default',
    data: { studentName, score, mood }
  })
};