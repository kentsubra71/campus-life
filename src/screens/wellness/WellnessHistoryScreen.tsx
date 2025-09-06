import React, { useState } from 'react';
import { theme } from '../../styles/theme';
import { formatDateForDisplay } from '../../utils/dateUtils';
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
    return formatDateForDisplay(dateString, {
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

  const getMoodLevel = (mood: number) => {
    if (mood >= 8) return 'Excellent';
    if (mood >= 6) return 'Good';
    if (mood >= 4) return 'Fair';
    if (mood >= 2) return 'Poor';
    return 'Very Poor';
  };

  const renderStatsCard = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statsHeader}>
        <Text style={styles.statsTitle}>Wellness Overview</Text>
        <View style={[styles.statusBadge, { 
          backgroundColor: stats.currentStreak >= 3 ? '#10b981' : 
                          stats.currentStreak >= 1 ? '#3b82f6' : '#f59e0b'
        }]}>
          <Text style={styles.statusBadgeText}>
            {stats.currentStreak >= 3 ? 'ON TRACK' : 
             stats.currentStreak >= 1 ? 'BUILDING' : 'GET STARTED'}
          </Text>
        </View>
      </View>
      <Text style={styles.statsSubtitle}>
        {stats.currentStreak}-day streak • {stats.averageScore} avg score • {stats.totalEntries} total entries
      </Text>
    </View>
  );

  const renderTimeFilter = () => (
    <View style={styles.filterSection}>
      <View style={styles.segmentedControl}>
        <TouchableOpacity
          style={[styles.segment, styles.segmentFirst, timeFilter === 'week' && styles.segmentActive]}
          onPress={() => setTimeFilter('week')}
        >
          <Text style={[styles.segmentText, timeFilter === 'week' && styles.segmentTextActive]}>
            Week
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, timeFilter === 'month' && styles.segmentActive]}
          onPress={() => setTimeFilter('month')}
        >
          <Text style={[styles.segmentText, timeFilter === 'month' && styles.segmentTextActive]}>
            Month
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, styles.segmentLast, timeFilter === 'all' && styles.segmentActive]}
          onPress={() => setTimeFilter('all')}
        >
          <Text style={[styles.segmentText, timeFilter === 'all' && styles.segmentTextActive]}>
            All Time
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const getRankingText = (ranking: number) => {
    switch (ranking) {
      case 1: return 'Best';
      case 2: return 'Good';
      case 3: return 'Fair';
      case 4: return 'Worst';
      default: return 'Unknown';
    }
  };

  const renderEntryItem = ({ item }: { item: WellnessEntry }) => (
    <View style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <Text style={styles.entryDate}>{formatDate(item.date)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getScoreColor(item.overallScore) }]}>
          <Text style={styles.scoreText}>
            {item.overallScore}/10
          </Text>
        </View>
      </View>
      
      <View style={styles.entryDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Overall Mood:</Text>
          <Text style={styles.detailValue}>
            {getMoodLevel(item.overallMood)} ({item.overallMood}/10)
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Sleep:</Text>
          <Text style={styles.detailValue}>{getRankingText(item.rankings.sleep)} (#{item.rankings.sleep})</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Nutrition:</Text>
          <Text style={styles.detailValue}>{getRankingText(item.rankings.nutrition)} (#{item.rankings.nutrition})</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Academics:</Text>
          <Text style={styles.detailValue}>{getRankingText(item.rankings.academics)} (#{item.rankings.academics})</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Social:</Text>
          <Text style={styles.detailValue}>{getRankingText(item.rankings.social)} (#{item.rankings.social})</Text>
        </View>
      </View>

      {item.notes && (
        <View style={styles.notesContainer}>
          <Text style={styles.notesText}>"{item.notes}"</Text>
        </View>
      )}
    </View>
  );

  const filteredEntries = getFilteredEntries();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Wellness History</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderStatsCard()}
        {renderTimeFilter()}

        {filteredEntries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No entries yet</Text>
            <Text style={styles.emptySubtitle}>
              Start logging your daily wellness to see your progress here!
            </Text>
            <TouchableOpacity
              style={styles.addEntryButton}
              onPress={() => navigation.navigate('WellnessLog')}
            >
              <Text style={styles.addEntryButtonText}>Log Today's Wellness</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredEntries}
            renderItem={renderEntryItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
          />
        )}
      </ScrollView>
    </SafeAreaView>
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: theme.colors.backgroundCard,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statsContainer: {
    paddingVertical: 12,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
    textTransform: 'uppercase',
  },
  statsSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  filterSection: {
    marginBottom: 16,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 8,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentFirst: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  segmentLast: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  segmentActive: {
    backgroundColor: theme.colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  segmentTextActive: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  entryCard: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: 16,
    paddingHorizontal: 0,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  entryDate: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 50,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
    textTransform: 'uppercase',
  },
  entryDetails: {
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  notesContainer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 8,
    marginTop: 8,
  },
  notesText: {
    fontSize: 13,
    color: theme.colors.textTertiary,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  addEntryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addEntryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default WellnessHistoryScreen; 