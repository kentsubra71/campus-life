import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  RefreshControl
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { Theme } from '../../constants/themes';
import { useRewardsStore } from '../../stores/rewardsStore';

export const RewardsScreen = () => {
  const { theme } = useTheme();
  const { 
    activeRewards, 
    claimedRewards, 
    totalEarned, 
    monthlyEarned, 
    level, 
    experience, 
    fetchActiveRewards, 
    claimReward 
  } = useRewardsStore();
  
  const [refreshing, setRefreshing] = useState(false);
  const styles = createStyles(theme);

  useEffect(() => {
    loadRewards();
  }, []);

  const loadRewards = async () => {
    try {
      await fetchActiveRewards();
    } catch (error) {
      console.error('Error loading rewards:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRewards();
    setRefreshing(false);
  };

  const handleClaimReward = async (rewardId: string) => {
    try {
      await claimReward(rewardId);
      Alert.alert('Reward Claimed!', 'Great job! Keep up the good work!');
    } catch (error) {
      Alert.alert('Error', 'Failed to claim reward. Please try again.');
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'sleep': return '😴';
      case 'meals': return '🍽️';
      case 'exercise': return '💪';
      case 'wellness': return '🌟';
      case 'streak': return '🔥';
      case 'social': return '👥';
      case 'study': return '📚';
      default: return '🎯';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'automatic': return theme.colors.success;
      case 'manual': return theme.colors.primary;
      case 'challenge': return theme.colors.warning;
      default: return theme.colors.textSecondary;
    }
  };

  const getLevelTitle = (level: number) => {
    if (level <= 5) return 'Freshman';
    if (level <= 10) return 'Sophomore';
    if (level <= 15) return 'Junior';
    if (level <= 20) return 'Senior';
    return 'Graduate';
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Campus Rewards</Text>
        <Text style={styles.subtitle}>Earn support from family & friends</Text>
      </View>

      {/* Stats Overview */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>${totalEarned}</Text>
          <Text style={styles.statLabel}>Total Earned</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>${monthlyEarned}</Text>
          <Text style={styles.statLabel}>This Month</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{level}</Text>
          <Text style={styles.statLabel}>Level</Text>
        </View>
      </View>

      {/* Level Progress */}
      <View style={styles.levelCard}>
        <View style={styles.levelHeader}>
          <View>
            <Text style={styles.levelTitle}>{getLevelTitle(level)}</Text>
            <Text style={styles.levelSubtitle}>Level {level}</Text>
          </View>
          <Text style={styles.experienceText}>{experience % 200} / 200 XP</Text>
        </View>
        <View style={styles.experienceBar}>
          <View 
            style={[
              styles.experienceFill, 
              { width: `${((experience % 200) / 200) * 100}%` }
            ]} 
          />
        </View>
        <Text style={styles.nextLevelText}>
          {200 - (experience % 200)} XP to {getLevelTitle(level + 1)}
        </Text>
      </View>

      {/* Available Rewards */}
      {activeRewards.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Available Rewards</Text>
            <Text style={styles.rewardsTotal}>
              ${activeRewards.reduce((sum, r) => sum + r.amount, 0)} possible
            </Text>
          </View>
          
          {activeRewards.map((reward) => (
            <TouchableOpacity 
              key={reward.id} 
              style={[
                styles.rewardCard,
                reward.progress >= reward.maxProgress && styles.rewardCardComplete
              ]}
              onPress={() => reward.progress >= reward.maxProgress && handleClaimReward(reward.id)}
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
                  <View style={[
                    styles.typeBadge, 
                    { backgroundColor: getTypeColor(reward.type) }
                  ]}>
                    <Text style={styles.typeText}>{reward.type}</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.rewardProgress}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressText}>
                    Progress: {reward.progress}/{reward.maxProgress}
                  </Text>
                  {reward.progress >= reward.maxProgress && (
                    <MaterialIcons name="check-circle" size={20} color={theme.colors.success} />
                  )}
                </View>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${Math.min((reward.progress / reward.maxProgress) * 100, 100)}%` }
                    ]} 
                  />
                </View>
              </View>
              
              {reward.progress >= reward.maxProgress && (
                <View style={styles.claimButton}>
                  <MaterialIcons name="card-giftcard" size={20} color="white" />
                  <Text style={styles.claimButtonText}>Claim Reward</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Recent Claims */}
      {claimedRewards.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recently Claimed</Text>
          {claimedRewards.slice(0, 5).map((reward) => (
            <View key={reward.id} style={styles.claimedCard}>
              <Text style={styles.claimedIcon}>{getCategoryIcon(reward.category)}</Text>
              <View style={styles.claimedInfo}>
                <Text style={styles.claimedTitle}>{reward.title}</Text>
                <Text style={styles.claimedDate}>
                  Claimed {new Date(reward.claimedAt!).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.claimedAmount}>+${reward.amount}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Empty State */}
      {activeRewards.length === 0 && claimedRewards.length === 0 && (
        <View style={styles.emptyState}>
          <MaterialIcons name="card-giftcard" size={64} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>No Rewards Yet</Text>
          <Text style={styles.emptySubtitle}>
            Start logging your wellness activities to unlock rewards from your support network!
          </Text>
        </View>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 0,
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: theme.colors.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
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
    color: theme.colors.text,
  },
  levelSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  experienceText: {
    fontSize: 14,
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
  nextLevelText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
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
  rewardCardComplete: {
    borderWidth: 2,
    borderColor: theme.colors.success,
  },
  rewardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  rewardInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
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
  claimButton: {
    backgroundColor: theme.colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  claimButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  claimedCard: {
    backgroundColor: theme.colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  claimedIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  claimedInfo: {
    flex: 1,
  },
  claimedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  claimedDate: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  claimedAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.success,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 20,
  },
}); 