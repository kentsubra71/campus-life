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
    addExperience,
    acknowledgeSupport
  } = useRewardsStore();
  const { family, getFamilyMembers } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<{ parents: any[]; students: any[] }>({ parents: [], students: [] });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const members = await getFamilyMembers();
      setFamilyMembers(members);
      
      // Only fetch support data if we have students in the family
      if (members.students.length > 0) {
        await Promise.all([
          fetchSupportMessages(),
          getEntryByDate(new Date().toDateString())
        ]);
      }
    } catch (error) {
      console.log('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

  const sendSupportMessage = (type: 'message' | 'voice' | 'care_package' | 'video_call' | 'boost') => {
    // Navigate to detailed send support screen with pre-selected type
    navigation.navigate('SendSupport', { preselectedType: type });
  };

  const getWellnessStatus = () => {
    const currentStudentName = familyMembers.students[0]?.name || 'your student';
    if (!todayEntry) return { status: 'No data', color: '#6b7280', suggestion: `Check in with ${currentStudentName} about logging wellness` };
    
    const score = todayEntry.wellnessScore;
    if (score >= 8) return { status: 'Thriving', color: '#10b981', suggestion: 'Great time to celebrate their success!' };
    if (score >= 6) return { status: 'Doing Well', color: '#059669', suggestion: 'Send encouragement to keep it up' };
    if (score >= 4) return { status: 'Managing', color: '#d97706', suggestion: 'Consider offering gentle support' };
    return { status: 'Struggling', color: '#dc2626', suggestion: 'Time for extra care and check-in' };
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
  
  // Get the student's name (assuming first student for now)
  const studentName = familyMembers.students[0]?.name || 'Student';

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
          <Text style={styles.title}>{studentName}'s Week</Text>
          <Text style={styles.subtitle}>Supporting from afar with love</Text>
        </View>

        {/* Child Status Overview */}
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>How {studentName}'s Doing</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Overall</Text>
              <Text style={[styles.statusValue, { color: wellnessStatus.color }]}>
                {wellnessStatus.status}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Mood</Text>
              <Text style={[styles.statusValue, { color: moodInfo.color }]}>
                {moodInfo.emoji} {moodInfo.text}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Level</Text>
              <Text style={styles.statusValue}>
                {getLevelTitle(level)} {level}
              </Text>
            </View>
          </View>
          <View style={styles.suggestionContainer}>
            <Text style={styles.suggestionLabel}>💡 Suggestion:</Text>
            <Text style={styles.suggestionText}>{wellnessStatus.suggestion}</Text>
          </View>
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

        {/* Quick Support Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Send Support</Text>
          <Text style={styles.sectionSubtitle}>Choose how to show you care</Text>
          
          <View style={styles.supportActionsGrid}>
            {/* Encouragement Message */}
            <TouchableOpacity 
              style={[styles.supportActionCard, { backgroundColor: '#1e40af' }]}
              onPress={() => sendSupportMessage('message')}
            >
              <Text style={styles.supportActionEmoji}>💬</Text>
              <Text style={styles.supportActionTitle}>Send Message</Text>
              <Text style={styles.supportActionDesc}>Words of encouragement</Text>
            </TouchableOpacity>

            {/* Care Package */}
            <TouchableOpacity 
              style={[styles.supportActionCard, { backgroundColor: '#7c2d12' }]}
              onPress={() => sendSupportMessage('care_package')}
            >
              <Text style={styles.supportActionEmoji}>📦</Text>
              <Text style={styles.supportActionTitle}>Care Package</Text>
              <Text style={styles.supportActionDesc}>Send something special</Text>
            </TouchableOpacity>

            {/* Video Call */}
            <TouchableOpacity 
              style={[styles.supportActionCard, { backgroundColor: '#166534' }]}
              onPress={() => sendSupportMessage('video_call')}
            >
              <Text style={styles.supportActionEmoji}>📹</Text>
              <Text style={styles.supportActionTitle}>Video Call</Text>
              <Text style={styles.supportActionDesc}>Face-to-face time</Text>
            </TouchableOpacity>

            {/* Care Boost */}
            <TouchableOpacity 
              style={[styles.supportActionCard, { backgroundColor: '#075985' }]}
              onPress={() => sendSupportMessage('boost')}
            >
              <Text style={styles.supportActionEmoji}>✨</Text>
              <Text style={styles.supportActionTitle}>Care Boost</Text>
              <Text style={styles.supportActionDesc}>$5 surprise</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Monthly Support Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This Month's Connection</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>{supportMessages.length}</Text>
                <Text style={styles.summaryLabel}>Messages Sent</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>${monthlyEarned}</Text>
                <Text style={styles.summaryLabel}>Care Boosts</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>${50 - monthlyEarned}</Text>
                <Text style={styles.summaryLabel}>Remaining</Text>
              </View>
            </View>
            <View style={styles.monthlyLimitBar}>
              <View 
                style={[
                  styles.monthlyLimitFill, 
                  { width: `${(monthlyEarned / 50) * 100}%` }
                ]} 
              />
            </View>
            <Text style={styles.monthlyLimitText}>
              Monthly care boost limit: ${monthlyEarned}/50
            </Text>
          </View>
        </View>

        {/* Recent Wellness Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wellness Insights</Text>
          <TouchableOpacity 
            style={styles.wellnessCard}
            onPress={() => navigation.navigate('ChildWellness')}
          >
            <View style={styles.wellnessHeader}>
              <Text style={styles.wellnessTitle}>Current Streak</Text>
              <Text style={styles.wellnessValue}>
                {stats.totalEntries === 0 ? '--' : `${stats.currentStreak} days`}
              </Text>
            </View>
            <Text style={styles.wellnessSubtext}>
              {stats.totalEntries === 0 
                ? `Encourage ${studentName} to start logging wellness` 
                : `${studentName} has been consistently tracking their wellness`
              }
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.wellnessCard}>
            <View style={styles.wellnessHeader}>
              <Text style={styles.wellnessTitle}>Average Score</Text>
              <Text style={styles.wellnessValue}>
                {stats.totalEntries === 0 ? '--' : `${stats.averageScore}/10`}
              </Text>
            </View>
            <Text style={styles.wellnessSubtext}>
              {stats.totalEntries === 0 
                ? 'No wellness data yet' 
                : stats.averageScore >= 7 
                ? 'Doing really well overall!' 
                : 'Room for gentle encouragement'
              }
            </Text>
          </TouchableOpacity>
        </View>

        {/* Connection History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Support</Text>
          {supportMessages.slice(0, 3).map((message, index) => (
            <View key={message.id} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyType}>
                  {message.type === 'message' ? '💬' : 
                   message.type === 'care_package' ? '📦' :
                   message.type === 'video_call' ? '📹' : '✨'} 
                  {message.type.replace('_', ' ')}
                </Text>
                <Text style={styles.historyTime}>
                  {new Date(message.timestamp).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.historyContent}>{message.content}</Text>
            </View>
          ))}
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
  statusCard: {
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
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statusItem: {
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 4,
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f9fafb',
  },
  suggestionContainer: {
    backgroundColor: '#374151',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fbbf24',
    marginRight: 8,
  },
  suggestionText: {
    fontSize: 14,
    color: '#d1d5db',
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 16,
  },
  supportActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  supportActionCard: {
    flex: 1,
    minWidth: '45%',
    maxWidth: '48%',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  supportActionEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  supportActionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  supportActionDesc: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: '#1f2937',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f9fafb',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
    fontWeight: '500',
  },
  monthlyLimitBar: {
    height: 6,
    backgroundColor: '#374151',
    borderRadius: 3,
    marginBottom: 8,
  },
  monthlyLimitFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 3,
  },
  monthlyLimitText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  wellnessCard: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  wellnessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  wellnessTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
  },
  wellnessValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
  },
  wellnessSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  historyCard: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f9fafb',
  },
  historyTime: {
    fontSize: 14,
    color: '#9ca3af',
  },
  historyContent: {
    fontSize: 14,
    color: '#d1d5db',
    lineHeight: 20,
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
    backgroundColor: '#1f2937',
    margin: 20,
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  waitingEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  waitingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f9fafb',
    textAlign: 'center',
    marginBottom: 12,
  },
  waitingText: {
    fontSize: 16,
    color: '#d1d5db',
    textAlign: 'center',
    lineHeight: 24,
  },
  inviteCard: {
    backgroundColor: '#1e40af',
    margin: 20,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  inviteLabel: {
    fontSize: 14,
    color: '#dbeafe',
    marginBottom: 12,
    fontWeight: '600',
  },
  inviteCodeLarge: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 4,
    marginBottom: 12,
    textAlign: 'center',
  },
  inviteHint: {
    fontSize: 12,
    color: '#93c5fd',
    fontStyle: 'italic',
  },
  instructionsCard: {
    backgroundColor: '#1f2937',
    margin: 20,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 16,
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
    backgroundColor: '#6366f1',
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#d1d5db',
    lineHeight: 20,
  },
  previewCard: {
    backgroundColor: '#059669',
    margin: 20,
    padding: 24,
    borderRadius: 16,
    marginBottom: 40,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
  },
  previewList: {
    gap: 8,
  },
  previewItem: {
    fontSize: 14,
    color: '#d1fae5',
    lineHeight: 20,
  },
});