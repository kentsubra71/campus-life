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
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useWellnessStore } from '../../stores/wellnessStore';
import { useRewardsStore } from '../../stores/rewardsStore';
import { useAuthStore } from '../../stores/authStore';

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
  const { family, getFamilyMembers } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<{ parents: any[]; students: any[] }>({ parents: [], students: [] });
  const [selectedStudentIndex, setSelectedStudentIndex] = useState(0);

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
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
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
            <Text style={styles.waitingEmoji}>👨‍👩‍👧‍👦</Text>
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
              <Text style={styles.previewItem}>💙 Send messages of love and support</Text>
              <Text style={styles.previewItem}>📊 See their wellness trends (when they choose to share)</Text>
              <Text style={styles.previewItem}>🚨 Respond when they request help</Text>
              <Text style={styles.previewItem}>🎉 Celebrate their achievements together</Text>
              <Text style={styles.previewItem}>✨ Send occasional care boosts and surprises</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Show full dashboard once students have joined
  const wellnessStatus = getWellnessStatus();
  const moodInfo = getMoodLevel();
  
  // Get the selected student's information
  const currentStudent = familyMembers.students[selectedStudentIndex];
  const studentName = currentStudent?.name || (familyMembers.students[0]?.name) || 'Loading...';
  const hasMultipleStudents = familyMembers.students.length > 1;
  
  // Debug logging
  console.log('🔍 Family members debug:', {
    studentsCount: familyMembers.students.length,
    hasMultipleStudents,
    students: familyMembers.students.map(s => ({ id: s.id, name: s.name }))
  });

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
          <Text style={styles.greeting}>Hi there!</Text>
          <Text style={styles.title}>
            {hasMultipleStudents ? 'Your Kids' : studentName.split(' ')[0]}
          </Text>
        </View>

        {/* Student Tabs - Only show if multiple students */}
        {hasMultipleStudents && familyMembers.students.length > 1 && (
          <View style={styles.studentTabs}>
            {familyMembers.students.map((student, index) => (
              <TouchableOpacity
                key={student.id}
                style={[
                  styles.tab,
                  selectedStudentIndex === index && styles.activeTab
                ]}
                onPress={() => setSelectedStudentIndex(index)}
              >
                <Text style={[
                  styles.tabText,
                  selectedStudentIndex === index && styles.activeTabText
                ]}>
                  {student.name.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Current Status */}
        <View style={styles.statusSection}>
          <Text style={styles.currentMood}>
            {moodInfo.emoji} {studentName.split(' ')[0]} is feeling {moodInfo.text.toLowerCase()} today
          </Text>
          <Text style={styles.suggestion}>{wellnessStatus.suggestion}</Text>
        </View>

        {/* Support Requests - Priority Alert */}
        {supportRequests.filter(req => !req.acknowledged).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.urgentTitle}>🚨 Support Needed</Text>
            {supportRequests
              .filter(req => !req.acknowledged)
              .slice(0, 2)
              .map((request) => (
                <TouchableOpacity 
                  key={request.id} 
                  style={styles.urgentCard}
                  onPress={() => acknowledgeSupport(request.id)}
                >
                  <View style={styles.urgentHeader}>
                    <Text style={styles.urgentMessage}>{request.message}</Text>
                    <Text style={styles.urgentTime}>
                      {new Date(request.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </Text>
                  </View>
                  <Text style={styles.urgentAction}>Tap to acknowledge → Send support now</Text>
                </TouchableOpacity>
              ))
            }
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionHeader}>Send Support</Text>
          <TouchableOpacity 
            style={styles.actionRow}
            onPress={() => sendSupportMessage('message')}
          >
            <Text style={styles.actionEmoji}>💌</Text>
            <Text style={styles.actionLabel}>Send a message</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionRow}
            onPress={() => sendSupportMessage('boost')}
          >
            <Text style={styles.actionEmoji}>✨</Text>
            <Text style={styles.actionLabel}>Send $5 boost</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionRow}
            onPress={() => navigation.navigate('PayPalTest')}
          >
            <Text style={styles.actionEmoji}>🔧</Text>
            <Text style={styles.actionLabel}>PayPal Test</Text>
          </TouchableOpacity>
        </View>

        {/* Monthly Summary */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionHeader}>This Month</Text>
          <Text style={styles.summaryText}>
            You've sent {supportMessages.length} messages and ${monthlyEarned} in care boosts
          </Text>
          <View style={styles.budgetContainer}>
            <View style={styles.budgetBar}>
              <View 
                style={[styles.budgetFill, { width: `${(monthlyEarned / 50) * 100}%` }]} 
              />
            </View>
            <Text style={styles.budgetText}>${50 - monthlyEarned} remaining in monthly budget</Text>
          </View>
        </View>

        {/* Wellness */}
        <TouchableOpacity 
          style={styles.wellnessSection}
          onPress={() => navigation.navigate('ChildWellness', { 
            selectedStudentId: currentStudent?.id,
            selectedStudentName: studentName 
          })}
        >
          <Text style={styles.sectionHeader}>Wellness Check-in</Text>
          {stats.totalEntries === 0 ? (
            <Text style={styles.wellnessText}>
              {studentName.split(' ')[0]} hasn't started tracking wellness yet
            </Text>
          ) : (
            <Text style={styles.wellnessText}>
              {studentName.split(' ')[0]} has a {stats.currentStreak} day streak with a {stats.averageScore}/10 average
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContainer: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
  },
  header: {
    padding: 24,
    paddingTop: 60,
  },
  greeting: {
    fontSize: 16,
    color: '#a855f7',
    fontWeight: '400',
    marginBottom: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: '600',
    color: '#ffffff',
  },
  statusSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  currentMood: {
    fontSize: 18,
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: 8,
  },
  suggestion: {
    fontSize: 15,
    color: '#888888',
  },
  studentTabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#a855f7',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#888888',
  },
  activeTabText: {
    color: '#ffffff',
  },
  actionsSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  actionEmoji: {
    fontSize: 20,
    marginRight: 16,
    width: 24,
  },
  actionLabel: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '400',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#a855f7',
    marginBottom: 8,
  },
  summarySection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  summaryText: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 12,
  },
  budgetContainer: {
    marginTop: 8,
  },
  budgetBar: {
    height: 4,
    backgroundColor: '#2a2a2a',
    borderRadius: 2,
    marginBottom: 8,
  },
  budgetFill: {
    height: '100%',
    backgroundColor: '#a855f7',
    borderRadius: 2,
  },
  budgetText: {
    fontSize: 13,
    color: '#888888',
  },
  wellnessSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  wellnessText: {
    fontSize: 16,
    color: '#ffffff',
  },
  urgentTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#dc2626',
    marginBottom: 16,
    textAlign: 'center',
  },
  urgentCard: {
    backgroundColor: '#991b1b',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#dc2626',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  urgentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  urgentMessage: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
  },
  urgentTime: {
    fontSize: 14,
    color: '#fca5a5',
    fontWeight: '600',
  },
  urgentAction: {
    fontSize: 14,
    color: '#fca5a5',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  waitingCard: {
    backgroundColor: '#ffffff',
    margin: 20,
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  waitingEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  waitingTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'System',
  },
  waitingText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'System',
  },
  inviteCard: {
    backgroundColor: '#3b82f6',
    margin: 20,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  inviteLabel: {
    fontSize: 14,
    color: '#dbeafe',
    marginBottom: 12,
    fontWeight: '600',
    fontFamily: 'System',
  },
  inviteCodeLarge: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 4,
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'System',
  },
  inviteHint: {
    fontSize: 12,
    color: '#93c5fd',
    fontStyle: 'italic',
    fontFamily: 'System',
  },
  instructionsCard: {
    backgroundColor: '#ffffff',
    margin: 20,
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
    fontFamily: 'System',
  },
  instructionsList: {
    gap: 12,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  instructionNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    backgroundColor: '#3b82f6',
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    fontFamily: 'System',
  },
  previewCard: {
    backgroundColor: '#10b981',
    margin: 20,
    padding: 24,
    borderRadius: 16,
    marginBottom: 40,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 16,
    fontFamily: 'System',
  },
  previewList: {
    gap: 8,
  },
  previewItem: {
    fontSize: 14,
    color: '#d1fae5',
    lineHeight: 20,
    fontFamily: 'System',
  },
  // Compact student selector styles
  compactStudentSelector: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  compactTab: {
    backgroundColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  compactTabActive: {
    backgroundColor: '#6366f1',
  },
  compactTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#d1d5db',
    textAlign: 'center',
  },
  compactTabTextActive: {
    color: '#ffffff',
  },
  multipleStudentNote: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
});