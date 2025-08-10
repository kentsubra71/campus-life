import React, { useEffect, useState } from 'react';
import { 
  ScrollView, 
  RefreshControl, 
  View, 
  Text, 
  StyleSheet,
  TouchableOpacity,
  Alert
} from 'react-native';
import { useWellnessStore } from '../../stores/wellnessStore';

interface ChildWellnessScreenProps {
  navigation: any;
}

export const ChildWellnessScreen: React.FC<ChildWellnessScreenProps> = ({ navigation }) => {
  const { stats, todayEntry, entries, loadEntries } = useWellnessStore();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'all'>('week');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await loadEntries();
    } catch (error) {
      console.log('Error loading wellness data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getFilteredEntries = () => {
    const now = new Date();
    const cutoffDate = new Date();
    
    switch (selectedPeriod) {
      case 'week':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case 'all':
        return entries;
    }
    
    return entries.filter(entry => new Date(entry.date) >= cutoffDate);
  };

  const getWellnessCategory = (score: number) => {
    if (score >= 8.5) return { label: 'Excellent', color: '#10b981', emoji: '🌟' };
    if (score >= 7) return { label: 'Good', color: '#059669', emoji: '😊' };
    if (score >= 5.5) return { label: 'Fair', color: '#d97706', emoji: '😐' };
    if (score >= 4) return { label: 'Concerning', color: '#dc2626', emoji: '😟' };
    return { label: 'Struggling', color: '#991b1b', emoji: '😔' };
  };

  const getMoodEmoji = (mood: number) => {
    if (mood >= 9) return '😄';
    if (mood >= 7) return '😊';
    if (mood >= 5) return '😐';
    if (mood >= 3) return '😟';
    return '😢';
  };

  const getSupportSuggestion = (entry: any) => {
    const suggestions = [];
    
    if (entry.sleep < 6) suggestions.push('💤 Encourage better sleep routine');
    if (entry.exercise < 30) suggestions.push('🏃 Suggest fun physical activity');
    if (entry.nutrition < 6) suggestions.push('🥗 Check in about eating habits');
    if (entry.social < 5) suggestions.push('👥 Ask about friendships and social time');
    if (entry.academic < 5) suggestions.push('📚 Offer academic support');
    if (entry.mood < 5) suggestions.push('💙 Extra emotional support needed');
    
    return suggestions;
  };

  const sendEncouragement = (area: string) => {
    Alert.alert(
      'Encouragement Sent!',
      `You sent supportive encouragement about ${area} to Sarah.`,
      [{ text: 'OK' }]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading wellness data...</Text>
      </View>
    );
  }

  const filteredEntries = getFilteredEntries();
  const averageScore = filteredEntries.length > 0 
    ? filteredEntries.reduce((sum, entry) => sum + entry.wellnessScore, 0) / filteredEntries.length 
    : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Sarah's Wellness</Text>
          <Text style={styles.subtitle}>Understanding how she's doing</Text>
        </View>

        {/* Period Filter */}
        <View style={styles.filterContainer}>
          <TouchableOpacity 
            style={[styles.filterButton, selectedPeriod === 'week' && styles.filterButtonActive]}
            onPress={() => setSelectedPeriod('week')}
          >
            <Text style={[styles.filterText, selectedPeriod === 'week' && styles.filterTextActive]}>
              Past Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, selectedPeriod === 'month' && styles.filterButtonActive]}
            onPress={() => setSelectedPeriod('month')}
          >
            <Text style={[styles.filterText, selectedPeriod === 'month' && styles.filterTextActive]}>
              Past Month
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, selectedPeriod === 'all' && styles.filterButtonActive]}
            onPress={() => setSelectedPeriod('all')}
          >
            <Text style={[styles.filterText, selectedPeriod === 'all' && styles.filterTextActive]}>
              All Time
            </Text>
          </TouchableOpacity>
        </View>

        {/* Overall Status */}
        <View style={styles.overallCard}>
          <Text style={styles.overallTitle}>Overall Wellness</Text>
          <View style={styles.overallContent}>
            <View style={styles.overallScore}>
              <Text style={styles.scoreNumber}>{averageScore.toFixed(1)}</Text>
              <Text style={styles.scoreMax}>/10</Text>
            </View>
            <View style={styles.overallStatus}>
              <Text style={[styles.statusText, { color: getWellnessCategory(averageScore).color }]}>
                {getWellnessCategory(averageScore).emoji} {getWellnessCategory(averageScore).label}
              </Text>
              <Text style={styles.statusSubtext}>
                Based on {filteredEntries.length} recent entries
              </Text>
            </View>
          </View>
        </View>

        {/* Today's Entry (if exists) */}
        {todayEntry && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Check-in</Text>
            <View style={styles.todayCard}>
              <View style={styles.todayHeader}>
                <Text style={styles.todayWellness}>
                  Wellness Score: {todayEntry.wellnessScore.toFixed(1)}/10
                </Text>
                <Text style={styles.todayMood}>
                  Mood: {getMoodEmoji(todayEntry.mood)} {todayEntry.mood}/10
                </Text>
              </View>
              
              <View style={styles.todayDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Sleep:</Text>
                  <Text style={styles.detailValue}>{todayEntry.sleep} hours</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Exercise:</Text>
                  <Text style={styles.detailValue}>{todayEntry.exercise} minutes</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Nutrition:</Text>
                  <Text style={styles.detailValue}>{todayEntry.nutrition}/10</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Social:</Text>
                  <Text style={styles.detailValue}>{todayEntry.social}/10</Text>
                </View>
              </View>

              {todayEntry.notes && (
                <View style={styles.notesContainer}>
                  <Text style={styles.notesLabel}>Today's Note:</Text>
                  <Text style={styles.notesText}>"{todayEntry.notes}"</Text>
                </View>
              )}

              {/* Support Suggestions */}
              {getSupportSuggestion(todayEntry).length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <Text style={styles.suggestionsTitle}>💡 Ways to Help:</Text>
                  {getSupportSuggestion(todayEntry).map((suggestion, index) => (
                    <TouchableOpacity 
                      key={index} 
                      style={styles.suggestionItem}
                      onPress={() => sendEncouragement(suggestion.split(' ')[1])}
                    >
                      <Text style={styles.suggestionText}>{suggestion}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Wellness Trends */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wellness Trends</Text>
          <View style={styles.trendsCard}>
            <View style={styles.trendRow}>
              <Text style={styles.trendLabel}>Current Streak</Text>
              <Text style={styles.trendValue}>{stats.currentStreak} days</Text>
            </View>
            <View style={styles.trendRow}>
              <Text style={styles.trendLabel}>Total Entries</Text>
              <Text style={styles.trendValue}>{filteredEntries.length}</Text>
            </View>
            <View style={styles.trendRow}>
              <Text style={styles.trendLabel}>Best Streak</Text>
              <Text style={styles.trendValue}>{stats.bestStreak || stats.currentStreak} days</Text>
            </View>
          </View>
        </View>

        {/* Recent Entries */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Wellness Entries</Text>
          {filteredEntries.slice(0, 7).map((entry, index) => {
            const category = getWellnessCategory(entry.wellnessScore);
            return (
              <View key={entry.date} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryDate}>
                    {new Date(entry.date).toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </Text>
                  <View style={styles.entryScore}>
                    <Text style={[styles.entryScoreText, { color: category.color }]}>
                      {category.emoji} {entry.wellnessScore.toFixed(1)}
                    </Text>
                  </View>
                </View>
                <View style={styles.entryDetails}>
                  <Text style={styles.entryDetail}>
                    😴 {entry.sleep}h  🏃 {entry.exercise}m  🥗 {entry.nutrition}/10  👥 {entry.social}/10
                  </Text>
                  <Text style={styles.entryMood}>
                    Mood: {getMoodEmoji(entry.mood)} {entry.mood}/10
                  </Text>
                </View>
                {entry.notes && (
                  <Text style={styles.entryNotes}>"{entry.notes}"</Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Support Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Send Support</Text>
          <View style={styles.supportActions}>
            <TouchableOpacity 
              style={styles.supportAction}
              onPress={() => sendEncouragement('overall wellness')}
            >
              <Text style={styles.supportActionText}>💙 Send Encouragement</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.supportAction}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.supportActionText}>📱 Check in with Call</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  scrollContainer: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  loadingText: {
    color: '#f9fafb',
    fontSize: 16,
  },
  header: {
    padding: 24,
    paddingTop: 60,
  },
  backButton: {
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '600',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f9fafb',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 6,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  filterButton: {
    flex: 1,
    padding: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#1f2937',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  filterText: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  overallCard: {
    backgroundColor: '#1f2937',
    margin: 20,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  overallTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 16,
  },
  overallContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overallScore: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: 24,
  },
  scoreNumber: {
    fontSize: 36,
    fontWeight: '800',
    color: '#f9fafb',
  },
  scoreMax: {
    fontSize: 18,
    color: '#9ca3af',
    marginLeft: 4,
  },
  overallStatus: {
    flex: 1,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusSubtext: {
    fontSize: 12,
    color: '#9ca3af',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 16,
  },
  todayCard: {
    backgroundColor: '#1f2937',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  todayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  todayWellness: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
  },
  todayMood: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
  },
  todayDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#f9fafb',
    fontWeight: '600',
  },
  notesContainer: {
    backgroundColor: '#374151',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  notesLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#f9fafb',
    fontStyle: 'italic',
  },
  suggestionsContainer: {
    backgroundColor: '#1e40af',
    padding: 16,
    borderRadius: 8,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
  },
  suggestionItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  suggestionText: {
    fontSize: 12,
    color: '#ffffff',
  },
  trendsCard: {
    backgroundColor: '#1f2937',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trendLabel: {
    fontSize: 16,
    color: '#9ca3af',
    fontWeight: '500',
  },
  trendValue: {
    fontSize: 16,
    color: '#f9fafb',
    fontWeight: '700',
  },
  entryCard: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entryDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f9fafb',
  },
  entryScore: {
    backgroundColor: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  entryScoreText: {
    fontSize: 14,
    fontWeight: '700',
  },
  entryDetails: {
    marginBottom: 8,
  },
  entryDetail: {
    fontSize: 12,
    color: '#d1d5db',
    marginBottom: 4,
  },
  entryMood: {
    fontSize: 12,
    color: '#d1d5db',
  },
  entryNotes: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  supportActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  supportAction: {
    flex: 1,
    backgroundColor: '#1e40af',
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  supportActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});