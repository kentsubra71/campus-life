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
import { MoneyCompactSummary } from '../../components/MoneyCompactSummary';
import { MessagesSummary } from '../../components/MessagesSummary';
import { ItemsSummary } from '../../components/ItemsSummary';

interface RewardsScreenProps {
  navigation: any;
}

export const RewardsScreen: React.FC<RewardsScreenProps> = ({ navigation }) => {
  const {
    supportMessages,
    totalEarned,
    monthlyEarned,
    level,
    experience,
    fetchSupportMessages,
    markMessageRead,
  } = useRewardsStore();

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await fetchSupportMessages();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };


  const getMessageType = (type: string) => {
    switch (type) {
      case 'message': return 'Message';
      case 'voice': return 'Voice';
      case 'care_package': return 'Package';
      case 'video_call': return 'Video Call';
      case 'boost': return 'Boost';
      default: return 'Message';
    }
  };

  const formatTimeAgo = (timestamp: any) => {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - messageTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const handleMarkMessageRead = async (messageId: string) => {
    try {
      await markMessageRead(messageId);
    } catch (error) {
      console.error('Error marking message as read:', error);
      showMessage({
        message: 'Failed to mark message as read',
        type: 'warning',
      });
    }
  };

  const renderSupportMessage = (message: any) => {
    return (
      <TouchableOpacity
        key={message.id}
        style={[styles.activityItem, !message.read && styles.unreadMessage]}
        onPress={() => !message.read && handleMarkMessageRead(message.id)}
      >
        <View style={styles.activityContent}>
          <Text style={styles.activityTitle}>{message.content}</Text>
          <Text style={styles.activitySubtitle}>
            {getMessageType(message.type)} • {formatTimeAgo(message.timestamp)}
          </Text>
        </View>
        {!message.read && <View style={styles.unreadDot} />}
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
        {/* Modern Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Hi there!</Text>
          <Text style={styles.title}>Your Activity</Text>
          <Text style={styles.subtitle}>Money, messages, and family support</Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>${(monthlyEarned / 100).toFixed(0)}</Text>
            <Text style={styles.statLabel}>This Month</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>Level {level}</Text>
            <Text style={styles.statLabel}>Current Level</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{unreadCount}</Text>
            <Text style={styles.statLabel}>New Messages</Text>
          </View>
        </View>

        {/* Current Status - No Card */}
        <View style={styles.statusSection}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>Level {level} Student</Text>
            <View style={[styles.statusBadge, { 
              backgroundColor: monthlyEarned >= 40 ? theme.colors.success : 
                              monthlyEarned >= 20 ? theme.colors.primary : theme.colors.warning 
            }]}>
              <Text style={styles.statusBadgeText}>
                {monthlyEarned >= 40 ? 'GREAT MONTH' : monthlyEarned >= 20 ? 'DOING WELL' : 'GETTING STARTED'}
              </Text>
            </View>
          </View>
          <Text style={styles.statusSubtitle}>
            {experienceProgress > 80 ? 'Almost to the next level! Keep up the great work.' : 
             experienceProgress > 50 ? 'Making solid progress toward your next level.' : 
             'Log your wellness daily to level up and earn more rewards'}
          </Text>
        </View>

        {/* Key Metrics - No Cards */}
        <View style={styles.metricsSection}>
          <View style={styles.metricItem}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>This Month</Text>
              <Text style={styles.metricValue}>${monthlyEarned}</Text>
            </View>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { 
                  width: `${Math.max(5, Math.min(100, (monthlyEarned / 50) * 100))}%` 
                }]} />
              </View>
              <Text style={styles.progressText}>
                ${Math.max(0, 50 - monthlyEarned)} left to reach $50 monthly goal
              </Text>
            </View>
          </View>
          
          <View style={styles.metricItem}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>Your Level</Text>
              <Text style={styles.metricValue}>LVL {level}</Text>
            </View>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { 
                  width: `${Math.max(5, experienceProgress)}%` 
                }]} />
              </View>
              <Text style={styles.progressText}>{nextLevelExp} XP to next level</Text>
            </View>
          </View>
        </View>

        {/* Money Received Section */}
        <MoneyCompactSummary onViewAll={() => navigation.navigate('PaymentHistory')} />

        {/* Messages Summary */}
        <MessagesSummary onViewAll={() => {}} userType="student" />

        {/* Items Summary */}
        <ItemsSummary onViewAll={() => {}} userType="student" />

        {/* Family Support Messages */}
        <View style={styles.messagesSection}>
          <View style={styles.messagesSectionHeader}>
            <Text style={styles.sectionTitle}>Family Support</Text>
            {unreadCount > 0 && (
              <Text style={styles.newMessagesBadge}>
                {unreadCount} new
              </Text>
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

        {/* All Activity Section */}
        <TouchableOpacity 
          style={styles.allActivitySection}
          onPress={() => navigation.navigate('PaymentHistory')}
        >
          <View style={styles.allActivityHeader}>
            <Text style={styles.sectionTitle}>All Activity</Text>
            <Text style={styles.viewAllText}>View All →</Text>
          </View>
          <Text style={styles.allActivitySubtext}>
            Your complete payment and message history
          </Text>
        </TouchableOpacity>
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
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 24,
    paddingTop: 10,
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
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: theme.colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
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
  statusSection: {
    paddingVertical: 16,
    marginBottom: 20,
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
  metricsSection: {
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
  progressContainer: {
    gap: 6,
  },
  progressBar: {
    height: 6,
    backgroundColor: theme.colors.backgroundTertiary,
    borderRadius: 3,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: theme.colors.textTertiary,
  },
  messagesSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  messagesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  unreadMessage: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
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
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
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
  allActivitySection: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginBottom: 30,
  },
  allActivityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  allActivitySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
}); 