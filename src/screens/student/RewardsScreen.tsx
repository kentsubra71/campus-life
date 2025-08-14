import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
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
    fetchMonthlyPayments,
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
    await fetchMonthlyPayments(); // This will fetch both monthly and total earnings
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
          backgroundColor: theme.colors.backgroundSecondary,
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
          backgroundColor: theme.colors.backgroundSecondary,
          color: theme.colors.textPrimary,
        });
      }
    }
  };

  const renderProgressBar = (progress: number, maxProgress: number) => {
    const percentage = Math.min((progress / maxProgress) * 100, 100);
    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${percentage}%` }]} />
        </View>
        <Text style={styles.progressText}>{progress}/{maxProgress}</Text>
      </View>
    );
  };

  const renderRewardCard = (reward: any) => {
    const isCompleted = reward.progress >= reward.maxProgress;
    
    return (
      <TouchableOpacity
        key={reward.id}
        style={styles.rewardItem}
        onPress={() => isCompleted ? handleClaimReward(reward.id) : null}
        activeOpacity={0.8}
      >
        <View style={styles.rewardContent}>
          <View style={styles.rewardHeader}>
            <View style={styles.rewardInfo}>
              <Text style={styles.rewardTitle}>{reward.title}</Text>
              <View style={styles.rewardMeta}>
                <View style={[
                  styles.categoryTag,
                  { backgroundColor: getCategoryColor(reward.category) }
                ]}>
                  <Text style={styles.categoryTagText}>{getCategoryName(reward.category)}</Text>
                </View>
                <Text style={styles.rewardAmount}>${reward.amount}</Text>
              </View>
            </View>
            {isCompleted && (
              <View style={styles.statusTag}>
                <Text style={styles.statusTagText}>Ready</Text>
              </View>
            )}
          </View>
          
          <Text style={styles.rewardDescription}>{reward.description}</Text>
          {renderProgressBar(reward.progress, reward.maxProgress)}
        </View>
        
        <Text style={styles.rewardArrow}>›</Text>
      </TouchableOpacity>
    );
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'sleep': return 'Sleep';
      case 'meals': return 'Nutrition';
      case 'exercise': return 'Exercise';
      case 'wellness': return 'Wellness';
      case 'streak': return 'Streak';
      case 'social': return 'Social';
      case 'stress': return 'Stress';
      default: return 'Other';
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      sleep: theme.colors.primary,
      meals: theme.colors.success,
      exercise: theme.colors.warning,
      wellness: '#8b5cf6',
      streak: theme.colors.error,
      social: theme.colors.info,
      stress: '#f97316',
    };
    return colors[category as keyof typeof colors] || theme.colors.textTertiary;
  };

  const getMessageTypeTag = (type: string) => {
    const typeMap = {
      message: { name: 'Message', color: theme.colors.primary },
      voice: { name: 'Voice', color: theme.colors.success },
      care_package: { name: 'Package', color: theme.colors.warning },
      video_call: { name: 'Call', color: theme.colors.info },
      boost: { name: 'Boost', color: '#8b5cf6' },
    };
    return typeMap[type as keyof typeof typeMap] || { name: 'Message', color: theme.colors.primary };
  };

  const renderSupportMessage = (message: any) => {
    const messageType = getMessageTypeTag(message.type);
    
    return (
      <TouchableOpacity
        key={message.id}
        style={styles.messageItem}
        onPress={() => !message.read && markMessageRead(message.id)}
        activeOpacity={0.8}
      >
        <View style={styles.messageContent}>
          <View style={styles.messageHeaderRow}>
            <View style={[
              styles.messageTypeTag,
              { backgroundColor: messageType.color }
            ]}>
              <Text style={styles.messageTypeText}>{messageType.name}</Text>
            </View>
            <Text style={styles.messageTime}>
              {message.timestamp.toLocaleDateString()}
            </Text>
          </View>
          <Text style={styles.messageText}>{message.content}</Text>
        </View>
        
        {!message.read && <View style={styles.unreadIndicator} />}
        <Text style={styles.messageArrow}>›</Text>
      </TouchableOpacity>
    );
  };

  const experienceProgress = (experience % 200) / 200 * 100;
  const nextLevelExp = (level * 200) - experience;
  const unreadCount = supportMessages.filter(msg => !msg.read).length;

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Modern Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Rewards</Text>
          <Text style={styles.title}>Care Boosts</Text>
          <Text style={styles.pullHint}>Track progress and family support</Text>
        </View>

        {/* Stats Overview */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Earnings</Text>
          
          <View style={styles.statItem}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>This Month</Text>
              <Text style={styles.statValue}>${monthlyEarned}</Text>
            </View>
            <View style={styles.statTag}>
              <Text style={styles.statTagText}>${50 - monthlyEarned} remaining</Text>
            </View>
          </View>
          
          <View style={styles.statItem}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>Total Earned</Text>
              <Text style={styles.statValue}>${totalEarned}</Text>
            </View>
            <View style={styles.statTag}>
              <Text style={styles.statTagText}>all time</Text>
            </View>
          </View>
          
          <View style={styles.statItem}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>Current Level</Text>
              <Text style={styles.statValue}>Level {level}</Text>
            </View>
            <View style={styles.levelProgressBar}>
              <View style={[styles.levelProgressFill, { width: `${experienceProgress}%` }]} />
            </View>
            <Text style={styles.levelProgressText}>
              {nextLevelExp} XP to Level {level + 1}
            </Text>
          </View>
        </View>

        {/* Active Rewards */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Rewards</Text>
            {activeRewards.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{activeRewards.length}</Text>
              </View>
            )}
          </View>
          
          {activeRewards.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>No active rewards</Text>
              <Text style={styles.emptySubtext}>Keep tracking your wellness to unlock rewards!</Text>
            </View>
          ) : (
            activeRewards.map(renderRewardCard)
          )}
        </View>

        {/* Family Support Messages */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Family Support</Text>
            {unreadCount > 0 && (
              <View style={[styles.countBadge, { backgroundColor: theme.colors.error }]}>
                <Text style={styles.countBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          
          {supportMessages.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Your family support will appear here</Text>
            </View>
          ) : (
            supportMessages.map(renderSupportMessage)
          )}
        </View>
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
    fontSize: 14,
    color: theme.colors.textTertiary,
    marginTop: 4,
    fontWeight: '500',
  },

  // Stats Section - Clean layout with border separators
  statsSection: {
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  statItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  statTag: {
    alignSelf: 'flex-start',
  },
  statTagText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: theme.colors.textTertiary,
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
    fontSize: 12,
    color: theme.colors.textTertiary,
  },

  // Section Styling
  section: {
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
  countBadge: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 24,
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Reward Items - Clean list style
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
  rewardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  rewardInfo: {
    flex: 1,
    marginRight: 12,
  },
  rewardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  rewardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  rewardAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.success,
  },
  statusTag: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rewardDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  progressContainer: {
    gap: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: theme.colors.backgroundTertiary,
    borderRadius: 2,
    flex: 1,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.success,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    alignSelf: 'flex-end',
  },
  rewardArrow: {
    fontSize: 18,
    color: theme.colors.textTertiary,
    fontWeight: '300',
  },

  // Message Items
  messageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  messageContent: {
    flex: 1,
  },
  messageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageTypeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  messageTypeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  messageTime: {
    fontSize: 12,
    color: theme.colors.textTertiary,
  },
  messageText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    lineHeight: 20,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    marginRight: 8,
  },
  messageArrow: {
    fontSize: 18,
    color: theme.colors.textTertiary,
    fontWeight: '300',
  },

  // Empty States
  emptySection: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    textAlign: 'center',
  },
}); 