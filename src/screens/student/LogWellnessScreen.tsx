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
      icon: 'today',
      status: todayEntry ? 'completed' : 'pending'
    },
    {
      title: 'View History',
      subtitle: 'See your wellness journey over time',
      action: () => navigation.navigate('WellnessHistory'),
      icon: 'history',
      status: 'available'
    },
    {
      title: 'Weekly Summary',
      subtitle: 'Review your week\'s progress',
      action: () => showWeeklySummary(),
      icon: 'weekly',
      status: 'available'
    },
  ];

  const showWeeklySummary = () => {
    showMessage({
      message: 'Weekly Summary',
      description: `Current streak: ${currentStreak} days • Average score: ${stats.averageScore}/10`,
      type: 'info',
      backgroundColor: theme.colors.info,
      color: theme.colors.backgroundSecondary,
      duration: 3000,
    });
  };

  const renderQuickAction = (action: any, index: number) => (
    <TouchableOpacity 
      key={index}
      style={[
        styles.actionCard,
        action.status === 'completed' && styles.completedCard
      ]}
      onPress={action.action}
      activeOpacity={0.8}
    >
      <View style={styles.actionHeader}>
        <View style={[
          styles.actionIcon,
          action.status === 'completed' && styles.completedIcon,
          action.status === 'pending' && styles.pendingIcon
        ]}>
          <Text style={[
            styles.actionIconText,
            action.status === 'completed' && styles.completedIconText
          ]}>
            {action.icon === 'today' ? 'T' : 
             action.icon === 'history' ? 'H' : 'W'}
          </Text>
        </View>
        <View style={styles.actionContent}>
          <Text style={styles.actionTitle}>{action.title}</Text>
          <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
        </View>
        <View style={styles.statusIndicator}>
          {action.status === 'completed' && (
            <Text style={styles.statusText}>Done</Text>
          )}
          {action.status === 'pending' && (
            <Text style={styles.statusTextPending}>Pending</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Wellness Tracking</Text>
          <Text style={styles.subtitle}>Track and monitor your daily wellness journey</Text>
        </View>

        <View style={styles.streakCard}>
          <Text style={styles.streakNumber}>{currentStreak}</Text>
          <Text style={styles.streakLabel}>Day Streak</Text>
          <Text style={styles.streakMessage}>
            {currentStreak === 0 ? 'Start your wellness journey today!' :
             currentStreak === 1 ? 'Great start! Keep it going.' :
             currentStreak < 7 ? 'Building a healthy habit!' :
             currentStreak < 30 ? 'Excellent consistency!' :
             'Amazing dedication!'}
          </Text>
        </View>

        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          {quickActions.map(renderQuickAction)}
        </View>

        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Your Progress</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalEntries}</Text>
              <Text style={styles.statLabel}>Total Entries</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.averageScore}</Text>
              <Text style={styles.statLabel}>Average Score</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.weeklyAverage}</Text>
              <Text style={styles.statLabel}>This Week</Text>
            </View>
          </View>
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
  streakCard: {
    backgroundColor: theme.colors.backgroundCard,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    marginBottom: 30,
    ...theme.shadows.medium,
  },
  streakNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: theme.colors.primary,
    marginBottom: 8,
  },
  streakLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  streakMessage: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    fontWeight: '500',
  },
  actionsSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  actionCard: {
    backgroundColor: theme.colors.backgroundCard,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
    ...theme.shadows.small,
  },
  completedCard: {
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.backgroundCard,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  completedIcon: {
    backgroundColor: theme.colors.success,
  },
  pendingIcon: {
    backgroundColor: theme.colors.warning,
  },
  actionIconText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  completedIconText: {
    color: 'white',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  statusIndicator: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    color: theme.colors.success,
    fontWeight: '600',
  },
  statusTextPending: {
    fontSize: 12,
    color: theme.colors.warning,
    fontWeight: '600',
  },
  statsSection: {
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    backgroundColor: theme.colors.backgroundCard,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    ...theme.shadows.small,
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
    textAlign: 'center',
  },
}); 