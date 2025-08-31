import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  ScrollView, 
  RefreshControl, 
  View, 
  Text, 
  StyleSheet,
  TouchableOpacity,
  Alert
} from 'react-native';
import { useWellnessStore } from '../../stores/wellnessStore';
import { useRewardsStore } from '../../stores/rewardsStore';
import { useAuthStore } from '../../stores/authStore';
import { StudentDashboardScreenProps } from '../../types/navigation';
import { handleAsyncError, AppError } from '../../utils/errorHandling';
import { ReceivedPaymentsSummary } from '../../components/ReceivedPaymentsSummary';
import { theme } from '../../styles/theme';
import { formatTimeAgo } from '../../utils/dateUtils';
import { commonStyles } from '../../styles/components';
import { useDataSync } from '../../hooks/useRefreshOnFocus';
import { cache, CACHE_CONFIGS, smartRefresh } from '../../utils/universalCache';
import { StatusHeader } from '../../components/StatusHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pushNotificationService, NotificationTemplates } from '../../services/pushNotificationService';

export const DashboardScreen: React.FC<StudentDashboardScreenProps<'DashboardMain'>> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { stats, todayEntry, getEntryByDate, loadEntries } = useWellnessStore();
  const { 
    activeRewards, 
    supportMessages, 
    totalEarned,
    level, 
    experience, 
    mood,
    lastSupportRequest,
    fetchActiveRewards, 
    fetchSupportMessages,
    claimReward,
    updateMood,
    markMessageRead,
    requestSupport,
    loadUserProgress
  } = useRewardsStore();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingErrors, setLoadingErrors] = useState<AppError[]>([]);

  useEffect(() => {
    loadData();
    
    // Fallback timeout to ensure loading doesn't get stuck
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 3000);
    
    return () => clearTimeout(timeout);
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    
    setLoadingErrors([]);
    
    try {
      // Smart refresh dashboard data with caching
      await smartRefresh(
        CACHE_CONFIGS.DASHBOARD_DATA,
        async () => {
          const results = await Promise.allSettled([
            handleAsyncError(() => fetchActiveRewards(), 'Loading rewards'),
            handleAsyncError(() => fetchSupportMessages(), 'Loading messages'),
            handleAsyncError(() => loadEntries(), 'Loading wellness entries'),
            handleAsyncError(() => loadUserProgress(), 'Loading user progress')
          ]);
          
          const errors: AppError[] = [];
          results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value.error) {
              errors.push(result.value.error);
            } else if (result.status === 'rejected') {
              const contexts = ['rewards', 'messages', 'wellness', 'progress'];
              errors.push({
                code: 'UNKNOWN_ERROR',
                message: 'Failed to load data',
                context: contexts[index]
              });
            }
          });
          
          if (errors.length > 0) {
            setLoadingErrors(errors);
          }
          
          // Return data for caching
          return {
            activeRewards,
            supportMessages,
            totalEarned,
            level,
            experience,
            mood,
            stats,
            todayEntry,
            lastUpdated: new Date().toISOString()
          };
        },
        (cachedDashboard) => {
            // Data is in stores, just show it's cached
        },
        (freshDashboard) => {
          },
        user.id
      );
      
    } catch (error) {
      setLoadingErrors([{
        code: 'LOAD_ERROR',
        message: 'Failed to load dashboard data',
        context: 'dashboard'
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchActiveRewards, fetchSupportMessages, loadEntries, loadUserProgress]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Auto-sync data when screen comes into focus and periodically
  // Use longer intervals to reduce load
  useDataSync(loadData, {
    refreshOnFocus: true,
    periodicRefresh: true,
    intervalMs: 60000 // Refresh every 60 seconds (reduced from 30s)
  });

  const getLevelTitle = useMemo(() => (level: number) => {
    if (level <= 5) return 'Freshman';
    if (level <= 10) return 'Sophomore';
    if (level <= 15) return 'Junior';
    if (level <= 20) return 'Senior';
    return 'Graduate';
  }, []);

  const getCategoryName = useMemo(() => (category: string) => {
    switch (category) {
      case 'sleep': return 'Sleep';
      case 'meals': return 'Nutrition';
      case 'exercise': return 'Exercise';
      case 'wellness': return 'Wellness';
      case 'streak': return 'Streak';
      default: return 'Goal';
    }
  }, []);

  const getTypeColor = useMemo(() => (type: string) => {
    switch (type) {
      case 'automatic': return theme.colors.success;
      case 'manual': return 'theme.colors.primary';
      case 'challenge': return theme.colors.warning;
      default: return theme.colors.textSecondary;
    }
  }, []);

  const getMessageType = useMemo(() => (type: string) => {
    switch (type) {
      case 'message': return 'Message';
      case 'voice': return 'Voice Note';
      case 'care_package': return 'Care Package';
      case 'video_call': return 'Video Call';
      case 'boost': return 'Boost';
      default: return 'Note';
    }
  }, []);


  const getMoodLevel = useMemo(() => {
    // Use today's entry mood if available, otherwise fallback to stored mood
    const currentMood = todayEntry?.mood || null;
    
    if (currentMood === null) return 'Not logged';
    if (currentMood >= 9) return 'Amazing';
    if (currentMood >= 7) return 'Great';
    if (currentMood >= 5) return 'Okay';
    if (currentMood >= 3) return 'Struggling';
    return 'Difficult';
  }, [todayEntry?.mood]);


  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusHeader title="Home" />
      <ScrollView
        style={[styles.scrollContainer, { paddingTop: 50 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      >
        {/* Modern Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Good morning!</Text>
          <Text style={styles.title}>{user?.name?.split(' ')[0] || 'Student'}</Text>
          <Text style={styles.pullHint}>Stay close when you're far apart</Text>
        </View>

        {/* Current Status */}
        <View style={styles.statusSection}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>
              {todayEntry 
                ? `You're feeling ${getMoodLevel.toLowerCase()}` 
                : 'Ready to start your day?'}
            </Text>
            <View style={[styles.statusBadge, { 
              backgroundColor: todayEntry ? theme.colors.success : theme.colors.warning 
            }]}>
              <Text style={styles.statusBadgeText}>
                {todayEntry ? 'LOGGED' : 'NO DATA'}
              </Text>
            </View>
          </View>
          <Text style={styles.statusSubtitle}>
            {todayEntry 
              ? `Wellness score: ${Math.round(todayEntry.wellnessScore * 10) / 10}/10 — ${todayEntry.wellnessScore >= 8 ? 'Great work!' : todayEntry.wellnessScore >= 6 ? 'Keep it up!' : 'Every step counts'}`
              : 'Track your mood, sleep, meals, and exercise to see how you\'re doing'
            }
          </Text>
          <TouchableOpacity 
            style={styles.statusAction}
            onPress={() => navigation.navigate('WellnessLog')}
          >
            <Text style={styles.statusActionText}>
              {todayEntry ? 'Update today\'s wellness' : 'Log your wellness'} →
            </Text>
          </TouchableOpacity>
        </View>

        {/* Support Messages - Priority #1 */}
        {supportMessages.length > 0 && (
          <View style={styles.messagesSection}>
            <View style={styles.messagesHeader}>
              <Text style={styles.sectionTitle}>Messages from Family</Text>
              {supportMessages.filter(m => !m.read).length > 0 && (
                <Text style={styles.newMessagesBadge}>
                  {supportMessages.filter(m => !m.read).length} new
                </Text>
              )}
            </View>
            
            {supportMessages.slice(0, 3).map((message) => (
              <TouchableOpacity 
                key={message.id} 
                style={[styles.messageCard, !message.read && styles.unreadMessage]}
                onPress={() => markMessageRead(message.id)}
              >
                <View style={styles.messageTypeContainer}>
                  <Text style={styles.messageType}>{getMessageType(message.type)}</Text>
                </View>
                <View style={styles.messageContent}>
                  <Text style={styles.messageText}>{message.content}</Text>
                  <Text style={styles.messageTime}>{formatTimeAgo(message.timestamp)}</Text>
                </View>
                {!message.read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Key Metrics */}
        <View style={styles.metricsSection}>
          <View style={styles.metricItem}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>Wellness Streak</Text>
              <Text style={styles.metricValue}>
                {stats.totalEntries === 0 ? '--' : stats.currentStreak}
              </Text>
            </View>
            <Text style={[styles.metricTag, { color: theme.colors.success }]}>
              {stats.totalEntries === 0 ? 'Start logging to build a streak!' : 'days in a row'}
            </Text>
          </View>
          
          <View style={styles.metricItem}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>Family Connection</Text>
              <Text style={styles.metricValue}>
                {supportMessages.length + Math.floor(totalEarned/5)}
              </Text>
            </View>
            <Text style={[styles.metricTag, { color: theme.colors.primary }]}>
              moments of love received
            </Text>
          </View>

          {/* Progress Display */}
          <View style={styles.budgetItem}>
            <View style={styles.budgetHeader}>
              <Text style={styles.metricLabel}>Progress Level</Text>
              <Text style={styles.budgetRemaining}>{getLevelTitle(level)} {level}</Text>
            </View>
            <View style={styles.budgetBarContainer}>
              <View style={styles.budgetBar}>
                <View 
                  style={[styles.budgetFill, { 
                    width: `${Math.max(5, ((experience % 200) / 200) * 100)}%` 
                  }]} 
                />
              </View>
              <Text style={styles.budgetText}>
                {experience % 200} / 200 XP to next level
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          {/* Primary Action */}
          <TouchableOpacity 
            style={styles.primaryAction}
            onPress={() => navigation.navigate('WellnessLog')}
          >
            <View style={styles.primaryActionContent}>
              <View style={styles.primaryActionIcon}>
                <View style={styles.primaryActionIndicator} />
              </View>
              <View style={styles.primaryActionText}>
                <Text style={styles.primaryActionTitle}>
                  {todayEntry ? 'Update Wellness Log' : 'Log Today\'s Wellness'}
                </Text>
                <Text style={styles.primaryActionSubtitle}>
                  Track your mood, sleep, meals, and exercise
                </Text>
              </View>
            </View>
          </TouchableOpacity>
          
          {/* Secondary Actions */}
          <View style={styles.secondaryActions}>
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => requestSupport()}
            >
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Request Support</Text>
                <Text style={styles.actionSubtitle}>
                  {lastSupportRequest && new Date().getTime() - lastSupportRequest.getTime() < 60 * 60 * 1000 
                    ? 'Family notified' 
                    : 'Let your family know you need help'}
                </Text>
              </View>
              <View style={styles.actionBadge}>
                <Text style={styles.actionBadgeText}>Send</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => navigation.navigate('ItemRequest')}
            >
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Request Item</Text>
                <Text style={styles.actionSubtitle}>Ask for something you need</Text>
              </View>
              <Text style={styles.actionArrow}>›</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => navigation.navigate('WellnessHistory')}
            >
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Wellness History</Text>
                <Text style={styles.actionSubtitle}>View your past entries</Text>
              </View>
              <Text style={styles.actionArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Your Activity</Text>
          
          {todayEntry && (
            <TouchableOpacity 
              style={styles.activityItem}
              onPress={() => navigation.navigate('WellnessLog')}
            >
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Today's Wellness</Text>
                <Text style={styles.activitySubtitle}>
                  Score: {Math.round(todayEntry.wellnessScore * 10) / 10}/10
                </Text>
              </View>
              <Text style={[styles.activityScore, {
                color: todayEntry.wellnessScore > 7 ? theme.colors.success : 
                       todayEntry.wellnessScore < 5 ? theme.colors.warning : theme.colors.primary
              }]}>
                {Math.round(todayEntry.wellnessScore * 10) / 10}/10
              </Text>
            </TouchableOpacity>
          )}
          
          {stats.totalEntries > 0 && (
            <TouchableOpacity 
              style={styles.activityItem}
              onPress={() => navigation.navigate('WellnessHistory')}
            >
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Wellness Summary</Text>
                <Text style={styles.activitySubtitle}>
                  {stats.totalEntries} entries • {stats.averageScore.toFixed(1)} avg score
                </Text>
              </View>
              <Text style={styles.activityAction}>View All</Text>
            </TouchableOpacity>
          )}

          {/* Care Boosts - Simplified */}
          {activeRewards.length > 0 && (
            <TouchableOpacity 
              style={styles.activityItem}
              onPress={() => claimReward(activeRewards[0].id)}
            >
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Care Boost Available</Text>
                <Text style={styles.activitySubtitle}>
                  ${activeRewards[0].amount} • {getCategoryName(activeRewards[0].category)}
                </Text>
              </View>
              <Text style={styles.activityAction}>Claim</Text>
            </TouchableOpacity>
          )}

          {/* Show helpful message if no activity */}
          {!todayEntry && stats.totalEntries === 0 && activeRewards.length === 0 && (
            <View style={styles.activityItem}>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Get started!</Text>
                <Text style={styles.activitySubtitle}>Log your wellness to begin tracking progress</Text>
              </View>
            </View>
          )}
        </View>

        {/* Received Payments Summary */}
        <ReceivedPaymentsSummary />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
  },
  header: {
    marginBottom: 30,
    paddingTop: 10,
    paddingHorizontal: 24,
  },
  greeting: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  pullHint: {
    fontSize: 13,
    color: theme.colors.textTertiary,
    marginTop: 4,
  },
  
  // Status Section - No Card
  statusSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.backgroundSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusSubtitle: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  statusAction: {
    alignSelf: 'flex-start',
  },
  statusActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },

  // Urgent Section for Messages
  urgentSection: {
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  newMessagesBadge: {
    fontSize: 12,
    color: theme.colors.backgroundSecondary,
    fontWeight: '600',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  
  // Messages Section
  messagesSection: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  messagesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  messageCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  messageTypeContainer: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  messageType: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.backgroundSecondary,
    textTransform: 'uppercase',
  },
  messageContent: {
    flex: 1,
  },
  messageText: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: 4,
    fontWeight: '500',
  },
  messageTime: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  
  // Metrics Section - Mixed Layout
  metricsSection: {
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 20,
  },
  metricItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  metricTag: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // Budget Item - Inline Style (for XP bar)
  budgetItem: {
    paddingVertical: 12,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  budgetRemaining: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.success,
  },
  budgetBarContainer: {
    gap: 6,
  },
  budgetBar: {
    height: 6,
    backgroundColor: theme.colors.backgroundTertiary,
    borderRadius: 3,
  },
  budgetFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  budgetText: {
    fontSize: 12,
    color: theme.colors.textTertiary,
  },
  
  // Actions Section
  actionsSection: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  
  // Primary Action - Prominent
  primaryAction: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryActionIcon: {
    marginRight: 16,
  },
  primaryActionIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
  },
  primaryActionText: {
    flex: 1,
  },
  primaryActionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  primaryActionSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  
  // Secondary Actions - List Style
  secondaryActions: {
    gap: 1,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 1,
  },
  actionSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  actionBadge: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.backgroundSecondary,
    textTransform: 'uppercase',
  },
  actionArrow: {
    fontSize: 18,
    color: theme.colors.textTertiary,
    fontWeight: '300',
  },
  
  // Recent Activity
  recentSection: {
    paddingHorizontal: 24,
    marginTop: 24,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  activityScore: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 1,
  },
  activitySubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  activityAction: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  activityTime: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    minWidth: 50,
    textAlign: 'right',
  },
  unreadMessage: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    marginLeft: 8,
  },
}); 