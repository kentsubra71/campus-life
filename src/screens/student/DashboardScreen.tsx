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
import { ReceivedPayments } from '../../components/ReceivedPayments';
import { theme } from '../../styles/theme';
import { commonStyles } from '../../styles/components';

export const DashboardScreen: React.FC<StudentDashboardScreenProps<'DashboardMain'>> = ({ navigation }) => {
  const { stats, todayEntry, getEntryByDate } = useWellnessStore();
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
    requestSupport
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
    setLoadingErrors([]);
    
    const results = await Promise.allSettled([
      handleAsyncError(() => fetchActiveRewards(), 'Loading rewards'),
      handleAsyncError(() => fetchSupportMessages(), 'Loading messages')
    ]);
    
    const errors: AppError[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.error) {
        errors.push(result.value.error);
      } else if (result.status === 'rejected') {
        errors.push({
          code: 'UNKNOWN_ERROR',
          message: 'Failed to load data',
          context: index === 0 ? 'rewards' : 'messages'
        });
      }
    });
    
    if (errors.length > 0) {
      setLoadingErrors(errors);
      console.warn('Some data failed to load:', errors);
    }
    
    setIsLoading(false);
  }, [fetchActiveRewards, fetchSupportMessages]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

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
      case 'social': return 'Social';
      case 'stress': return 'Stress';
      case 'wellness': return 'Wellness';
      default: return 'Other';
    }
  }, []);

  const formatTimeAgo = (timestamp: any) => {
    const now = new Date().getTime();
    const time = new Date(timestamp.seconds * 1000).getTime();
    const diffInHours = (now - time) / (1000 * 60 * 60);
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  const getMoodLevel = useMemo(() => {
    if (!todayEntry) return 'Unknown';
    const score = todayEntry.wellnessScore;
    if (score >= 8) return 'Great';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Okay';
    return 'Struggling';
  }, [todayEntry]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const wellnessScore = todayEntry?.wellnessScore;
  const unreadCount = supportMessages.filter(m => !m.read).length;
  const hasRecentSupport = lastSupportRequest && new Date().getTime() - lastSupportRequest.getTime() < 60 * 60 * 1000;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Modern Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Hi there!</Text>
          <Text style={styles.title}>
            {user?.name?.split(' ')[0] || 'Student'}
          </Text>
          <Text style={styles.pullHint}>Pull down to refresh</Text>
        </View>

        {/* Status Section */}
        <View style={styles.statusSection}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>
              You're feeling {getMoodLevel.toLowerCase()}
            </Text>
            {wellnessScore && (
              <View style={[styles.statusBadge, { 
                backgroundColor: wellnessScore >= 8 ? theme.colors.success : 
                                 wellnessScore >= 6 ? theme.colors.warning : theme.colors.error 
              }]}>
                <Text style={styles.statusBadgeText}>
                  {wellnessScore >= 8 ? 'Great' : wellnessScore >= 6 ? 'Good' : 'Needs Care'}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.statusSubtitle}>
            {wellnessScore 
              ? `Wellness score: ${wellnessScore}/10 today`
              : 'Tap below to log your wellness today'}
          </Text>
          <TouchableOpacity 
            style={styles.statusAction}
            onPress={() => navigation.navigate('WellnessLog')}
          >
            <Text style={styles.statusActionText}>
              {wellnessScore ? 'Update wellness →' : 'Log wellness →'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Messages from Family */}
        {supportMessages.length > 0 && (
          <View style={styles.messagesSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Messages from Family</Text>
              {unreadCount > 0 && (
                <View style={styles.messageBadge}>
                  <Text style={styles.messageBadgeText}>{unreadCount} new</Text>
                </View>
              )}
            </View>
            {supportMessages.slice(0, 3).map((message) => (
              <TouchableOpacity 
                key={message.id} 
                style={styles.messageItem}
                onPress={() => markMessageRead(message.id)}
              >
                <View style={styles.messageContent}>
                  <Text style={styles.messageText}>{message.content}</Text>
                  <Text style={styles.messageTime}>{formatTimeAgo(message.timestamp)}</Text>
                </View>
                {!message.read && <View style={styles.unreadIndicator} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          {/* Primary Action - Need Support */}
          <TouchableOpacity 
            style={[styles.primaryAction, hasRecentSupport && styles.primaryActionSent]}
            onPress={() => requestSupport()}
            disabled={hasRecentSupport}
          >
            <View style={styles.primaryActionContent}>
              <View style={[styles.primaryActionIndicator, hasRecentSupport && styles.primaryActionIndicatorSent]} />
              <View style={styles.primaryActionText}>
                <Text style={styles.primaryActionTitle}>
                  {hasRecentSupport ? 'Support request sent' : 'I need support'}
                </Text>
                <Text style={styles.primaryActionSubtitle}>
                  {hasRecentSupport 
                    ? 'Your family has been notified'
                    : 'Let your family know you need help'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
          
          {/* Secondary Actions */}
          <TouchableOpacity 
            style={styles.actionItem}
            onPress={() => navigation.navigate('WellnessLog')}
          >
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Log Wellness</Text>
              <Text style={styles.actionSubtitle}>Track your daily wellness</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionItem}
            onPress={() => navigation.navigate('WellnessHistory')}
          >
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Wellness History</Text>
              <Text style={styles.actionSubtitle}>View your progress</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Progress Metrics */}
        <View style={styles.progressSection}>
          <View style={styles.progressContainer}>
            <Text style={styles.sectionTitle}>Your Progress</Text>
            
            {/* Streak Card */}
            <View style={styles.progressCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Current Streak</Text>
                <View style={styles.streakBadge}>
                  <Text style={styles.streakBadgeText}>
                    {stats.totalEntries === 0 ? '0' : stats.currentStreak} days
                  </Text>
                </View>
              </View>
              <Text style={styles.cardSubtitle}>
                {stats.totalEntries === 0 ? 'Start your wellness journey' : 'Keep up the great work!'}
              </Text>
            </View>
            
            {/* Score & Level Row */}
            <View style={styles.progressRow}>
              <View style={styles.progressCard}>
                <Text style={styles.cardTitle}>Average Score</Text>
                <Text style={styles.scoreValue}>
                  {stats.totalEntries === 0 ? '--' : stats.averageScore.toFixed(1)}
                </Text>
                <Text style={styles.scoreLabel}>out of 10</Text>
              </View>
              
              <View style={styles.progressCard}>
                <Text style={styles.cardTitle}>Level</Text>
                <Text style={styles.levelValue}>{getLevelTitle(level)}</Text>
                <View style={styles.levelProgressBar}>
                  <View 
                    style={[styles.levelProgressFill, { 
                      width: `${((experience % 200) / 200) * 100}%` 
                    }]} 
                  />
                </View>
                <Text style={styles.levelProgressText}>
                  {experience % 200} / 200 XP
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Care Boosts */}
        {activeRewards.length > 0 && (
          <View style={styles.rewardsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Care Boosts</Text>
              <View style={styles.rewardsBadge}>
                <Text style={styles.rewardsBadgeText}>{activeRewards.length}</Text>
              </View>
            </View>
            <Text style={styles.rewardsSubtext}>
              Small surprises from family when you're doing great
            </Text>
            
            {activeRewards.map((reward) => (
              <TouchableOpacity 
                key={reward.id} 
                style={styles.rewardItem}
                onPress={() => claimReward(reward.id)}
              >
                <View style={styles.rewardContent}>
                  <View style={styles.rewardCategoryTag}>
                    <Text style={styles.rewardCategoryText}>{getCategoryName(reward.category)}</Text>
                  </View>
                  <Text style={styles.rewardTitle}>{reward.title}</Text>
                  <Text style={styles.rewardDescription}>{reward.description}</Text>
                  <View style={styles.rewardProgress}>
                    <Text style={styles.rewardProgressText}>
                      Progress: {reward.progress}/{reward.maxProgress}
                    </Text>
                    <View style={styles.rewardProgressBar}>
                      <View 
                        style={[styles.rewardProgressFill, { 
                          width: `${(reward.progress / reward.maxProgress) * 100}%` 
                        }]} 
                      />
                    </View>
                  </View>
                </View>
                <View style={styles.rewardAmount}>
                  <Text style={styles.rewardAmountText}>${reward.amount}</Text>
                  <View style={styles.rewardTypeBadge}>
                    <Text style={styles.rewardTypeText}>{reward.type}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Section Divider */}
        <View style={styles.sectionDivider} />
        
        {/* Received Payments */}
        <ReceivedPayments />
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
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  
  // Modern Header (like parent dashboard)
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    letterSpacing: -1,
    marginTop: 4,
  },
  pullHint: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    marginTop: 4,
    fontWeight: '500',
  },

  // Status Section (no card, clean layout like parent)
  statusSection: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    marginBottom: 8,
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
    color: '#ffffff',
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

  // Messages Section
  messagesSection: {
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  messageBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  messageBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  messageContent: {
    flex: 1,
  },
  messageText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 1,
  },
  messageTime: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },

  // Actions Section
  actionsSection: {
    paddingHorizontal: 24,
    marginTop: 4,
    marginBottom: 8,
  },
  
  // Primary Action - Need Support (like parent dashboard)
  primaryAction: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.small,
  },
  primaryActionSent: {
    borderColor: theme.colors.success,
    opacity: 0.8,
  },
  primaryActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryActionIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.error,
    marginRight: 16,
  },
  primaryActionIndicatorSent: {
    backgroundColor: theme.colors.success,
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

  // Action Items - Clean list style
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
  actionArrow: {
    fontSize: 18,
    color: theme.colors.textTertiary,
    fontWeight: '300',
  },

  // Progress Section - Better visual hierarchy
  progressSection: {
    marginTop: 24,
    marginBottom: 32,
  },
  progressContainer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 16,
    marginHorizontal: 16,
    ...theme.shadows.small,
  },
  progressCard: {
    backgroundColor: theme.colors.backgroundTertiary,
    borderRadius: 12,
    padding: 16,
    flex: 1,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  cardSubtitle: {
    fontSize: 13,
    color: theme.colors.textTertiary,
    fontStyle: 'italic',
  },
  streakBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  streakBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.primary,
    marginTop: 4,
  },
  scoreLabel: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    marginTop: 2,
  },
  levelValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginTop: 4,
  },
  
  // Level Progress Bar
  levelProgressBar: {
    height: 6,
    backgroundColor: theme.colors.backgroundTertiary,
    borderRadius: 3,
    marginVertical: 8,
  },
  levelProgressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  levelProgressText: {
    fontSize: 10,
    color: theme.colors.textTertiary,
    marginTop: 4,
  },

  // Section Divider
  sectionDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: 24,
    marginVertical: 24,
  },

  // Rewards Section
  rewardsSection: {
    paddingHorizontal: 24,
    marginTop: 24,
  },
  rewardsBadge: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rewardsBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  rewardsSubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rewardContent: {
    flex: 1,
  },
  rewardCategoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  rewardCategoryText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.primaryDark,
    textTransform: 'uppercase',
  },
  rewardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  rewardDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  rewardProgress: {
    gap: 4,
  },
  rewardProgressText: {
    fontSize: 12,
    color: theme.colors.textTertiary,
  },
  rewardProgressBar: {
    height: 4,
    backgroundColor: theme.colors.backgroundTertiary,
    borderRadius: 2,
  },
  rewardProgressFill: {
    height: '100%',
    backgroundColor: theme.colors.success,
    borderRadius: 2,
  },
  rewardAmount: {
    alignItems: 'flex-end',
    gap: 4,
  },
  rewardAmountText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  rewardTypeBadge: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rewardTypeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
});