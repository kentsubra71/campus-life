import React, { useEffect, useState } from 'react';
import { theme } from '../../styles/theme';
import { commonStyles } from '../../styles/components';
import { 
  ScrollView, 
  RefreshControl, 
  View, 
  Text, 
  StyleSheet,
  TouchableOpacity,
  Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useWellnessStore } from '../../stores/wellnessStore';
import { useRewardsStore } from '../../stores/rewardsStore';
import { useAuthStore } from '../../stores/authStore';
// New component imports
import { HeroCard } from '../../components/cards/HeroCard';
import { StatsCard } from '../../components/cards/StatsCard';
import { ActionCard } from '../../components/cards/ActionCard';
import { ListCard } from '../../components/cards/ListCard';
import { BudgetProgressBar } from '../../components/BudgetProgressBar';

interface ParentDashboardScreenProps {
  navigation: any;
}

export const ParentDashboardScreen: React.FC<ParentDashboardScreenProps> = ({ navigation }) => {
  const { stats, todayEntry, getEntryByDate } = useWellnessStore();
  const { 
    supportMessages, 
    supportRequests,
    totalEarned,
    monthlyEarned,
    level, 
    mood,
    fetchSupportMessages,
    fetchMonthlyPayments,
    addExperience,
    acknowledgeSupport
  } = useRewardsStore();
  const { user, family, getFamilyMembers } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<{ parents: any[]; students: any[] }>({ parents: [], students: [] });
  const [selectedStudentIndex, setSelectedStudentIndex] = useState(0);

  // Helper functions
  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
  };

  const getMoodGradient = (moodText: string) => {
    switch (moodText.toLowerCase()) {
      case 'amazing':
      case 'great': return '#10b981';
      case 'okay': return '#f59e0b';
      case 'struggling':
      case 'difficult': return '#ef4444';
      default: return theme.colors.primary;
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Reload data when screen comes into focus (e.g., returning from SendSupport)
  useFocusEffect(
    React.useCallback(() => {
      if (familyMembers.students.length > 0) {
        const selectedStudent = familyMembers.students[selectedStudentIndex] || familyMembers.students[0];
        fetchSupportMessages();
        fetchMonthlyPayments(selectedStudent?.id);
      }
    }, [fetchSupportMessages, fetchMonthlyPayments, familyMembers.students.length, selectedStudentIndex])
  );

  const loadData = async () => {
    try {
      // Auto-verify any pending PayPal payments first
      if (user) {
        try {
          console.log('🔄 Auto-verifying pending PayPal payments...');
          const { autoVerifyPendingPayPalPayments } = await import('../../lib/paypalIntegration');
          const verifiedCount = await autoVerifyPendingPayPalPayments(user.id);
          if (verifiedCount > 0) {
            console.log(`✅ Auto-verified ${verifiedCount} PayPal payments on dashboard refresh`);
          }
        } catch (verifyError) {
          console.error('⚠️ Auto-verify failed on dashboard:', verifyError);
        }
      }

      console.log('🔄 Loading family members...');
      const members = await getFamilyMembers();
      console.log('👨‍👩‍👧‍👦 Family members loaded:', {
        parentsCount: members.parents.length,
        studentsCount: members.students.length,
        parents: members.parents.map(p => ({ id: p.id, name: p.name })),
        students: members.students.map(s => ({ id: s.id, name: s.name }))
      });
      
      setFamilyMembers(members);
      
      // Only fetch support data if we have students in the family
      if (members.students.length > 0) {
        const selectedStudent = members.students[selectedStudentIndex] || members.students[0];
        await Promise.all([
          fetchSupportMessages(),
          fetchMonthlyPayments(selectedStudent?.id),
          getEntryByDate(new Date().toISOString().split('T')[0])
        ]);
      }
    } catch (error) {
      console.log('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load data when selected student changes
  useEffect(() => {
    if (familyMembers.students.length > 0 && selectedStudentIndex < familyMembers.students.length) {
      const selectedStudent = familyMembers.students[selectedStudentIndex];
      // Reload data for the selected student
      getEntryByDate(new Date().toISOString().split('T')[0]);
      fetchMonthlyPayments(selectedStudent?.id);
    }
  }, [selectedStudentIndex, fetchMonthlyPayments]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getLevelTitle = (level: number) => {
    if (level <= 5) return 'Freshman';
    if (level <= 10) return 'Sophomore';
    if (level <= 15) return 'Junior';
    if (level <= 20) return 'Senior';
    return 'Graduate';
  };

  const getMoodLevel = () => {
    // Use today's entry mood if available, otherwise fallback to stored mood
    const currentMood = todayEntry?.mood || null;
    
    if (currentMood === null) return { text: 'Not logged', emoji: '❓', color: '#6b7280' };
    if (currentMood >= 9) return { text: 'Amazing', emoji: '🤩', color: '#059669' };
    if (currentMood >= 7) return { text: 'Great', emoji: '😊', color: '#10b981' };
    if (currentMood >= 5) return { text: 'Okay', emoji: '😐', color: '#d97706' };
    if (currentMood >= 3) return { text: 'Struggling', emoji: '😔', color: '#dc2626' };
    return { text: 'Difficult', emoji: '😢', color: '#991b1b' };
  };

  const sendSupportMessage = (type: 'message' | 'voice' | 'boost') => {
    // Navigate to detailed send support screen with pre-selected type and selected student
    navigation.navigate('SendSupport', { 
      preselectedType: type,
      selectedStudentId: currentStudent?.id,
      selectedStudentName: studentName,
      selectedStudentIndex: selectedStudentIndex
    });
  };

  const getWellnessStatus = () => {
    const currentStudent = familyMembers.students[selectedStudentIndex];
    const firstName = currentStudent?.name?.split(' ')[0] || 'them';
    if (!todayEntry) return { status: 'No data', color: '#6b7280', suggestion: `Check in with ${firstName}` };
    
    const score = todayEntry.wellnessScore;
    if (score >= 8) return { status: 'Thriving', color: '#10b981', suggestion: `Celebrate ${firstName}'s progress!` };
    if (score >= 6) return { status: 'Doing Well', color: '#059669', suggestion: `Send ${firstName} encouragement` };
    if (score >= 4) return { status: 'Managing', color: '#d97706', suggestion: `Offer ${firstName} gentle support` };
    return { status: 'Struggling', color: '#dc2626', suggestion: `${firstName} needs extra care` };
  };

  const copyInviteCode = async () => {
    if (family?.inviteCode) {
      await Clipboard.setStringAsync(family.inviteCode);
      Alert.alert(
        'Invite Code Copied! 📋',
        `Share this code with your college student:\n\n${family.inviteCode}\n\nThis code has been copied to your clipboard.`,
        [{ text: 'OK' }]
      );
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  // Show waiting screen if no students have joined yet
  if (familyMembers.students.length === 0) {
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
            <Text style={styles.title}>Welcome to CampusLife!</Text>
            <Text style={styles.subtitle}>Your family account is ready</Text>
          </View>

          {/* Waiting Card */}
          <View style={styles.waitingCard}>
            <View style={styles.waitingIndicator} />
            <Text style={styles.waitingTitle}>Waiting for your student to join</Text>
            <Text style={styles.waitingText}>
              Share your family invite code with your college student so they can join your CampusLife family account.
            </Text>
          </View>

          {/* Invite Code Card */}
          <TouchableOpacity style={styles.inviteCard} onPress={copyInviteCode}>
            <Text style={styles.inviteLabel}>Your Family Invite Code</Text>
            <Text style={styles.inviteCodeLarge}>{family?.inviteCode}</Text>
            <Text style={styles.inviteHint}>📋 Tap to copy and share</Text>
          </TouchableOpacity>

          {/* Instructions */}
          <View style={styles.instructionsCard}>
            <Text style={styles.instructionsTitle}>How to get started:</Text>
            <View style={styles.instructionsList}>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionNumber}>1</Text>
                <Text style={styles.instructionText}>Copy the invite code above</Text>
              </View>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionNumber}>2</Text>
                <Text style={styles.instructionText}>Send it to your college student</Text>
              </View>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionNumber}>3</Text>
                <Text style={styles.instructionText}>They'll download CampusLife and use the code to join</Text>
              </View>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionNumber}>4</Text>
                <Text style={styles.instructionText}>Once they join, you can start supporting their wellness journey!</Text>
              </View>
            </View>
          </View>

          {/* What's Coming */}
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Once your student joins, you'll be able to:</Text>
            <View style={styles.previewList}>
              <View style={styles.previewItemContainer}>
                <View style={[styles.previewDot, { backgroundColor: theme.colors.primary }]} />
                <Text style={styles.previewItem}>Send messages of love and support</Text>
              </View>
              <View style={styles.previewItemContainer}>
                <View style={[styles.previewDot, { backgroundColor: theme.colors.success }]} />
                <Text style={styles.previewItem}>See their wellness trends (when they choose to share)</Text>
              </View>
              <View style={styles.previewItemContainer}>
                <View style={[styles.previewDot, { backgroundColor: theme.colors.warning }]} />
                <Text style={styles.previewItem}>Respond when they request help</Text>
              </View>
              <View style={styles.previewItemContainer}>
                <View style={[styles.previewDot, { backgroundColor: theme.colors.success }]} />
                <Text style={styles.previewItem}>Celebrate their achievements together</Text>
              </View>
              <View style={styles.previewItemContainer}>
                <View style={[styles.previewDot, { backgroundColor: theme.colors.primary }]} />
                <Text style={styles.previewItem}>Send occasional care boosts and surprises</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Show full dashboard once students have joined
  
  // Get the selected student's information
  const currentStudent = familyMembers.students[selectedStudentIndex] || familyMembers.students[0];
  const studentName = currentStudent?.name || 'Loading...';
  const hasMultipleStudents = familyMembers.students.length > 1;
  
  // Debug logging
  console.log('🔍 Family members debug:', {
    studentsCount: familyMembers.students.length,
    hasMultipleStudents,
    students: familyMembers.students.map(s => ({ id: s.id, name: s.name }))
  });

  // Additional variables for components
  const selectedStudent = familyMembers.students[selectedStudentIndex] || familyMembers.students[0];
  const moodInfo = getMoodLevel();
  const wellnessStatus = getWellnessStatus(); 
  const wellnessScore = todayEntry?.wellnessScore; // No placeholder - use real data only

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Modern Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Hi there!</Text>
          <Text style={styles.title}>
            {hasMultipleStudents ? 'Your Kids' : studentName.split(' ')[0]}
          </Text>
          <Text style={styles.pullHint}>Pull down to refresh and verify payments</Text>
        </View>

        {/* Student Selector - Full Width Segments */}
        {hasMultipleStudents && familyMembers.students.length > 1 && (
          <View style={styles.tabContainer}>
            <View style={styles.segmentedControl}>
              {familyMembers.students.map((student, index) => (
                <TouchableOpacity
                  key={student.id}
                  style={[
                    styles.segment,
                    { flex: 1 / familyMembers.students.length },
                    selectedStudentIndex === index && styles.activeSegment
                  ]}
                  onPress={() => setSelectedStudentIndex(index)}
                >
                  <Text style={[
                    styles.segmentText,
                    selectedStudentIndex === index && styles.activeSegmentText
                  ]}>
                    {student.name.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Current Status - Clean */}
        <View style={styles.statusSection}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>
              {studentName.split(' ')[0]} is {moodInfo.text.toLowerCase()}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: getMoodGradient(moodInfo.text) }]}>
              <Text style={styles.statusBadgeText}>{wellnessStatus.status}</Text>
            </View>
          </View>
          <Text style={styles.statusSubtitle}>{wellnessStatus.suggestion}</Text>
          <TouchableOpacity 
            style={styles.statusAction}
            onPress={() => navigation.navigate('ChildWellness', { studentId: selectedStudent.id })}
          >
            <Text style={styles.statusActionText}>View detailed wellness →</Text>
          </TouchableOpacity>
        </View>

        {/* Urgent Support Requests */}
        {supportRequests.filter(req => !req.acknowledged).length > 0 && (
          <View style={styles.urgentSection}>
            <HeroCard
              title="🚨 Support Needed"
              subtitle={`${supportRequests.filter(req => !req.acknowledged).length} unread requests`}
              backgroundColor="#ef4444"
              textColor="#ffffff"
              onPress={() => acknowledgeSupport(supportRequests.filter(req => !req.acknowledged)[0]?.id)}
              actionText="Acknowledge & respond"
            >
              <View style={styles.urgentMessages}>
                {supportRequests
                  .filter(req => !req.acknowledged)
                  .slice(0, 2)
                  .map((request) => (
                    <Text key={request.id} style={styles.urgentMessageText}>
                      "{request.message}"
                    </Text>
                  ))
                }
              </View>
            </HeroCard>
          </View>
        )}

        {/* Key Metrics - Mixed Layout */}
        <View style={styles.metricsSection}>
          {wellnessScore && (
            <View style={styles.metricItem}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricLabel}>Today's Wellness</Text>
                <Text style={styles.metricValue}>{wellnessScore}/10</Text>
              </View>
              <Text style={[styles.metricTag, { 
                color: wellnessScore > 7 ? theme.colors.success : wellnessScore < 5 ? theme.colors.error : theme.colors.warning 
              }]}>
                {wellnessScore > 7 ? 'Great day!' : wellnessScore < 5 ? 'Needs support' : 'Doing okay'}
              </Text>
            </View>
          )}
          
          {/* Budget Progress - Inline Style */}
          <View style={styles.budgetItem}>
            <View style={styles.budgetHeader}>
              <Text style={styles.metricLabel}>Monthly Budget</Text>
              <Text style={styles.budgetRemaining}>${Math.max(0, 50 - (monthlyEarned || 0))} left</Text>
            </View>
            <View style={styles.budgetBarContainer}>
              <View style={styles.budgetBar}>
                <View 
                  style={[styles.budgetFill, { 
                    width: `${Math.min(100, ((monthlyEarned || 0) / 50) * 100)}%` 
                  }]} 
                />
              </View>
              <Text style={styles.budgetText}>
                ${monthlyEarned || 0} of $50 used
              </Text>
            </View>
          </View>
        </View>

        {/* Actions - Mixed Layout */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          {/* Primary Action - Prominent */}
          <TouchableOpacity 
            style={styles.primaryAction}
            onPress={() => sendSupportMessage('message')}
          >
            <View style={styles.primaryActionContent}>
              <View style={styles.primaryActionIcon}>
                <View style={styles.primaryActionIndicator} />
              </View>
              <View style={styles.primaryActionText}>
                <Text style={styles.primaryActionTitle}>Send Support</Text>
                <Text style={styles.primaryActionSubtitle}>Message or money to help your kid</Text>
              </View>
            </View>
          </TouchableOpacity>
          
          {/* Secondary Actions - Clean List */}
          <View style={styles.secondaryActions}>
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => sendSupportMessage('boost')}
            >
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>$5 Boost</Text>
                <Text style={styles.actionSubtitle}>Quick money</Text>
              </View>
              <View style={styles.actionBadge}>
                <Text style={styles.actionBadgeText}>Send</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => navigation.navigate('ChildWellness', { studentId: selectedStudent.id })}
            >
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Check Wellness</Text>
                <Text style={styles.actionSubtitle}>Full details</Text>
              </View>
              <Text style={styles.actionArrow}>›</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => navigation.navigate('PayPalTest')}
            >
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>PayPal Test</Text>
                <Text style={styles.actionSubtitle}>Development testing</Text>
              </View>
              <View style={styles.devBadge}>
                <Text style={styles.devBadgeText}>DEV</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity - Clean List */}
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          
          {wellnessScore && (
            <TouchableOpacity 
              style={styles.activityItem}
              onPress={() => navigation.navigate('ChildWellness', { studentId: selectedStudent.id })}
            >
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Wellness Check</Text>
                <Text style={styles.activitySubtitle}>{wellnessScore}/10 score today</Text>
              </View>
              <Text style={[styles.activityScore, {
                color: wellnessScore > 7 ? theme.colors.success : wellnessScore < 5 ? theme.colors.warning : theme.colors.primary
              }]}>
                {wellnessScore}/10
              </Text>
            </TouchableOpacity>
          )}
          
          {(supportMessages.length > 0 || monthlyEarned > 0) && (
            <TouchableOpacity 
              style={styles.activityItem}
              onPress={() => navigation.navigate('Activity')}
            >
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Monthly Summary</Text>
                <Text style={styles.activitySubtitle}>{supportMessages.length} messages • ${monthlyEarned || 0} sent</Text>
              </View>
              <Text style={styles.activityAction}>View All</Text>
            </TouchableOpacity>
          )}
          
          {familyMembers.students.length > 1 && (
            <TouchableOpacity 
              style={styles.activityItem}
              onPress={() => setSelectedStudentIndex((prev) => (prev + 1) % familyMembers.students.length)}
            >
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Switch Student View</Text>
                <Text style={styles.activitySubtitle}>{familyMembers.students.length} children in family</Text>
              </View>
              <Text style={styles.activityAction}>Switch</Text>
            </TouchableOpacity>
          )}
          
          {/* If no real activity, show helpful message */}
          {!wellnessScore && supportMessages.length === 0 && monthlyEarned === 0 && (
            <View style={styles.activityItem}>
              <View style={[styles.activityIndicator, { backgroundColor: theme.colors.backgroundTertiary }]} />
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>No activity yet</Text>
                <Text style={styles.activitySubtitle}>Your family is just getting started!</Text>
              </View>
            </View>
          )}
        </View>
        {/* Wellness */}
        <View style={styles.wellnessSection}>
          <Text style={styles.sectionHeader}>Wellness Check-in</Text>
          <TouchableOpacity 
            style={styles.wellnessContainer}
            onPress={() => navigation.navigate('ChildWellness', { 
              selectedStudentId: currentStudent?.id,
              selectedStudentName: studentName 
            })}
          >
            {stats.totalEntries === 0 ? (
              <Text style={styles.wellnessText}>
                {studentName.split(' ')[0]} hasn't started tracking wellness yet
              </Text>
            ) : (
              <Text style={styles.wellnessText}>
                {studentName.split(' ')[0]} has a {stats.currentStreak} day streak with a {stats.averageScore}/10 average
              </Text>
            )}
            <Text style={styles.tapHint}>→</Text>
          </TouchableOpacity>
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
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    letterSpacing: -1,
  },

  // Segmented Control System
  tabContainer: {
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
  
  // Stats Section
  statsSection: {
    paddingHorizontal: 24,
    gap: 12,
  },
  
  // Actions Section
  actionsSection: {
    paddingHorizontal: 24,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  mediumActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  testSection: {
    marginTop: 12,
  },
  
  // Recent Activity
  recentSection: {
    paddingHorizontal: 24,
    marginTop: 24,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  activityScore: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
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
  activityAction: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  
  // Urgent Section
  urgentSection: {
    paddingHorizontal: 24,
  },
  urgentMessages: {
    marginTop: 12,
    gap: 8,
  },
  urgentMessageText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
    fontStyle: 'italic',
  },
  
  // Bottom spacing
  bottomSpacing: {
    height: 100,
  },
  
  // Status Section - No Card
  statusSection: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    marginBottom: 8,
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
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusSubtitle: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  statusAction: {
    alignSelf: 'flex-start',
  },
  statusActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  
  // Metrics Section - Mixed Layout
  metricsSection: {
    paddingHorizontal: 24,
    gap: 16,
    marginBottom: 8,
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
  
  // Budget Item - Inline Style
  budgetItem: {
    paddingVertical: 12,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  budgetRemaining: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.success,
  },
  budgetBarContainer: {
    gap: 6,
  },
  budgetBar: {
    height: 6,
    backgroundColor: theme.colors.backgroundTertiary,
    borderRadius: 3,
  },
  budgetFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  budgetText: {
    fontSize: 12,
    color: theme.colors.textTertiary,
  },
  
  // Primary Action - Prominent
  primaryAction: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    backgroundColor: theme.colors.primary,
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
  actionSquare: {
    width: 8,
    height: 8,
    marginRight: 12,
  },
  actionTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginRight: 12,
    marginLeft: 4,
  },
  actionLine: {
    width: 16,
    height: 2,
    marginRight: 12,
    marginLeft: -4,
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
  actionBadge: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  actionArrow: {
    fontSize: 18,
    color: theme.colors.textTertiary,
    fontWeight: '300',
  },
  devBadge: {
    backgroundColor: theme.colors.textSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  devBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  
  // Missing styles for loading and waiting states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 18,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginBottom: 8,
  },
  waitingCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 24,
    marginBottom: 20,
    alignItems: 'center',
  },
  waitingIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    marginBottom: 16,
  },
  waitingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  waitingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  inviteCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 24,
    marginBottom: 20,
    alignItems: 'center',
  },
  inviteLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  inviteCodeLarge: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 2,
    marginBottom: 12,
  },
  inviteHint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  instructionsCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 20,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  instructionsList: {
    gap: 12,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  instructionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 28,
  },
  instructionText: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  previewCard: {
    backgroundColor: theme.colors.backgroundTertiary,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 20,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  previewList: {
    gap: 12,
  },
  previewItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 12,
  },
  previewItem: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    lineHeight: 20,
    flex: 1,
  },
  
  // Missing action card styles for the old duplicate component (removed)
  actionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 8,
    flex: 1,
  },
  actionEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
});
