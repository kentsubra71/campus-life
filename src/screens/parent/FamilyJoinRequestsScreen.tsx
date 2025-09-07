import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';
import { theme } from '../../styles/theme';
import { StatusHeader } from '../../components/StatusHeader';
import { NavigationProp } from '@react-navigation/native';
import { 
  getPendingFamilyJoinRequests, 
  approveJoinRequest, 
  denyJoinRequest,
  FamilyJoinRequest 
} from '../../lib/firebase';

interface FamilyJoinRequestsScreenProps {
  navigation: NavigationProp<any>;
}

export const FamilyJoinRequestsScreen: React.FC<FamilyJoinRequestsScreenProps> = ({ 
  navigation 
}) => {
  const { user, family } = useAuthStore();
  const [joinRequests, setJoinRequests] = useState<FamilyJoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);

  const loadJoinRequests = async (isRefresh = false) => {
    if (!family?.id) {
      console.log('No family ID available');
      setLoading(false);
      return;
    }

    if (!isRefresh) setLoading(true);
    
    try {
      console.log('Loading family join requests for family:', family.id);
      const requests = await getPendingFamilyJoinRequests(family.id);
      setJoinRequests(requests);
      console.log(`Loaded ${requests.length} pending join requests`);
    } catch (error) {
      console.error('Error loading join requests:', error);
      Alert.alert('Error', 'Failed to load join requests');
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadJoinRequests();
  }, [family?.id]);

  const handleApproveRequest = async (request: FamilyJoinRequest) => {
    if (!user?.id) return;

    Alert.alert(
      'Approve Join Request',
      `Allow ${request.studentName} (${request.studentEmail}) to join your family?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setProcessingRequest(request.id);
            try {
              const result = await approveJoinRequest(request.id, user.id);
              if (result.success) {
                Alert.alert(
                  'Request Approved',
                  `${request.studentName} has been added to your family!`,
                  [{ text: 'OK' }]
                );
                // Remove from the list and refresh
                loadJoinRequests();
              } else {
                Alert.alert('Error', result.error || 'Failed to approve request');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to approve request');
            } finally {
              setProcessingRequest(null);
            }
          }
        }
      ]
    );
  };

  const handleDenyRequest = async (request: FamilyJoinRequest) => {
    if (!user?.id) return;

    Alert.alert(
      'Deny Join Request',
      `Deny ${request.studentName}'s request to join your family?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deny',
          style: 'destructive',
          onPress: async () => {
            setProcessingRequest(request.id);
            try {
              const result = await denyJoinRequest(request.id, user.id, 'Request denied by parent');
              if (result.success) {
                Alert.alert(
                  'Request Denied',
                  `${request.studentName}'s request has been denied.`,
                  [{ text: 'OK' }]
                );
                // Remove from the list and refresh
                loadJoinRequests();
              } else {
                Alert.alert('Error', result.error || 'Failed to deny request');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to deny request');
            } finally {
              setProcessingRequest(null);
            }
          }
        }
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadJoinRequests(true);
  };

  const renderJoinRequest = (request: FamilyJoinRequest) => {
    const isProcessing = processingRequest === request.id;
    
    return (
      <View key={request.id} style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <View style={styles.requestInfo}>
            <Text style={styles.studentName}>{request.studentName}</Text>
            <Text style={styles.studentEmail}>{request.studentEmail}</Text>
            <Text style={styles.requestDate}>
              Requested: {request.requestedAt.toDate().toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>Pending</Text>
          </View>
        </View>

        <Text style={styles.requestDescription}>
          This student wants to join your family. You can approve or deny this request.
        </Text>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.denyButton, isProcessing && styles.buttonDisabled]}
            onPress={() => handleDenyRequest(request)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#dc2626" />
            ) : (
              <Text style={styles.denyButtonText}>Deny</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.approveButton, isProcessing && styles.buttonDisabled]}
            onPress={() => handleApproveRequest(request)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.approveButtonText}>Approve</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusHeader title="Family Join Requests" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading join requests...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusHeader title="Family Join Requests" />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Pending Requests</Text>
            <Text style={styles.subtitle}>
              Students requesting to join your family
            </Text>
          </View>

          {joinRequests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Pending Requests</Text>
              <Text style={styles.emptyText}>
                When students request to join your family, they'll appear here for approval.
              </Text>
            </View>
          ) : (
            <View style={styles.requestsList}>
              {joinRequests.map(renderJoinRequest)}
            </View>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 80, // Account for status header
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  requestsList: {
    gap: 16,
  },
  requestCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  requestInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  studentEmail: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  requestDate: {
    fontSize: 12,
    color: theme.colors.textTertiary,
  },
  statusBadge: {
    backgroundColor: theme.colors.warning,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  requestDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  denyButton: {
    flex: 1,
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 2,
    borderColor: '#dc2626',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButton: {
    flex: 1,
    backgroundColor: theme.colors.success,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  denyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },
  approveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});