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
import { cache, CACHE_CONFIGS, smartRefresh } from '../../utils/universalCache';
// New component imports
import { HeroCard } from '../../components/cards/HeroCard';
import { StatsCard } from '../../components/cards/StatsCard';
import { ActionCard } from '../../components/cards/ActionCard';
import { ListCard } from '../../components/cards/ListCard';
import { BudgetProgressBar } from '../../components/BudgetProgressBar';
import { pushNotificationService, NotificationTemplates } from '../../services/pushNotificationService';

interface ParentDashboardScreenProps {
  navigation: any;
}

export const ParentDashboardScreen: React.FC<ParentDashboardScreenProps> = ({ navigation }) => {
  const { stats, todayEntry, getEntryByDate } = useWellnessStore();
  const { 
    supportMessages, 
    supportRequests,
    rewardRequests,
    totalEarned,
    monthlyEarned,
    level, 
    mood,
    fetchSupportMessages,
    fetchMonthlyPayments,
    fetchRewardRequests,
    addExperience,
    acknowledgeSupport
  } = useRewardsStore();
  const { user, family, getFamilyMembers } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<{ parents: any[]; students: any[] }>({ parents: [], students: [] });
  const [selectedStudentIndex, setSelectedStudentIndex] = useState(0);
  const [studentEarnings, setStudentEarnings] = useState<{ [studentId: string]: { monthly: number; total: number } }>({});

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
        fetchRewardRequests();
        fetchMonthlyPayments(selectedStudent?.id);
      }
    }, [fetchSupportMessages, fetchRewardRequests, fetchMonthlyPayments, familyMembers.students.length, selectedStudentIndex])
  );

  const loadData = async (forceRefresh = false) => {
    if (!user) return;

    try {
      // Smart refresh family members with caching
      await smartRefresh(
        CACHE_CONFIGS.FAMILY_MEMBERS,
        async () => {
          console.log('🔄 Loading family members...');
          const members = await getFamilyMembers();
          console.log('👨‍👩‍👧‍👦 Family members loaded:', {
            parentsCount: members.parents.length,
            studentsCount: members.students.length,
            parents: members.parents.map(p => ({ id: p.id, name: p.name })),
            students: members.students.map(s => ({ id: s.id, name: s.name }))
          });
          return members;
        },
        (cachedMembers) => {
          // Show cached data immediately
          console.log('📦 Using cached family members');
          setFamilyMembers(cachedMembers);
        },
        (freshMembers) => {
          // Update with fresh data
          console.log('✅ Updated with fresh family members');
          setFamilyMembers(freshMembers);
        },
        user.id
      );

      // Get family members (either from cache or fresh)
      const members = await cache.get(CACHE_CONFIGS.FAMILY_MEMBERS, user.id) || 
                      await getFamilyMembers();

      // Load dashboard data with caching if we have students
      if (members.students.length > 0) {
        const selectedStudent = members.students[selectedStudentIndex] || members.students[0];
        
        await smartRefresh(
          CACHE_CONFIGS.DASHBOARD_DATA,
          async () => {
            console.log('🔄 Loading dashboard data...');
            await Promise.all([
              fetchSupportMessages(),
              fetchRewardRequests(),
              (async () => {
                const earnings = await fetchStudentEarnings(selectedStudent?.id);
                setStudentEarnings(prev => ({
                  ...prev,
                  [selectedStudent?.id]: earnings
                }));
              })(),
              getEntryByDate(new Date().toISOString().split('T')[0])
            ]);
            
            // Return dashboard state for caching
            return {
              supportMessages,
              monthlyEarned,
              level,
              mood,
              stats,
              todayEntry,
              lastUpdated: new Date().toISOString()
            };
          },
          (cachedDashboard) => {
            console.log('📦 Using cached dashboard data');
            // Dashboard data already in stores, just log
          },
          (freshDashboard) => {
            console.log('✅ Updated with fresh dashboard data');
          },
          `${user.id}_${selectedStudent?.id}`
        );

        // PayPal verification (reduced delay)
        setTimeout(async () => {
          try {
            console.log('🔄 Auto-verifying pending PayPal payments...');
            const { autoVerifyPendingPayPalPayments } = await import('../../lib/paypalIntegration');
            const verifiedCount = await autoVerifyPendingPayPalPayments(user.id);
            if (verifiedCount > 0) {
              console.log(`✅ Auto-verified ${verifiedCount} PayPal payments`);
              // Refresh monthly payments to show updates
              fetchMonthlyPayments(selectedStudent?.id);
            }
          } catch (verifyError) {
            console.error('⚠️ Auto-verify failed on dashboard:', verifyError);
          }
        }, 100); // Almost immediate verification
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
  
  const fetchStudentEarnings = async (studentId: string) => {
    if (!studentId) return { monthly: 0, total: 0 };
    
    try {
      const { getUserTotalPoints, getRewardEntries } = await import('../lib/firebase');
      
      const totalPoints = await getUserTotalPoints(studentId);
      
      // Get current month rewards as "monthly earnings"
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const rewardEntries = await getRewardEntries(studentId, 100);
      let monthlyTotal = 0;
      
      rewardEntries.forEach((reward) => {
        const rewardDate = reward.created_at.toDate();
        if (rewardDate >= startOfMonth) {
          monthlyTotal += reward.points;
        }
      });
      
      return { monthly: monthlyTotal, total: totalPoints };
    } catch (error) {
      console.error('Error fetching student earnings:', error);
      return { monthly: 0, total: 0 };
    }
  };
      // Reload data for the selected student
      getEntryByDate(new Date().toISOString().split('T')[0]);
      if (selectedStudent?.id) {
        fetchStudentEarnings(selectedStudent.id).then(earnings => {
          setStudentEarnings(prev => ({
            ...prev,
            [selectedStudent.id]: earnings
          }));
        });
      }
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

  const sendDebugNotification = async (type: 'local' | 'firebase') => {
    try {
      if (type === 'local') {
        // Send local notification to self
        await pushNotificationService.sendLocalNotification(
          '🧪 Parent Local Debug Test',
          'This is a test notification sent locally to your device. Local notifications work in Expo Go!'
        );
        Alert.alert('Debug Success', 'Local test notification sent! Check your notification bar.');
      } else {
        // Test Firebase push notification setup
        if (!user) return;
        
        Alert.alert(
          '🚨 Firebase Push Test',
          'This tests your Firebase/EAS setup:\n\n1. If you get "no project id" - you need EAS setup\n2. If the call succeeds but no notification shows - that\'s normal in Expo Go\n3. In production/development builds, this will work properly',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Try Anyway', 
              onPress: async () => {
                try {
                  const testNotification = NotificationTemplates.supportReceived(
                    user.name || 'Parent',
                    '🧪 Debug: This is a test support message from the parent dashboard'
                  );
                  
                  const success = await pushNotificationService.sendPushNotification({
                    ...testNotification,
                    userId: user.id
                  });
                  
                  Alert.alert(
                    'Firebase Test Result', 
                    success 
                      ? 'Firebase call succeeded! (But notification won\'t show in Expo Go)' 
                      : 'Firebase call failed - check console for details'
                  );
                } catch (error) {
                  console.error('Firebase debug error:', error);
                  Alert.alert('Firebase Error', 'Firebase call failed - check console for details');
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Debug notification error:', error);
      Alert.alert('Debug Error', `Failed to send test notification: ${error.message}`);
    }
  };

  const handleRewardRequest = async (requestId: string, action: 'approve' | 'deny') => {
    try {
      // Get the reward request details
      const request = rewardRequests.find(r => r.id === requestId);
      if (!request) return;

      if (action === 'approve') {
        // Create payment (for now just update status - in production this would integrate with payment providers)
        const { doc, updateDoc, Timestamp } = await import('firebase/firestore');
        const { db } = await import('../../lib/firebase');
        
        await updateDoc(doc(db, 'reward_requests', requestId), {
          status: 'approved',
          respondedAt: Timestamp.now()
        });

        // Send notification to student
        try {
          const studentProfile = familyMembers.students.find(s => s.id === request.studentId);
          if (studentProfile?.pushToken) {
            const { pushNotificationService, NotificationTemplates } = await import('../../services/pushNotificationService');
            const notification = {
              ...NotificationTemplates.paymentReceived(`$${request.amount}`, user?.name || 'Parent'),
              userId: request.studentId
            };
            await pushNotificationService.sendPushNotification(notification);
          }
        } catch (notifError) {
          console.error('Failed to send approval notification:', notifError);
        }

        Alert.alert(
          'Request Approved! ✅',
          `$${request.amount} reward approved for ${request.studentName}.\n\nIn production, this would trigger an actual payment via your selected payment method.`,
          [{ text: 'OK' }]
        );
      } else {
        // Deny the request
        const { doc, updateDoc, Timestamp } = await import('firebase/firestore');
        const { db } = await import('../../lib/firebase');
        
        await updateDoc(doc(db, 'reward_requests', requestId), {
          status: 'denied',
          respondedAt: Timestamp.now()
        });

        Alert.alert(
          'Request Denied',
          `Reward request from ${request.studentName} has been declined.`,
          [{ text: 'OK' }]
        );
      }

      // Refresh data to show updated status
      loadData();
    } catch (error) {
      console.error('Error handling reward request:', error);
      Alert.alert('Error', 'Failed to process reward request. Please try again.');
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

        {/* Pending Reward Requests */}
        {rewardRequests.filter(req => req.status === 'pending').length > 0 && (
          <View style={styles.rewardRequestsSection}>
            <Text style={styles.sectionTitle}>🎉 Reward Requests</Text>
            <Text style={styles.rewardRequestsSubtitle}>
              {rewardRequests.filter(req => req.status === 'pending').length} pending request{rewardRequests.filter(req => req.status === 'pending').length === 1 ? '' : 's'}
            </Text>
            
            {rewardRequests
              .filter(req => req.status === 'pending')
              .slice(0, 3)
              .map((request) => (
                <View key={request.id} style={styles.rewardRequestCard}>
                  <View style={styles.rewardRequestHeader}>
                    <View style={styles.rewardRequestInfo}>
                      <Text style={styles.rewardRequestTitle}>{request.rewardTitle}</Text>
                      <Text style={styles.rewardRequestDescription}>{request.rewardDescription}</Text>
                      <View style={styles.rewardRequestMeta}>
                        <View style={styles.rewardRequestCategory}>
                          <Text style={styles.rewardRequestCategoryText}>{request.category}</Text>
                        </View>
                        <Text style={styles.rewardRequestTime}>
                          {request.requestedAt.toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.rewardRequestAmount}>
                      <Text style={styles.rewardRequestAmountText}>${request.amount}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.rewardRequestActions}>
                    <TouchableOpacity 
                      style={styles.rewardRequestDenyButton}
                      onPress={() => handleRewardRequest(request.id, 'deny')}
                    >
                      <Text style={styles.rewardRequestDenyText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.rewardRequestApproveButton}
                      onPress={() => handleRewardRequest(request.id, 'approve')}
                    >
                      <Text style={styles.rewardRequestApproveText}>Send ${request.amount}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            }
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
              <Text style={styles.budgetRemaining}>${Math.max(0, 50 - (studentEarnings[selectedStudent?.id]?.monthly || 0))} left</Text>
            </View>
            <View style={styles.budgetBarContainer}>
              <View style={styles.budgetBar}>
                <View 
                  style={[styles.budgetFill, { 
                    width: `${Math.min(100, ((studentEarnings[selectedStudent?.id]?.monthly || 0) / 50) * 100)}%` 
                  }]} 
                />
              </View>
              <Text style={styles.budgetText}>
                ${studentEarnings[selectedStudent?.id]?.monthly || 0} of $50 used
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
          
          {(supportMessages.length > 0 || (studentEarnings[selectedStudent?.id]?.monthly || 0) > 0) && (
            <TouchableOpacity 
              style={styles.activityItem}
              onPress={() => navigation.navigate('Activity')}
            >
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Monthly Summary</Text>
                <Text style={styles.activitySubtitle}>{supportMessages.length} messages • ${studentEarnings[selectedStudent?.id]?.monthly || 0} sent</Text>
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
          {!wellnessScore && supportMessages.length === 0 && (studentEarnings[selectedStudent?.id]?.monthly || 0) === 0 && (
            <View style={styles.activityItem}>
              <View style={[styles.activityIndicator, { backgroundColor: theme.colors.backgroundTertiary }]} />
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>No activity yet</Text>
                <Text style={styles.activitySubtitle}>Your family is just getting started!</Text>
              </View>
            </View>
          )}
        </View>
        {/* Debug Notifications Section */}
        <View style={styles.debugSection}>
          <Text style={styles.sectionTitle}>🧪 Debug Notifications</Text>
          <Text style={styles.debugSubtext}>Test notifications from one device (for development)</Text>
          
          <View style={styles.debugButtonRow}>
            <TouchableOpacity 
              style={styles.debugButton}
              onPress={() => sendDebugNotification('local')}
            >
              <Text style={styles.debugButtonText}>Test Local ✅</Text>
              <Text style={styles.debugButtonSubtext}>Works in Expo Go</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.debugButton, styles.debugButtonDisabled]}
              onPress={() => sendDebugNotification('firebase')}
            >
              <Text style={styles.debugButtonText}>Test Firebase ⚠️</Text>
              <Text style={styles.debugButtonSubtext}>Limited in Expo Go</Text>
            </TouchableOpacity>
          </View>
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
  
  // Debug Section Styles
  debugSection: {
    paddingHorizontal: 24,
    marginTop: 24,
  },
  debugSubtext: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  debugButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  debugButton: {
    flex: 1,
    backgroundColor: theme.colors.backgroundSecondary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  debugButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  debugButtonSubtext: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  debugButtonDisabled: {
    opacity: 0.7,
    borderColor: '#f59e0b',
    borderWidth: 1,
  },
  
  // Wellness Section Styles
  wellnessSection: {
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 40,
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  wellnessContainer: {
    backgroundColor: theme.colors.backgroundSecondary,
    padding: 20,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  wellnessText: {
    fontSize: 15,
    color: theme.colors.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  tapHint: {
    fontSize: 18,
    color: theme.colors.textTertiary,
    fontWeight: '300',
    marginLeft: 8,
  },
  pullHint: {
    fontSize: 13,
    color: theme.colors.textTertiary,
    marginTop: 4,
  },
  
  // Reward Requests Section
  rewardRequestsSection: {
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  rewardRequestsSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    marginTop: -8,
  },
  rewardRequestCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rewardRequestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  rewardRequestInfo: {
    flex: 1,
    marginRight: 16,
  },
  rewardRequestTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  rewardRequestDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  rewardRequestMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rewardRequestCategory: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rewardRequestCategoryText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rewardRequestTime: {
    fontSize: 12,
    color: theme.colors.textTertiary,
  },
  rewardRequestAmount: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardRequestAmountText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.success,
  },
  rewardRequestActions: {
    flexDirection: 'row',
    gap: 12,
  },
  rewardRequestDenyButton: {
    flex: 1,
    backgroundColor: theme.colors.backgroundTertiary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rewardRequestDenyText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  rewardRequestApproveButton: {
    flex: 1,
    backgroundColor: theme.colors.success,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  rewardRequestApproveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});
