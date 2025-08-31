import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRewardsStore } from '../../stores/rewardsStore';
import { showMessage } from 'react-native-flash-message';
import { theme } from '../../styles/theme';
import { MoneyCompactSummary } from '../../components/MoneyCompactSummary';

interface RewardsScreenProps {
  navigation: any;
}

export const RewardsScreen: React.FC<RewardsScreenProps> = ({ navigation }) => {
  const {
    supportMessages,
    totalEarned,
    monthlyEarned,
    level,
    experience,
    fetchSupportMessages,
    markMessageRead,
  } = useRewardsStore();

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await fetchSupportMessages();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };


  const renderSupportMessage = (message: any) => {
    const getMessageIcon = (type: string) => {
      switch (type) {
        case 'message': return 'M';
        case 'voice': return 'V';
        case 'care_package': return 'P';
        case 'video_call': return 'C';
        case 'boost': return 'B';
        default: return 'M';
      }
    };

    return (
      <TouchableOpacity
        key={message.id}
        style={[
          styles.messageCard,
          !message.read && styles.unreadMessage
        ]}
        onPress={() => !message.read && markMessageRead(message.id)}
        activeOpacity={0.8}
      >
        <View style={styles.messageHeader}>
          <View style={[
            styles.messageIcon,
            { backgroundColor: !message.read ? theme.colors.primary : theme.colors.backgroundTertiary }
          ]}>
            <Text style={styles.messageIconText}>
              {getMessageIcon(message.type)}
            </Text>
          </View>
          <View style={styles.messageContent}>
            <Text style={styles.messageText}>{message.content}</Text>
            <Text style={styles.messageTime}>
              {new Date(message.timestamp).toLocaleDateString()} at {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          {!message.read && <View style={styles.unreadDot} />}
        </View>
      </TouchableOpacity>
    );
  };

  const experienceProgress = (experience % 200) / 200 * 100;
  const nextLevelExp = (level * 200) - experience;
  const unreadCount = supportMessages.filter(msg => !msg.read).length;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Modern Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Hi there!</Text>
          <Text style={styles.title}>Your Progress</Text>
          <Text style={styles.subtitle}>Money, level, and family support</Text>
        </View>

        {/* Current Status - Clean */}
        <View style={styles.statusSection}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>Level {level} Student</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{monthlyEarned >= 40 ? 'Great Month!' : monthlyEarned >= 20 ? 'Doing Well' : 'Just Getting Started'}</Text>
            </View>
          </View>
          <Text style={styles.statusSubtitle}>
            {experienceProgress > 80 ? 'Almost to the next level!' : 
             experienceProgress > 50 ? 'Making great progress' : 
             'Keep logging wellness to level up'}
          </Text>
        </View>

        {/* Key Metrics - Clean Layout */}
        <View style={styles.metricsSection}>
          <View style={styles.metricItem}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>This Month</Text>
              <Text style={styles.metricValue}>${monthlyEarned}</Text>
            </View>
            <Text style={styles.metricTag}>${50 - monthlyEarned} left this month</Text>
          </View>
          
          <View style={styles.metricItem}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>Your Level</Text>
              <Text style={styles.metricValue}>LVL {level}</Text>
            </View>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${experienceProgress}%` }]} />
              </View>
              <Text style={styles.progressText}>{nextLevelExp} XP to next level</Text>
            </View>
          </View>
        </View>

        {/* Money Received Section */}
        <MoneyCompactSummary onViewAll={() => navigation.navigate('PaymentHistory')} />

        {/* Family Support Messages */}
        <View style={styles.section}>
          <View style={styles.messagesSectionHeader}>
            <Text style={styles.sectionTitle}>Family Support</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          
          {supportMessages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No messages yet</Text>
              <Text style={styles.emptyStateSubtext}>Your family support will appear here</Text>
            </View>
          ) : (
            supportMessages.map(renderSupportMessage)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 24,
    paddingTop: 10,
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  statusSection: {
    backgroundColor: theme.colors.backgroundCard,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  statusBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  statusSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  metricsSection: {
    marginBottom: 24,
  },
  metricItem: {
    backgroundColor: theme.colors.backgroundCard,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  metricTag: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  messagesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  unreadBadge: {
    backgroundColor: theme.colors.error,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  messageCard: {
    backgroundColor: theme.colors.backgroundCard,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  unreadMessage: {
    borderColor: theme.colors.primary,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  messageIconText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  messageContent: {
    flex: 1,
  },
  messageText: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontWeight: '500',
    marginBottom: 4,
    lineHeight: 18,
  },
  messageTime: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: theme.colors.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyStateText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
}); 