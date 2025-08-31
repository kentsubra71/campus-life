import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { getItemRequestsForParent, getItemRequestsForStudent, ItemRequest } from '../lib/firebase';
import { useAuthStore } from '../stores/authStore';
import { theme } from '../styles/theme';
import { formatTimeAgo } from '../utils/dateUtils';

interface ItemsSummaryProps {
  onViewAll: () => void;
  userType: 'parent' | 'student';
}

export const ItemsSummary: React.FC<ItemsSummaryProps> = ({ onViewAll, userType }) => {
  const { user, familyMembers } = useAuthStore();
  const [recentItems, setRecentItems] = useState<ItemRequest[]>([]);
  const [totalThisWeek, setTotalThisWeek] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadRecentItems();
    }
  }, [user]);

  const loadRecentItems = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      console.log('Loading item requests for:', userType, 'user ID:', user.id);
      
      let items: ItemRequest[] = [];
      
      if (userType === 'parent') {
        items = await getItemRequestsForParent(user.id, 10);
      } else {
        items = await getItemRequestsForStudent(user.id, 10);
      }
      
      console.log('Found', items.length, 'item requests');
      
      // Calculate this week's requests
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const weekCount = items.filter(item => {
        const itemDate = new Date(item.created_at.seconds * 1000);
        return itemDate >= oneWeekAgo;
      }).length;
      
      setRecentItems(items.slice(0, 3));
      setTotalThisWeek(weekCount);
      
    } catch (error) {
      console.error('Error loading recent items:', error);
      setRecentItems([]);
      setTotalThisWeek(0);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#10b981';
      case 'declined': return '#ef4444';
      case 'pending': return '#f59e0b';
      default: return theme.colors.textSecondary;
    }
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getItemDescription = (item: ItemRequest) => {
    let desc = item.item_name;
    if (item.item_price && item.item_price > 0) {
      desc += ` - $${(item.item_price / 100).toFixed(2)}`;
    }
    return desc;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Item Requests</Text>
        </View>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (recentItems.length === 0) {
    const emptyText = userType === 'parent' 
      ? 'No item requests yet'
      : 'No requests made yet';
      
    return (
      <TouchableOpacity style={styles.container} onPress={onViewAll}>
        <View style={styles.header}>
          <Text style={styles.title}>Item Requests</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{emptyText}</Text>
          <Text style={styles.tapText}>Tap to view details</Text>
        </View>
      </TouchableOpacity>
    );
  }

  const weekText = userType === 'parent'
    ? `${totalThisWeek} requests this week`
    : `${totalThisWeek} made this week`;

  return (
    <TouchableOpacity style={styles.container} onPress={onViewAll}>
      <View style={styles.header}>
        <Text style={styles.title}>Item Requests</Text>
        <Text style={styles.weekTotal}>
          {weekText}
        </Text>
      </View>

      <View style={styles.recentList}>
        {recentItems.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>
                {getItemDescription(item)}
              </Text>
              <Text style={styles.time}>
                {formatTimeAgo(item.created_at.seconds * 1000)}
              </Text>
            </View>
            <View style={styles.statusContainer}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {getStatusText(item.status)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.viewAllText}>Tap to view all requests →</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  weekTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.warning,
  },
  loadingText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    padding: 20,
    paddingHorizontal: 24,
  },
  emptyState: {
    alignItems: 'center',
    padding: 20,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  tapText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  recentList: {
    marginBottom: 8,
    paddingHorizontal: 24,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: 2,
    fontWeight: '500',
  },
  time: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: theme.colors.backgroundTertiary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  viewAllText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 24,
  },
});