import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWellnessStore } from '../../stores/wellnessStore';
import { showMessage } from 'react-native-flash-message';
import { theme } from '../../styles/theme';

interface LogWellnessScreenProps {
  navigation: any;
}

export const LogWellnessScreen: React.FC<LogWellnessScreenProps> = ({ navigation }) => {
  const { todayEntry, stats } = useWellnessStore();
  const [currentStreak, setCurrentStreak] = useState(stats.currentStreak);

  const quickActions = [
    {
      title: 'Log Today\'s Wellness',
      subtitle: todayEntry ? 'Update your daily entry' : 'Start your wellness tracking',
      action: () => navigation.navigate('WellnessLog'),
      status: todayEntry ? 'completed' : 'pending'
    },
    {
      title: 'View History',
      subtitle: 'See your wellness journey over time',
      action: () => navigation.navigate('WellnessHistory'),
      status: 'available'
    },
    {
      title: 'Weekly Summary',
      subtitle: 'Review your week\'s progress',
      action: () => showWeeklySummary(),
      status: 'available'
    },
  ];

  const showWeeklySummary = () => {
    showMessage({
      message: 'Weekly Summary',
      description: `Current streak: ${currentStreak} days • Average score: ${stats.averageScore}/10`,
      type: 'info',
      backgroundColor: theme.colors.backgroundSecondary,
      color: theme.colors.textPrimary,
      duration: 3000,
    });
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'completed':
        return { backgroundColor: theme.colors.success, text: 'Done', textColor: '#ffffff' };
      case 'pending':
        return { backgroundColor: theme.colors.warning, text: 'Todo', textColor: '#ffffff' };
      default:
        return { backgroundColor: theme.colors.secondary, text: 'Available', textColor: theme.colors.primaryDark };
    }
  };

  const renderQuickAction = (action: any, index: number) => {
    const tagStyle = getStatusTag(action.status);
    
    return (
      <TouchableOpacity 
        key={index}
        style={styles.actionItem}
        onPress={action.action}
        activeOpacity={0.8}
      >
        <View style={styles.actionContent}>
          <View style={styles.actionHeader}>
            <Text style={styles.actionTitle}>{action.title}</Text>
            <View style={[styles.statusTag, { backgroundColor: tagStyle.backgroundColor }]}>
              <Text style={[styles.statusTagText, { color: tagStyle.textColor }]}>
                {tagStyle.text}
              </Text>
            </View>
          </View>
          <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
        </View>
        <Text style={styles.actionArrow}>›</Text>
      </TouchableOpacity>
    );
  };

  const getStreakMessage = () => {
    if (currentStreak === 0) return 'Start your wellness journey today!';
    if (currentStreak === 1) return 'Great start! Keep it going.';
    if (currentStreak < 7) return 'Building a healthy habit!';
    if (currentStreak < 30) return 'Excellent consistency!';
    return 'Amazing dedication!';
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Modern Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Wellness</Text>
          <Text style={styles.title}>Track Your Journey</Text>
          <Text style={styles.pullHint}>Monitor your daily wellness progress</Text>
        </View>

        {/* Streak Section - Clean layout without heavy card */}
        <View style={styles.streakSection}>
          <View style={styles.streakHeader}>
            <Text style={styles.streakTitle}>Current Streak</Text>
            <View style={styles.streakBadge}>
              <Text style={styles.streakBadgeText}>{currentStreak} days</Text>
            </View>
          </View>
          <Text style={styles.streakMessage}>{getStreakMessage()}</Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          {quickActions.map(renderQuickAction)}
        </View>

        {/* Progress Metrics */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Your Progress</Text>
          
          <View style={styles.statItem}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>Total Entries</Text>
              <Text style={styles.statValue}>{stats.totalEntries}</Text>
            </View>
            <View style={styles.statTag}>
              <Text style={styles.statTagText}>
                {stats.totalEntries === 0 ? 'No entries yet' : 'entries logged'}
              </Text>
            </View>
          </View>
          
          <View style={styles.statItem}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>Average Score</Text>
              <Text style={styles.statValue}>
                {stats.totalEntries === 0 ? '--' : stats.averageScore.toFixed(1)}
              </Text>
            </View>
            <View style={styles.statTag}>
              <Text style={styles.statTagText}>
                {stats.totalEntries === 0 ? 'Start logging' : 'out of 10'}
              </Text>
            </View>
          </View>
          
          <View style={styles.statItem}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>This Week</Text>
              <Text style={styles.statValue}>
                {stats.weeklyAverage === 0 ? '--' : stats.weeklyAverage.toFixed(1)}
              </Text>
            </View>
            <View style={styles.statTag}>
              <Text style={styles.statTagText}>
                {stats.weeklyAverage === 0 ? 'No entries' : 'average score'}
              </Text>
            </View>
          </View>
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

  // Streak Section (no card, clean layout like parent)
  streakSection: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    marginBottom: 8,
  },
  streakHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  streakTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  streakBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  streakBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  streakMessage: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },

  // Actions Section
  actionsSection: {
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },

  // Action Items - Clean list style (like parent dashboard)
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  actionContent: {
    flex: 1,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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

  // Stats Section - Clean layout with border separators
  statsSection: {
    paddingHorizontal: 24,
    marginBottom: 20,
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
}); 