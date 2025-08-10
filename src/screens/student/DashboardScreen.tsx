import React, { useEffect, useState } from 'react';
import { 
  ScrollView, 
  RefreshControl, 
  View, 
  Text, 
  StyleSheet,
  TouchableOpacity 
} from 'react-native';
import { useWellnessStore } from '../../stores/wellnessStore';
import { useRewardsStore } from '../../stores/rewardsStore';
import { useTheme } from '../../contexts/ThemeContext';
import { Theme } from '../../constants/themes';

interface DashboardScreenProps {
  navigation: any;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const { stats, todayEntry, getEntryByDate } = useWellnessStore();
  const { 
    activeRewards, 
    supportMessages, 
    totalEarned, 
    monthlyEarned, 
    level, 
    experience, 
    mood,
    fetchActiveRewards, 
    fetchSupportMessages,
    claimReward,
    updateMood,
    markMessageRead 
  } = useRewardsStore();
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([
        fetchActiveRewards(),
        fetchSupportMessages(),
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getLevelTitle = (level: number) => {
    if (level <= 5) return 'Freshman';
    if (level <= 10) return 'Sophomore';
    if (level <= 15) return 'Junior';
    if (level <= 20) return 'Senior';
    return 'Graduate';
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'sleep': return '😴';
      case 'meals': return '🍽️';
      case 'exercise': return '💪';
      case 'wellness': return '🌟';
      case 'streak': return '🔥';
      default: return '🎯';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'automatic': return '#10b981';
      case 'manual': return '#6366f1';
      case 'challenge': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'message': return '💬';
      case 'voice': return '🎵';
      case 'care_package': return '🎁';
      case 'video_call': return '📞';
      case 'boost': return '💰';
      default: return '💌';
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

  const getMoodEmoji = (mood: string | null) => {
    switch (mood) {
      case 'great': return '😊';
      case 'good': return '🙂';
      case 'okay': return '😐';
      case 'struggling': return '😔';
      default: return '🤔';
    }
  };

  const styles = createStyles(theme);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Good morning, Sarah! 👋</Text>
        <Text style={styles.subtitle}>Your family is thinking of you</Text>
      </View>

      {/* Family Connection Card */}
      <View style={styles.connectionCard}>
        <Text style={styles.connectionTitle}>Family Connection</Text>
        <View style={styles.connectionStats}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{supportMessages.filter(m => !m.read).length}</Text>
            <Text style={styles.statLabel}>New Messages</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>${monthlyEarned}</Text>
            <Text style={styles.statLabel}>This Month</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{getMoodEmoji(mood)}</Text>
            <Text style={styles.statLabel}>Your Mood</Text>
          </View>
        </View>
      </View>

      {/* Support Messages */}
      {supportMessages.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Family Support</Text>
          {supportMessages.slice(0, 3).map((message) => (
            <TouchableOpacity 
              key={message.id} 
              style={[styles.messageCard, !message.read && styles.unreadMessage]}
              onPress={() => markMessageRead(message.id)}
            >
              <Text style={styles.messageIcon}>{getMessageIcon(message.type)}</Text>
              <View style={styles.messageContent}>
                <Text style={styles.messageText}>{message.content}</Text>
                <Text style={styles.messageTime}>{formatTimeAgo(message.timestamp)}</Text>
              </View>
              {!message.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

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
        <Text style={styles.totalEarned}>Total Support: ${totalEarned}</Text>
      </View>

      {/* Wellness Score */}
      <TouchableOpacity 
        style={styles.scoreCard}
        onPress={() => navigation.navigate('WellnessLog')}
      >
        <Text style={styles.scoreTitle}>Today's Wellness</Text>
        <Text style={styles.scoreValue}>
          {todayEntry ? Math.round(todayEntry.wellnessScore * 10) / 10 : '--'}
        </Text>
        <Text style={styles.scoreMax}>/ 10</Text>
        <Text style={styles.scoreMessage}>
          {todayEntry ? 
            (todayEntry.wellnessScore >= 8 ? 'Feeling great!' : 
             todayEntry.wellnessScore >= 6 ? 'Doing well!' : 'Hang in there!') :
            'Log your wellness today!'}
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
            {todayEntry ? '📝 Update Today\'s Log' : '📝 Log Today\'s Wellness'}
          </Text>
          <Text style={styles.wellnessActionSubtitle}>
            {todayEntry ? 'Update your daily wellness entry' : 'Start tracking your daily wellness'}
          </Text>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.currentStreak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.averageScore}</Text>
            <Text style={styles.statLabel}>Avg Score</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalEntries}</Text>
            <Text style={styles.statLabel}>Total Entries</Text>
          </View>
        </View>
      </View>

      {/* Available Rewards */}
      {activeRewards.length > 0 && (
        <View style={styles.section}>
          <View style={styles.rewardsHeader}>
            <Text style={styles.sectionTitle}>Available Support</Text>
            <Text style={styles.rewardsTotal}>
              ${activeRewards.reduce((sum, r) => sum + r.amount, 0)} possible
            </Text>
          </View>
          
          {activeRewards.map((reward) => (
            <TouchableOpacity 
              key={reward.id} 
              style={styles.rewardCard}
              onPress={() => claimReward(reward.id)}
            >
              <View style={styles.rewardHeader}>
                <View style={styles.rewardInfo}>
                  <Text style={styles.rewardIcon}>{getCategoryIcon(reward.category)}</Text>
                  <View style={styles.rewardText}>
                    <Text style={styles.rewardTitle}>{reward.title}</Text>
                    <Text style={styles.rewardDescription}>{reward.description}</Text>
                  </View>
                </View>
                <View style={styles.rewardAmount}>
                  <Text style={styles.amountText}>${reward.amount}</Text>
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
    </ScrollView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    color: theme.colors.textSecondary,
  },
  header: {
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  connectionCard: {
    backgroundColor: theme.colors.card,
    margin: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  connectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 16,
  },
  connectionStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 12,
  },
  messageCard: {
    backgroundColor: theme.colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadMessage: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  messageIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  messageContent: {
    flex: 1,
  },
  messageText: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  levelCard: {
    backgroundColor: theme.colors.card,
    margin: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  levelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  levelNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  experienceBar: {
    height: 8,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    marginBottom: 8,
  },
  experienceFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  experienceText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  totalEarned: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.success,
    textAlign: 'center',
    marginTop: 8,
  },
  scoreCard: {
    backgroundColor: theme.colors.card,
    margin: 20,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scoreTitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: theme.colors.success,
  },
  scoreMax: {
    fontSize: 18,
    color: theme.colors.textSecondary,
  },
  scoreMessage: {
    fontSize: 16,
    color: theme.colors.primary,
    marginTop: 8,
    fontWeight: '600',
  },
  card: {
    backgroundColor: theme.colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: 4,
  },
  cardStreak: {
    fontSize: 12,
    color: theme.colors.warning,
    marginTop: 4,
  },
  rewardsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rewardsTotal: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  rewardCard: {
    backgroundColor: theme.colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  rewardIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  rewardText: {
    flex: 1,
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  rewardDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  rewardAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.success,
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
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
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
    color: theme.colors.primary,
    fontWeight: '600',
  },
  wellnessActionCard: {
    backgroundColor: theme.colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  wellnessActionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  wellnessActionSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: theme.colors.card,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
}); 