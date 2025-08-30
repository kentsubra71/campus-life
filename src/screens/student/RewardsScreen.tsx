import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRewardsStore } from '../../stores/rewardsStore';
import { showMessage } from 'react-native-flash-message';
import { theme } from '../../styles/theme';

interface RewardsScreenProps {
  navigation: any;
}

export const RewardsScreen: React.FC<RewardsScreenProps> = ({ navigation }) => {
  const {
    activeRewards,
    supportMessages,
    totalEarned,
    monthlyEarned,
    level,
    experience,
    fetchActiveRewards,
    fetchSupportMessages,
    claimReward,
    markMessageRead,
  } = useRewardsStore();

  const [refreshing, setRefreshing] = useState(false);
  const [expandedReward, setExpandedReward] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await fetchActiveRewards();
    await fetchSupportMessages();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleClaimReward = async (rewardId: string) => {
    const reward = activeRewards.find(r => r.id === rewardId);
    if (reward) {
      if (monthlyEarned + reward.amount > 50) {
        showMessage({
          message: 'Monthly Limit Reached',
          description: 'You\'ve reached your $50 monthly limit. Great job!',
          type: 'info',
          backgroundColor: theme.colors.backgroundCard,
          color: theme.colors.textPrimary,
        });
        return;
      }

      if (reward.progress >= reward.maxProgress) {
        await claimReward(rewardId);
        showMessage({
          message: 'Reward Claimed!',
          description: `You earned $${reward.amount}! Keep up the great work.`,
          type: 'success',
          backgroundColor: theme.colors.backgroundCard,
          color: theme.colors.textPrimary,
        });
      }
    }
  };

  const renderProgressBar = (progress: number, maxProgress: number) => {
    const percentage = Math.min((progress / maxProgress) * 100, 100);
    return (
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${percentage}%` }]} />
        </View>
        <Text style={styles.progressText}>{progress}/{maxProgress}</Text>
      </View>
    );
  };

  const renderRewardCard = (reward: any) => {
    const isCompleted = reward.progress >= reward.maxProgress;
    const isExpanded = expandedReward === reward.id;

    return (
      <TouchableOpacity
        key={reward.id}
        style={[
          styles.rewardCard,
          isCompleted && styles.completedRewardCard,
        ]}
        onPress={() => setExpandedReward(isExpanded ? null : reward.id)}
        activeOpacity={0.8}
      >
        <View style={styles.rewardHeader}>
          <View style={styles.rewardInfo}>
            <Text style={styles.rewardTitle}>{reward.title}</Text>
            <Text style={styles.rewardDescription}>{reward.description}</Text>
          </View>
          <View style={styles.rewardValue}>
            <Text style={styles.rewardAmount}>${reward.amount}</Text>
            <View style={[
              styles.categoryBadge,
              { backgroundColor: getCategoryColor(reward.category) }
            ]}>
              <Text style={styles.categoryText}>{reward.category.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {renderProgressBar(reward.progress, reward.maxProgress)}

        {isCompleted && (
          <TouchableOpacity
            style={styles.claimButton}
            onPress={() => handleClaimReward(reward.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.claimButtonText}>Claim Reward</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      sleep: theme.colors.primary,
      meals: theme.colors.success,
      exercise: theme.colors.warning,
      wellness: theme.colors.primary,
      streak: theme.colors.error,
    };
    return colors[category as keyof typeof colors] || theme.colors.textSecondary;
  };

  const renderSupportMessage = (message: any) => {
    const getMessageIcon = (type: string) => {
      switch (type) {
        case 'message': return 'M';
        case 'voice': return 'V';
        case 'care_package': return 'P';
        case 'video_call': return 'C';
        case 'boost': return 'B';
        default: return 'M';
      }
    };

    return (
      <TouchableOpacity
        key={message.id}
        style={[
          styles.messageCard,
          !message.read && styles.unreadMessage
        ]}
        onPress={() => !message.read && markMessageRead(message.id)}
        activeOpacity={0.8}
      >
        <View style={styles.messageHeader}>
          <View style={[
            styles.messageIcon,
            { backgroundColor: !message.read ? theme.colors.primary : theme.colors.backgroundTertiary }
          ]}>
            <Text style={styles.messageIconText}>
              {getMessageIcon(message.type)}
            </Text>
          </View>
          <View style={styles.messageContent}>
            <Text style={styles.messageText}>{message.content}</Text>
            <Text style={styles.messageTime}>
              {new Date(message.timestamp).toLocaleDateString()} at {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          {!message.read && <View style={styles.unreadDot} />}
        </View>
      </TouchableOpacity>
    );
  };

  const experienceProgress = (experience % 200) / 200 * 100;
  const nextLevelExp = (level * 200) - experience;
  const unreadCount = supportMessages.filter(msg => !msg.read).length;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Rewards & Family Support</Text>
          <Text style={styles.subtitle}>Track your progress and stay connected</Text>
        </View>

        {/* Stats Overview */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>${monthlyEarned}</Text>
            <Text style={styles.statLabel}>This Month</Text>
            <Text style={styles.statSubtext}>${50 - monthlyEarned} remaining</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statValue}>${totalEarned}</Text>
            <Text style={styles.statLabel}>Total Earned</Text>
            <Text style={styles.statSubtext}>All time</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statValue}>LVL {level}</Text>
            <Text style={styles.statLabel}>Current Level</Text>
            <View style={styles.levelProgressContainer}>
              <View style={styles.levelProgressBar}>
                <View style={[styles.levelProgressFill, { width: `${experienceProgress}%` }]} />
              </View>
              <Text style={styles.levelProgressText}>{nextLevelExp} XP to next level</Text>
            </View>
          </View>
        </View>

        {/* Active Rewards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Rewards ({activeRewards.length})</Text>
          {activeRewards.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No active rewards</Text>
              <Text style={styles.emptyStateSubtext}>Keep tracking your wellness to unlock rewards!</Text>
            </View>
          ) : (
            activeRewards.map(renderRewardCard)
          )}
        </View>

        {/* Family Support Messages */}
        <View style={styles.section}>
          <View style={styles.messagesSectionHeader}>
            <Text style={styles.sectionTitle}>Family Support</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          
          {supportMessages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No messages yet</Text>
              <Text style={styles.emptyStateSubtext}>Your family support will appear here</Text>
            </View>
          ) : (
            supportMessages.map(renderSupportMessage)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 30,
    paddingTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 30,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.backgroundCard,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  statSubtext: {
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  levelProgressContainer: {
    width: '100%',
    marginTop: 4,
  },
  levelProgressBar: {
    height: 4,
    backgroundColor: theme.colors.backgroundTertiary,
    borderRadius: 2,
    marginBottom: 4,
  },
  levelProgressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  levelProgressText: {
    fontSize: 8,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  rewardCard: {
    backgroundColor: theme.colors.backgroundCard,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  completedRewardCard: {
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.backgroundCard,
  },
  rewardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  rewardInfo: {
    flex: 1,
    marginRight: 12,
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  rewardDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  rewardValue: {
    alignItems: 'flex-end',
  },
  rewardAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.success,
    marginBottom: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: theme.colors.backgroundTertiary,
    borderRadius: 4,
    marginRight: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    minWidth: 40,
  },
  claimButton: {
    backgroundColor: theme.colors.success,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  claimButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  messagesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  unreadBadge: {
    backgroundColor: theme.colors.error,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  messageCard: {
    backgroundColor: theme.colors.backgroundCard,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  unreadMessage: {
    borderColor: theme.colors.primary,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  messageIconText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  messageContent: {
    flex: 1,
  },
  messageText: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontWeight: '500',
    marginBottom: 4,
    lineHeight: 18,
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
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: theme.colors.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyStateText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
}); 