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


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Wellness</Text>
          <Text style={styles.title}>Track Your Journey</Text>
          <Text style={styles.subtitle}>Stay consistent with your daily wellness habits</Text>
        </View>

        {/* Current Status */}
        <View style={styles.statusSection}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>
              {todayEntry ? 'Today is logged' : 'Ready to log today?'}
            </Text>
            <View style={[styles.statusBadge, { 
              backgroundColor: todayEntry ? theme.colors.success : theme.colors.warning 
            }]}>
              <Text style={styles.statusBadgeText}>
                {currentStreak} DAY STREAK
              </Text>
            </View>
          </View>
          <Text style={styles.statusSubtitle}>
            {currentStreak === 0 ? 'Start your wellness journey today and build a healthy habit' :
             currentStreak === 1 ? 'Great start! Keep the momentum going.' :
             currentStreak < 7 ? 'You\'re building a strong wellness routine!' :
             currentStreak < 30 ? 'Excellent consistency — you\'re doing amazing!' :
             'Incredible dedication to your wellness!'}
          </Text>
        </View>

        {/* Progress Metrics */}
        <View style={styles.metricsSection}>
          <View style={styles.metricItem}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>Total Entries</Text>
              <Text style={styles.metricValue}>{stats.totalEntries}</Text>
            </View>
            <Text style={[styles.metricTag, { color: theme.colors.primary }]}>
              {stats.totalEntries === 0 ? 'Start tracking today' : 'wellness logs completed'}
            </Text>
          </View>
          
          <View style={styles.metricItem}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>Average Score</Text>
              <Text style={styles.metricValue}>
                {stats.totalEntries === 0 ? '--' : stats.averageScore.toFixed(1)}
              </Text>
            </View>
            <Text style={[styles.metricTag, { color: theme.colors.success }]}>
              {stats.totalEntries === 0 ? 'out of 10' : `out of 10 — ${stats.averageScore >= 7 ? 'great work!' : stats.averageScore >= 5 ? 'keep improving!' : 'every step counts!'}`}
            </Text>
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
                <View style={[styles.primaryActionIndicator, {
                  backgroundColor: todayEntry ? theme.colors.success : theme.colors.primary
                }]} />
              </View>
              <View style={styles.primaryActionText}>
                <Text style={styles.primaryActionTitle}>
                  {todayEntry ? 'Update Today\'s Wellness' : 'Log Today\'s Wellness'}
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
              onPress={() => navigation.navigate('WellnessHistory')}
            >
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>View History</Text>
                <Text style={styles.actionSubtitle}>See your wellness journey over time</Text>
              </View>
              <Text style={styles.actionArrow}>›</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => showWeeklySummary()}
            >
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Weekly Summary</Text>
                <Text style={styles.actionSubtitle}>Review your week's progress</Text>
              </View>
              <Text style={styles.actionArrow}>›</Text>
            </TouchableOpacity>
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
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 30,
    paddingTop: 20,
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
  
  // Status Section - No Card
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
  
  // Metrics Section - Mixed Layout
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
  
  // Actions Section
  actionsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 12,
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
  actionArrow: {
    fontSize: 18,
    color: theme.colors.textTertiary,
    fontWeight: '300',
  },
}); 