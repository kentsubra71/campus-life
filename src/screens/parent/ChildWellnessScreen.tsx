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
import { useAuthStore } from '../../stores/authStore';
import { theme } from '../../styles/theme';

interface ChildWellnessScreenProps {
  navigation: any;
}

export const ChildWellnessScreen: React.FC<ChildWellnessScreenProps> = ({ navigation }) => {
  const { stats, todayEntry, entries, loadEntries } = useWellnessStore();
  const { getFamilyMembers } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [familyMembers, setFamilyMembers] = useState<{ parents: any[]; students: any[] }>({ parents: [], students: [] });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const members = await getFamilyMembers();
      setFamilyMembers(members);
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
    if (score >= 8.5) return { label: 'Excellent', color: theme.colors.success };
    if (score >= 7) return { label: 'Good', color: theme.colors.success };
    if (score >= 5.5) return { label: 'Fair', color: theme.colors.warning };
    if (score >= 4) return { label: 'Concerning', color: theme.colors.error };
    return { label: 'Struggling', color: theme.colors.error };
  };

  const getMoodLevel = (mood: number) => {
    if (mood >= 9) return { text: 'Amazing', color: theme.colors.success };
    if (mood >= 7) return { text: 'Great', color: theme.colors.success };
    if (mood >= 5) return { text: 'Okay', color: theme.colors.warning };
    if (mood >= 3) return { text: 'Struggling', color: theme.colors.error };
    return { text: 'Difficult', color: theme.colors.error };
  };

  const getSupportSuggestion = (entry: any) => {
    const suggestions = [];
    
    if (entry.sleep < 6) suggestions.push({ text: 'Encourage better sleep routine', area: 'sleep' });
    if (entry.exercise < 30) suggestions.push({ text: 'Suggest fun physical activity', area: 'exercise' });
    if (entry.nutrition < 6) suggestions.push({ text: 'Check in about eating habits', area: 'nutrition' });
    if (entry.social < 5) suggestions.push({ text: 'Ask about friendships and social time', area: 'social' });
    if (entry.academic < 5) suggestions.push({ text: 'Offer academic support', area: 'academic' });
    if (entry.mood < 5) suggestions.push({ text: 'Extra emotional support needed', area: 'mood' });
    
    return suggestions;
  };

  const sendEncouragement = (area: string) => {
    const studentName = familyMembers.students[0]?.name || 'your student';
    Alert.alert(
      'Encouragement Sent!',
      `You sent supportive encouragement about ${area} to ${studentName}.`,
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
          <Text style={styles.title}>{familyMembers.students[0]?.name || 'Student'}'s Wellness</Text>
          <Text style={styles.subtitle}>Understanding how they're doing</Text>
        </View>

        {/* Period Filter - Segmented Control */}
        <View style={styles.filterContainer}>
          <View style={styles.segmentedControl}>
            <TouchableOpacity 
              style={[styles.segment, selectedPeriod === 'week' && styles.activeSegment]}
              onPress={() => setSelectedPeriod('week')}
            >
              <Text style={[styles.segmentText, selectedPeriod === 'week' && styles.activeSegmentText]}>
                Week
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.segment, selectedPeriod === 'month' && styles.activeSegment]}
              onPress={() => setSelectedPeriod('month')}
            >
              <Text style={[styles.segmentText, selectedPeriod === 'month' && styles.activeSegmentText]}>
                Month
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.segment, selectedPeriod === 'all' && styles.activeSegment]}
              onPress={() => setSelectedPeriod('all')}
            >
              <Text style={[styles.segmentText, selectedPeriod === 'all' && styles.activeSegmentText]}>
                All Time
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Overall Status - Clean Layout */}
        <View style={styles.overallSection}>
          <View style={styles.overallHeader}>
            <Text style={styles.overallTitle}>Overall Wellness</Text>
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreNumber}>{averageScore.toFixed(1)}</Text>
              <Text style={styles.scoreMax}>/10</Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: getWellnessCategory(averageScore).color }]}>
              <Text style={styles.statusBadgeText}>{getWellnessCategory(averageScore).label}</Text>
            </View>
            <Text style={styles.statusSubtext}>
              Based on {filteredEntries.length} recent entries
            </Text>
          </View>
        </View>

        {/* Today's Entry - Clean Layout */}
        {todayEntry && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Check-in</Text>
            
            {/* Wellness & Mood */}
            <View style={styles.metricRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Wellness Score</Text>
                <Text style={[styles.metricValue, { color: getWellnessCategory(todayEntry.wellnessScore).color }]}>
                  {todayEntry.wellnessScore.toFixed(1)}/10
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Mood</Text>
                <Text style={[styles.metricValue, { color: getMoodLevel(todayEntry.mood).color }]}>
                  {todayEntry.mood}/10
                </Text>
              </View>
            </View>
            
            {/* Details List */}
            <View style={styles.detailsList}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Sleep</Text>
                <Text style={styles.detailValue}>{todayEntry.sleep} hours</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Exercise</Text>
                <Text style={styles.detailValue}>{todayEntry.exercise} minutes</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Nutrition</Text>
                <Text style={styles.detailValue}>{todayEntry.nutrition}/10</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Social</Text>
                <Text style={styles.detailValue}>{todayEntry.social}/10</Text>
              </View>
            </View>

            {todayEntry.notes && (
              <View style={styles.notesSection}>
                <Text style={styles.notesLabel}>Today's Note</Text>
                <Text style={styles.notesText}>"{todayEntry.notes}"</Text>
              </View>
            )}

            {/* Support Suggestions */}
            {getSupportSuggestion(todayEntry).length > 0 && (
              <View style={styles.suggestionsSection}>
                <Text style={styles.suggestionsTitle}>Ways to Help</Text>
                {getSupportSuggestion(todayEntry).map((suggestion, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.suggestionItem}
                    onPress={() => sendEncouragement(suggestion.area)}
                  >
                    <Text style={styles.suggestionText}>{suggestion.text}</Text>
                    <Text style={styles.suggestionArrow}>→</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Wellness Trends - Clean List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wellness Trends</Text>
          <View style={styles.trendsList}>
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

        {/* Recent Entries - Clean List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Wellness Entries</Text>
          {filteredEntries.slice(0, 7).map((entry, index) => {
            const category = getWellnessCategory(entry.wellnessScore);
            const moodLevel = getMoodLevel(entry.mood);
            return (
              <View key={entry.date} style={styles.entryItem}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryDate}>
                    {new Date(entry.date).toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </Text>
                  <Text style={[styles.entryScore, { color: category.color }]}>
                    {entry.wellnessScore.toFixed(1)}/10
                  </Text>
                </View>
                <View style={styles.entryMetrics}>
                  <Text style={styles.entryDetail}>
                    {entry.sleep}h sleep • {entry.exercise}m exercise • {entry.nutrition}/10 nutrition • {entry.social}/10 social
                  </Text>
                  <Text style={styles.entryMood}>
                    Mood: <Text style={{ color: moodLevel.color }}>{entry.mood}/10</Text>
                  </Text>
                </View>
                {entry.notes && (
                  <Text style={styles.entryNotes}>"{entry.notes}"</Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Support Actions - Clean */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Send Support</Text>
          <View style={styles.supportActionsList}>
            <TouchableOpacity 
              style={styles.supportActionItem}
              onPress={() => sendEncouragement('overall wellness')}
            >
              <Text style={styles.supportActionText}>Send Encouragement</Text>
              <View style={styles.supportActionBadge}>
                <Text style={styles.supportActionBadgeText}>Send</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.supportActionItem}
              onPress={() => navigation.navigate('SendSupport')}
            >
              <Text style={styles.supportActionText}>Send Message or Money</Text>
              <Text style={styles.supportActionArrow}>→</Text>
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
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 6,
  },
  // Segmented Control
  filterContainer: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  activeSegment: {
    backgroundColor: theme.colors.secondary,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  activeSegmentText: {
    color: theme.colors.primaryDark,
    fontWeight: '600',
  },
  // Overall Status - Clean Layout
  overallSection: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  overallHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  overallTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  scoreMax: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginLeft: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusSubtext: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  
  // Today's Entry Metrics
  metricRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  
  // Details List
  detailsList: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  detailLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  
  // Notes Section
  notesSection: {
    backgroundColor: theme.colors.backgroundTertiary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  notesText: {
    fontSize: 15,
    color: theme.colors.textPrimary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  
  // Suggestions Section
  suggestionsSection: {
    marginTop: 16,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  suggestionText: {
    fontSize: 15,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  suggestionArrow: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  
  // Trends List
  trendsList: {
    gap: 4,
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  trendLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  trendValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  
  // Entry Items
  entryItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entryDate: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  entryScore: {
    fontSize: 16,
    fontWeight: '700',
  },
  entryMetrics: {
    gap: 4,
  },
  entryDetail: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  entryMood: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  entryNotes: {
    fontSize: 13,
    color: theme.colors.textTertiary,
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  
  // Support Actions
  supportActionsList: {
    gap: 4,
  },
  supportActionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  supportActionText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    flex: 1,
  },
  supportActionBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  supportActionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  supportActionArrow: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});