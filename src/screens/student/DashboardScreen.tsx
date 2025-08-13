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
import { useDataSync } from '../../hooks/useRefreshOnFocus';
import { cache, CACHE_CONFIGS, smartRefresh } from '../../utils/universalCache';

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
    if (!user) return;
    
    setLoadingErrors([]);
    
    try {
      // Smart refresh dashboard data with caching
      await smartRefresh(
        CACHE_CONFIGS.DASHBOARD_DATA,
        async () => {
          console.log('🔄 Loading student dashboard data...');
          const results = await Promise.allSettled([
            handleAsyncError(() => fetchActiveRewards(), 'Loading rewards'),
            handleAsyncError(() => fetchSupportMessages(), 'Loading messages'),
            handleAsyncError(() => getEntryByDate(new Date().toISOString().split('T')[0]), 'Loading wellness entry')
          ]);
          
          const errors: AppError[] = [];
          results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value.error) {
              errors.push(result.value.error);
            } else if (result.status === 'rejected') {
              const contexts = ['rewards', 'messages', 'wellness'];
              errors.push({
                code: 'UNKNOWN_ERROR',
                message: 'Failed to load data',
                context: contexts[index]
              });
            }
          });
          
          if (errors.length > 0) {
            setLoadingErrors(errors);
            console.warn('Some data failed to load:', errors);
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
          console.log('📦 Using cached student dashboard data');
          // Data is in stores, just show it's cached
        },
        (freshDashboard) => {
          console.log('✅ Updated with fresh student dashboard data');
        },
        user.id
      );
      
    } catch (error) {
      console.error('Error loading student dashboard:', error);
      setLoadingErrors([{
        code: 'LOAD_ERROR',
        message: 'Failed to load dashboard data',
        context: 'dashboard'
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchActiveRewards, fetchSupportMessages]);

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
      case 'automatic': return '#10b981';
      case 'manual': return 'theme.colors.primary';
      case 'challenge': return '#f59e0b';
      default: return '#6b7280';
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

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

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
      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Good morning, {user?.name || 'Student'}!</Text>
            <Text style={styles.subtitle}>Stay close when you're far apart</Text>
          </View>
        </View>

      {/* Support Messages - Now Priority #1 */}
      {supportMessages.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
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

      {/* Family Connection Card */}
      <View style={styles.connectionCard}>
        <Text style={styles.connectionTitle}>Family Love</Text>
        <View style={styles.connectionStats}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{supportMessages.filter(m => !m.read).length}</Text>
            <Text style={styles.statLabel}>New Messages</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{supportMessages.length}</Text>
            <Text style={styles.statLabel}>Care Moments</Text>
          </View>
          <TouchableOpacity 
            style={styles.stat}
            onPress={() => navigation.navigate('WellnessLog')}
          >
            <Text style={styles.statNumber}>{getMoodLevel}</Text>
            <Text style={styles.statLabel}>How You Feel</Text>
            <Text style={styles.statHint}>Tap to update</Text>
          </TouchableOpacity>
        </View>
        
        {/* I Need Support Button */}
        <TouchableOpacity 
          style={[
            styles.supportButton,
            lastSupportRequest && new Date().getTime() - lastSupportRequest.getTime() < 60 * 60 * 1000 
              ? styles.supportButtonSent 
              : null
          ]}
          onPress={() => {
            requestSupport();
          }}
          disabled={lastSupportRequest && new Date().getTime() - lastSupportRequest.getTime() < 60 * 60 * 1000}
        >
          <Text style={[
            styles.supportButtonText,
            lastSupportRequest && new Date().getTime() - lastSupportRequest.getTime() < 60 * 60 * 1000 
              ? styles.supportButtonTextSent 
              : null
          ]}>
            {lastSupportRequest && new Date().getTime() - lastSupportRequest.getTime() < 60 * 60 * 1000 
              ? 'Support request sent! ✓' 
              : 'I need support 💙'}
          </Text>
          <Text style={styles.supportButtonSubtext}>
            {lastSupportRequest && new Date().getTime() - lastSupportRequest.getTime() < 60 * 60 * 1000 
              ? 'Your family has been notified and will reach out soon' 
              : 'Let your family know you could use some help'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Level & Experience */}
      <View style={styles.levelCard}>
        <View style={styles.levelHeader}>
          <Text style={styles.levelTitle}>{getLevelTitle(level)}</Text>
          <Text style={styles.levelNumber}>Level {level}</Text>
        </View>
        <View style={styles.experienceBar}>
          <View 
            style={[
              styles.experienceFill, 
              { width: `${((experience % 200) / 200) * 100}%` }
            ]} 
          />
        </View>
        <Text style={styles.experienceText}>{experience % 200} / 200 XP</Text>
        <Text style={styles.totalEarned}>Family Love: {supportMessages.length + Math.floor(totalEarned/5)} moments</Text>
      </View>

      {/* Wellness Score */}
      <TouchableOpacity 
        style={styles.scoreCard}
        onPress={() => navigation.navigate('WellnessLog')}
      >
        <Text style={styles.scoreTitle}>Today's Wellness Score</Text>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreValue}>
            {todayEntry ? Math.round(todayEntry.wellnessScore * 10) / 10 : '--'}
          </Text>
          <Text style={styles.scoreMax}>/ 10</Text>
        </View>
        <Text style={styles.scoreMessage}>
          {todayEntry ? 
            (todayEntry.wellnessScore >= 8 ? 'Excellent progress!' : 
             todayEntry.wellnessScore >= 6 ? 'Good work!' : 'Keep going!') :
            'Tap to log your wellness today'}
        </Text>
      </TouchableOpacity>

      {/* Wellness Actions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Wellness Tracking</Text>
          <TouchableOpacity onPress={() => navigation.navigate('WellnessHistory')}>
            <Text style={styles.viewAllText}>View History</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={styles.wellnessActionCard}
          onPress={() => navigation.navigate('WellnessLog')}
        >
          <Text style={styles.wellnessActionTitle}>
            {todayEntry ? 'Update Today\'s Log' : 'Log Today\'s Wellness'}
          </Text>
          <Text style={styles.wellnessActionSubtitle}>
            {todayEntry ? 'Update your daily wellness entry' : 'Start tracking your daily wellness'}
          </Text>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {stats.totalEntries === 0 ? '--' : stats.currentStreak}
            </Text>
            <Text style={styles.statLabel}>
              {stats.totalEntries === 0 ? 'Start Logging' : 'Day Streak'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {stats.totalEntries === 0 ? '--' : stats.averageScore.toFixed(1)}
            </Text>
            <Text style={styles.statLabel}>
              {stats.totalEntries === 0 ? 'To See Score' : 'Avg Score'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalEntries}</Text>
            <Text style={styles.statLabel}>Total Entries</Text>
          </View>
        </View>
      </View>

      {/* Care Boosts - De-emphasized, moved to bottom */}
      {activeRewards.length > 0 && (
        <View style={styles.section}>
          <View style={styles.rewardsHeader}>
            <Text style={styles.smallSectionTitle}>Occasional Care Boosts</Text>
            <View style={styles.rewardsTotalContainer}>
              <Text style={styles.rewardsSmallTotal}>
                {activeRewards.length}
              </Text>
              <Text style={styles.rewardsTotalLabel}>available</Text>
            </View>
          </View>
          <Text style={styles.rewardsSubtext}>
            Small surprises from family when you're doing great ✨
          </Text>
          
          {activeRewards.map((reward) => (
            <TouchableOpacity 
              key={reward.id} 
              style={styles.smallRewardCard}
              onPress={() => claimReward(reward.id)}
            >
              <View style={styles.rewardHeader}>
                <View style={styles.rewardInfo}>
                  <View style={styles.rewardCategoryContainer}>
                    <Text style={styles.rewardCategory}>{getCategoryName(reward.category)}</Text>
                  </View>
                  <View style={styles.rewardText}>
                    <Text style={styles.smallRewardTitle}>{reward.title}</Text>
                    <Text style={styles.smallRewardDescription}>{reward.description}</Text>
                  </View>
                </View>
                <View style={styles.rewardAmount}>
                  <Text style={styles.smallAmountText}>${reward.amount}</Text>
                  <View style={[styles.typeBadge, { backgroundColor: getTypeColor(reward.type) }]}>
                    <Text style={styles.typeText}>{reward.type}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.rewardProgress}>
                <Text style={styles.progressText}>
                  Progress: {reward.progress}/{reward.maxProgress}
                </Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${(reward.progress / reward.maxProgress) * 100}%` }
                    ]} 
                  />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Received Payments */}
      <ReceivedPayments />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'theme.colors.background',
  },
  scrollContainer: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'theme.colors.background',
  },
  loadingText: {
    color: 'theme.colors.textPrimary',
    fontSize: 16,
  },
  header: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: 'theme.colors.textPrimary',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: 'theme.colors.textSecondary',
    marginTop: 6,
  },
  connectionCard: {
    backgroundColor: 'theme.colors.backgroundSecondary',
    margin: 20,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'theme.colors.border',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  connectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'theme.colors.textPrimary',
    marginBottom: 20,
  },
  connectionStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: 'theme.colors.textPrimary',
  },
  statLabel: {
    fontSize: 12,
    color: 'theme.colors.textSecondary',
    marginTop: 6,
    fontWeight: '500',
  },
  statHint: {
    fontSize: 10,
    color: 'theme.colors.primary',
    marginTop: 2,
    fontWeight: '600',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: 'theme.colors.textPrimary',
    marginBottom: 16,
  },
  messageCard: {
    backgroundColor: 'theme.colors.backgroundSecondary',
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'theme.colors.border',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  unreadMessage: {
    borderLeftWidth: 4,
    borderLeftColor: 'theme.colors.primary',
  },
  messageTypeContainer: {
    backgroundColor: 'theme.colors.primary',
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
    color: 'white',
    textTransform: 'uppercase',
  },
  messageContent: {
    flex: 1,
  },
  messageText: {
    fontSize: 14,
    color: 'theme.colors.textPrimary',
    marginBottom: 4,
    fontWeight: '500',
  },
  messageTime: {
    fontSize: 12,
    color: 'theme.colors.textSecondary',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'theme.colors.primary',
  },
  levelCard: {
    backgroundColor: 'theme.colors.backgroundSecondary',
    margin: 20,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'theme.colors.border',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  levelTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'theme.colors.textPrimary',
  },
  levelNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: 'theme.colors.textSecondary',
  },
  experienceBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    marginBottom: 8,
  },
  experienceFill: {
    height: '100%',
    backgroundColor: 'theme.colors.primary',
    borderRadius: 4,
  },
  experienceText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    fontWeight: '500',
  },
  totalEarned: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4ade80',
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 0.5,
  },
  scoreCard: {
    backgroundColor: 'theme.colors.backgroundSecondary',
    margin: 20,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'theme.colors.border',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  scoreTitle: {
    fontSize: 16,
    color: 'theme.colors.textSecondary',
    marginBottom: 12,
    fontWeight: '500',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#10b981',
  },
  scoreMax: {
    fontSize: 20,
    color: 'theme.colors.textSecondary',
    fontWeight: '500',
    marginLeft: 4,
  },
  scoreMessage: {
    fontSize: 16,
    color: 'theme.colors.primary',
    marginTop: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: 'theme.colors.backgroundSecondary',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'theme.colors.border',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'theme.colors.textSecondary',
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'theme.colors.textPrimary',
    marginTop: 4,
  },
  cardStreak: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 4,
  },
  rewardsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rewardsTotalContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  rewardsTotal: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '700',
  },
  rewardsTotalLabel: {
    fontSize: 12,
    color: 'theme.colors.textSecondary',
    marginLeft: 4,
    fontWeight: '500',
  },
  rewardCard: {
    backgroundColor: 'theme.colors.backgroundSecondary',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'theme.colors.border',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  rewardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  rewardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rewardCategoryContainer: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  rewardCategory: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
    textTransform: 'uppercase',
  },
  rewardText: {
    flex: 1,
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'theme.colors.backgroundSecondary',
  },
  rewardDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  rewardAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  typeText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  rewardProgress: {
    marginTop: 8,
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'theme.colors.primary',
    borderRadius: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 14,
    color: 'theme.colors.primary',
    fontWeight: '600',
  },
  wellnessActionCard: {
    backgroundColor: 'theme.colors.backgroundSecondary',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'theme.colors.border',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  wellnessActionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: 'theme.colors.textPrimary',
    marginBottom: 6,
  },
  wellnessActionSubtitle: {
    fontSize: 14,
    color: 'theme.colors.textSecondary',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: 'theme.colors.backgroundSecondary',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'theme.colors.border',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  newMessagesBadge: {
    fontSize: 12,
    color: 'theme.colors.primary',
    fontWeight: '600',
    backgroundColor: '#1e1b4b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  smallSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'theme.colors.textSecondary',
    marginBottom: 8,
  },
  rewardsSmallTotal: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  rewardsSubtext: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  smallRewardCard: {
    backgroundColor: 'theme.colors.backgroundSecondary',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'theme.colors.border',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  smallRewardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'theme.colors.textPrimary',
  },
  smallRewardDescription: {
    fontSize: 12,
    color: 'theme.colors.textSecondary',
    marginTop: 2,
  },
  smallAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 4,
  },
  supportButton: {
    backgroundColor: '#2563eb',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  supportButtonSent: {
    backgroundColor: '#059669',
  },
  supportButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  supportButtonTextSent: {
    color: '#ffffff',
  },
  supportButtonSubtext: {
    fontSize: 12,
    color: '#dbeafe',
    textAlign: 'center',
  },
}); 