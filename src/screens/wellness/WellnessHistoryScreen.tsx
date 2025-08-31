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
      <Text style={styles.statsTitle}>Your Wellness Stats</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.currentStreak}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.averageScore}</Text>
          <Text style={styles.statLabel}>Avg Score</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalEntries}</Text>
          <Text style={styles.statLabel}>Total Entries</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.weeklyAverage}</Text>
          <Text style={styles.statLabel}>Weekly Avg</Text>
        </View>
      </View>
    </View>
  );

  const renderTimeFilter = () => (
    <View style={styles.filterContainer}>
      <TouchableOpacity
        style={[styles.filterButton, timeFilter === 'week' && styles.filterButtonActive]}
        onPress={() => setTimeFilter('week')}
      >
        <Text style={[styles.filterButtonText, timeFilter === 'week' && styles.filterButtonTextActive]}>
          Week
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.filterButton, timeFilter === 'month' && styles.filterButtonActive]}
        onPress={() => setTimeFilter('month')}
      >
        <Text style={[styles.filterButtonText, timeFilter === 'month' && styles.filterButtonTextActive]}>
          Month
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.filterButton, timeFilter === 'all' && styles.filterButtonActive]}
        onPress={() => setTimeFilter('all')}
      >
        <Text style={[styles.filterButtonText, timeFilter === 'all' && styles.filterButtonTextActive]}>
          All Time
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderEntryItem = ({ item }: { item: WellnessEntry }) => (
    <View style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <Text style={styles.entryDate}>{formatDate(item.date)}</Text>
        <View style={styles.entryScore}>
          <Text style={[styles.scoreText, { color: getScoreColor(item.wellnessScore) }]}>
            {item.wellnessScore}/10
          </Text>
        </View>
      </View>
      
      <View style={styles.entryDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Mood:</Text>
          <Text style={styles.detailValue}>
            {getMoodLevel(item.mood)} ({item.mood}/10)
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Sleep:</Text>
          <Text style={styles.detailValue}>{item.sleep}h</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Exercise:</Text>
          <Text style={styles.detailValue}>{item.exercise}m</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Water:</Text>
          <Text style={styles.detailValue}>{item.water} glasses</Text>
        </View>
      </View>

      {item.notes && (
        <View style={styles.notesContainer}>
          <Text style={styles.notesText}>{item.notes}</Text>
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
    color: 'theme.colors.primary',
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
    backgroundColor: theme.colors.backgroundCard,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'theme.colors.primary',
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 4,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: 'theme.colors.primary',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  entryCard: {
    backgroundColor: theme.colors.backgroundCard,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
  entryScore: {
    backgroundColor: theme.colors.backgroundTertiary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '600',
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
  },
  notesText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
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
    backgroundColor: 'theme.colors.primary',
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