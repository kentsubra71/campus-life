import React, { useState, useMemo, useEffect } from 'react';
import { theme } from '../../styles/theme';
import { formatDateForDisplay } from '../../utils/dateUtils';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWellnessStore, WellnessEntry } from '../../stores/wellnessStore';
import WellnessLineChart from '../../components/charts/WellnessLineChart';
import CategoriesChart from '../../components/charts/CategoriesChart';
import WellnessInsightsCard from '../../components/charts/WellnessInsightsCard';
import { 
  transformEntriesForCharts, 
  filterEntriesByPeriod,
  groupEntriesByPeriod, 
  calculateWellnessInsights 
} from '../../utils/chartDataTransform';
import { auth, db } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, limit } from 'firebase/firestore';

interface ChildWellnessScreenProps {
  navigation: any;
  route: {
    params: {
      studentId: string;
      studentName: string;
    };
  };
}

export const ChildWellnessScreen: React.FC<ChildWellnessScreenProps> = ({ navigation, route }) => {
  const { studentId, studentName } = route.params;
  const [entries, setEntries] = useState<WellnessEntry[]>([]);
  const [stats, setStats] = useState({ currentStreak: 0, averageScore: 0, totalEntries: 0 });
  const [timeFilter, setTimeFilter] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [viewMode, setViewMode] = useState<'charts' | 'list'>('charts');
  
  useEffect(() => {
    if (!studentId) {
      Alert.alert('Error', 'Student ID is required');
      navigation.goBack();
      return;
    }

    // Set up real-time listener for wellness entries
    const wellnessQuery = query(
      collection(db, 'wellness_entries'),
      where('user_id', '==', studentId),
      orderBy('date', 'desc'),
      limit(365) // Get up to a year of data
    );

    const unsubscribe = onSnapshot(wellnessQuery, (snapshot) => {
      const fetchedEntries: WellnessEntry[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Transform data to match WellnessEntry interface
        const entry: WellnessEntry = {
          id: doc.id,
          date: data.date,
          user_id: data.user_id,
          overall_mood: data.overall_mood,
          sleep_ranking: data.sleep_ranking,
          nutrition_ranking: data.nutrition_ranking,
          academics_ranking: data.academics_ranking,
          social_ranking: data.social_ranking,
          notes: data.notes || '',
          overallScore: data.overall_mood,
          rankings: {
            sleep: data.sleep_ranking,
            nutrition: data.nutrition_ranking,
            academics: data.academics_ranking,
            social: data.social_ranking
          },
          overallMood: data.overall_mood
        };
        
        fetchedEntries.push(entry);
      });

      console.log('📊 Fetched wellness entries for student:', fetchedEntries.length);
      setEntries(fetchedEntries);
      
      // Calculate stats like the student screen does
      if (fetchedEntries.length > 0) {
        const avgScore = fetchedEntries.reduce((sum, entry) => sum + entry.overallScore, 0) / fetchedEntries.length;
        
        const sortedEntries = [...fetchedEntries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const today = new Date();
        let streak = 0;
        
        for (let i = 0; i < sortedEntries.length; i++) {
          const entryDate = new Date(sortedEntries[i].date);
          const daysDiff = Math.floor((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff === i) {
            streak++;
          } else {
            break;
          }
        }

        setStats({
          currentStreak: streak,
          averageScore: Math.round(avgScore * 10) / 10,
          totalEntries: fetchedEntries.length
        });
      }
    }, (error) => {
      console.error('Error fetching wellness entries:', error);
    });

    return () => unsubscribe();
  }, [studentId, navigation]);

  // Memoized data processing for better performance
  const processedData = useMemo(() => {
    console.log('🔄 Processing wellness data:', entries.length, 'total entries');
    console.log('📅 Entries dates:', entries.map(e => e.date));
    
    if (entries.length === 0) {
      console.log('❌ No entries found');
      return {
        filteredEntries: [],
        chartData: [],
        insights: {
          trends: [],
          overallTrend: { current: 0, previous: 0, change: 0, direction: 'stable' as const },
          bestCategory: 'sleep',
          improvingCategory: null,
        },
      };
    }

    // Log first few entries to see their structure
    console.log('📊 Sample entries:', entries.slice(0, 2).map(e => ({
      date: e.date,
      rankings: e.rankings,
      overallScore: e.overallScore,
      overallMood: e.overallMood
    })));

    // Filter entries by appropriate date range for each period
    const dateFilteredEntries = filterEntriesByPeriod(entries, timeFilter);
    console.log('📅 Date filtered entries for', timeFilter, ':', dateFilteredEntries.length);
    console.log('📅 Date filtered dates:', dateFilteredEntries.map(e => e.date));
    console.log('📅 Today is:', new Date().toISOString().split('T')[0]);
    
    const filteredEntries = groupEntriesByPeriod(dateFilteredEntries, timeFilter);
    console.log('📈 Filtered entries:', filteredEntries.length);
    
    const chartData = transformEntriesForCharts(filteredEntries);
    console.log('📊 Chart data generated:', chartData.length, 'points');
    console.log('📊 Chart data sample:', chartData.slice(-2).map(d => ({ 
      date: d.date, 
      overallScore: d.overallScore,
      sleep: d.sleep,
      nutrition: d.nutrition,
      academics: d.academics,
      social: d.social 
    })));
    
    const insights = calculateWellnessInsights(dateFilteredEntries, timeFilter);

    return { filteredEntries, chartData, insights };
  }, [entries, timeFilter]);

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
          style={[styles.segment, styles.segmentFirst, timeFilter === 'daily' && styles.segmentActive]}
          onPress={() => setTimeFilter('daily')}
        >
          <Text style={[styles.segmentText, timeFilter === 'daily' && styles.segmentTextActive]}>
            Daily
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, timeFilter === 'weekly' && styles.segmentActive]}
          onPress={() => setTimeFilter('weekly')}
        >
          <Text style={[styles.segmentText, timeFilter === 'weekly' && styles.segmentTextActive]}>
            Weekly
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, styles.segmentLast, timeFilter === 'monthly' && styles.segmentActive]}
          onPress={() => setTimeFilter('monthly')}
        >
          <Text style={[styles.segmentText, timeFilter === 'monthly' && styles.segmentTextActive]}>
            Monthly
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderViewModeToggle = () => (
    <View style={styles.viewToggle}>
      <TouchableOpacity
        style={[styles.toggleButton, viewMode === 'charts' && styles.toggleButtonActive]}
        onPress={() => setViewMode('charts')}
      >
        <Text style={[styles.toggleText, viewMode === 'charts' && styles.toggleTextActive]}>
          Analytics
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
        onPress={() => setViewMode('list')}
      >
        <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>
          History
        </Text>
      </TouchableOpacity>
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{studentName}'s Wellness</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.controls}>
        {renderTimeFilter()}
        {renderViewModeToggle()}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {processedData.filteredEntries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No wellness data yet</Text>
            <Text style={styles.emptySubtitle}>
              {studentName} hasn't logged any wellness entries yet.
            </Text>
          </View>
        ) : viewMode === 'charts' ? (
          <>
            <WellnessInsightsCard 
              insights={processedData.insights} 
              period={timeFilter}
            />
            
            <WellnessLineChart
              data={processedData.chartData}
              period={timeFilter}
              title="Overall Wellness Score"
              subtitle={`${studentName}'s wellness journey over time`}
            />
            
            <CategoriesChart
              data={processedData.chartData}
              period={timeFilter}
            />
          </>
        ) : (
          <>
            {renderStatsCard()}
            <FlatList
              data={processedData.filteredEntries}
              renderItem={renderEntryItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          </>
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
  controls: {
    backgroundColor: theme.colors.backgroundCard,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 20,
    paddingBottom: 12,
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
    marginBottom: 12,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 8,
    padding: 2,
    marginTop: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  toggleTextActive: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
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
});