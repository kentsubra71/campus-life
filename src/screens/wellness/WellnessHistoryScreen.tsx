import React, { useState } from 'react';
import { theme } from '../../styles/theme';
import { commonStyles } from '../../styles/components';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWellnessStore, WellnessEntry } from '../../stores/wellnessStore';

interface WellnessHistoryScreenProps {
  navigation: any;
}

const WellnessHistoryScreen: React.FC<WellnessHistoryScreenProps> = ({ navigation }) => {
  const { entries, stats, getWeeklyEntries, getMonthlyEntries } = useWellnessStore();
  const [timeFilter, setTimeFilter] = useState<'week' | 'month' | 'all'>('week');

  const getFilteredEntries = () => {
    switch (timeFilter) {
      case 'week':
        return getWeeklyEntries();
      case 'month':
        return getMonthlyEntries();
      case 'all':
        return entries;
      default:
        return getWeeklyEntries();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return theme.colors.success;
    if (score >= 6) return theme.colors.warning;
    return theme.colors.error;
  };
  
  const getScoreTag = (score: number) => {
    if (score >= 8) return { text: 'Great', color: theme.colors.success };
    if (score >= 6) return { text: 'Good', color: theme.colors.warning };
    return { text: 'Needs Care', color: theme.colors.error };
  };

  const getMoodLevel = (mood: number) => {
    if (mood >= 8) return 'Excellent';
    if (mood >= 6) return 'Good';
    if (mood >= 4) return 'Fair';
    if (mood >= 2) return 'Poor';
    return 'Very Poor';
  };

  const renderStatsSection = () => (
    <View style={styles.statsSection}>
      <Text style={styles.sectionTitle}>Your Progress</Text>
      
      <View style={styles.statItem}>
        <View style={styles.statHeader}>
          <Text style={styles.statLabel}>Current Streak</Text>
          <Text style={styles.statValue}>{stats.currentStreak} days</Text>
        </View>
      </View>
      
      <View style={styles.statItem}>
        <View style={styles.statHeader}>
          <Text style={styles.statLabel}>Average Score</Text>
          <Text style={styles.statValue}>{stats.averageScore.toFixed(1)}/10</Text>
        </View>
      </View>
      
      <View style={styles.statItem}>
        <View style={styles.statHeader}>
          <Text style={styles.statLabel}>Total Entries</Text>
          <Text style={styles.statValue}>{stats.totalEntries}</Text>
        </View>
      </View>
      
      <View style={styles.statItem}>
        <View style={styles.statHeader}>
          <Text style={styles.statLabel}>Weekly Average</Text>
          <Text style={styles.statValue}>{stats.weeklyAverage.toFixed(1)}/10</Text>
        </View>
      </View>
    </View>
  );

  const renderTimeFilter = () => (
    <View style={styles.filterSection}>
      <Text style={styles.sectionTitle}>Time Period</Text>
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[
            styles.filterTag,
            timeFilter === 'week' && styles.filterTagActive
          ]}
          onPress={() => setTimeFilter('week')}
        >
          <Text style={[
            styles.filterTagText,
            timeFilter === 'week' && styles.filterTagTextActive
          ]}>
            Week
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterTag,
            timeFilter === 'month' && styles.filterTagActive
          ]}
          onPress={() => setTimeFilter('month')}
        >
          <Text style={[
            styles.filterTagText,
            timeFilter === 'month' && styles.filterTagTextActive
          ]}>
            Month
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterTag,
            timeFilter === 'all' && styles.filterTagActive
          ]}
          onPress={() => setTimeFilter('all')}
        >
          <Text style={[
            styles.filterTagText,
            timeFilter === 'all' && styles.filterTagTextActive
          ]}>
            All Time
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEntryItem = ({ item }: { item: WellnessEntry }) => {
    const scoreTag = getScoreTag(item.wellnessScore);
    
    return (
      <View style={styles.entryItem}>
        <View style={styles.entryHeader}>
          <View style={styles.entryInfo}>
            <Text style={styles.entryDate}>{formatDate(item.date)}</Text>
            <Text style={styles.entryScore}>{item.wellnessScore}/10</Text>
          </View>
          <View style={[styles.scoreTag, { backgroundColor: scoreTag.color }]}>
            <Text style={styles.scoreTagText}>{scoreTag.text}</Text>
          </View>
        </View>
        
        <View style={styles.entryMetrics}>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Mood</Text>
            <Text style={styles.metricValue}>{getMoodLevel(item.mood)} ({item.mood}/10)</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Sleep</Text>
            <Text style={styles.metricValue}>{item.sleep}h</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Exercise</Text>
            <Text style={styles.metricValue}>{item.exercise}m</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Water</Text>
            <Text style={styles.metricValue}>{item.water} glasses</Text>
          </View>
        </View>

        {item.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesText}>\u201c{item.notes}\u201d</Text>
          </View>
        )}
      </View>
    );
  };

  const filteredEntries = getFilteredEntries();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wellness History</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {renderStatsSection()}
          {renderTimeFilter()}

          {filteredEntries.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyTitle}>No entries yet</Text>
              <Text style={styles.emptySubtitle}>
                Start logging your daily wellness to see your progress here!
              </Text>
              <TouchableOpacity
                style={styles.primaryAction}
                onPress={() => navigation.navigate('WellnessLog')}
              >
                <Text style={styles.primaryActionText}>Log Today's Wellness</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.entriesSection}>
              <Text style={styles.sectionTitle}>Recent Entries</Text>
              <FlatList
                data={filteredEntries}
                renderItem={renderEntryItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 15,
    paddingTop: 60,
    backgroundColor: theme.colors.background,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  // Stats Section - Clean layout with border separators
  statsSection: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 12,
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

  // Filter Section
  filterSection: {
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: theme.colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterTagActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterTagText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  filterTagTextActive: {
    color: '#ffffff',
  },

  // Entries Section
  entriesSection: {
    marginBottom: 8,
  },
  entryItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  entryInfo: {
    flex: 1,
  },
  entryDate: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  entryScore: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  scoreTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scoreTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Entry Metrics
  entryMetrics: {
    marginBottom: 8,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 13,
    color: theme.colors.textTertiary,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },

  // Notes Section
  notesSection: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  notesText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
  },

  // Empty States
  emptySection: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  primaryAction: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default WellnessHistoryScreen; 