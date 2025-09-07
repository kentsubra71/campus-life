import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../styles/theme';
import { WellnessInsights, CategoryTrend } from '../../utils/chartDataTransform';

interface WellnessInsightsCardProps {
  insights: WellnessInsights;
  period: 'daily' | 'weekly' | 'monthly';
}

const WellnessInsightsCard: React.FC<WellnessInsightsCardProps> = ({ insights, period }) => {
  const getTrendIcon = (direction: 'up' | 'down' | 'stable') => {
    switch (direction) {
      case 'up': return '↗';
      case 'down': return '↘';
      case 'stable': return '→';
    }
  };

  const getTrendColor = (direction: 'up' | 'down' | 'stable') => {
    switch (direction) {
      case 'up': return theme.colors.success;
      case 'down': return theme.colors.error;
      case 'stable': return theme.colors.textSecondary;
    }
  };

  const getPeriodText = () => {
    switch (period) {
      case 'daily': return 'vs yesterday';
      case 'weekly': return 'vs last week';
      case 'monthly': return 'vs last month';
    }
  };

  const formatCategoryName = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  if (insights.trends.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Wellness Insights</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Need more data</Text>
          <Text style={styles.emptySubtext}>Log wellness for a few more days to see insights</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Wellness Insights</Text>
      <Text style={styles.subtitle}>Your progress {getPeriodText()}</Text>
      
      {/* Overall Trend */}
      <View style={styles.overallSection}>
        <View style={styles.overallHeader}>
          <Text style={styles.overallTitle}>Overall Wellness</Text>
          <View style={styles.trendBadge}>
            <Text style={[styles.trendIcon, { color: getTrendColor(insights.overallTrend.direction) }]}>
              {getTrendIcon(insights.overallTrend.direction)}
            </Text>
            <Text style={[styles.trendValue, { color: getTrendColor(insights.overallTrend.direction) }]}>
              {insights.overallTrend.change > 0 ? 
                `${insights.overallTrend.change.toFixed(1)}` : 
                'No change'
              }
            </Text>
          </View>
        </View>
        <Text style={styles.overallScore}>
          {insights.overallTrend.current.toFixed(1)}/10
        </Text>
        <Text style={styles.overallSubtext}>
          Previous: {insights.overallTrend.previous.toFixed(1)}/10
        </Text>
      </View>

      {/* Category Trends */}
      <View style={styles.categoriesSection}>
        <Text style={styles.categoriesTitle}>Category Performance</Text>
        <View style={styles.categoriesGrid}>
          {insights.trends.map((trend) => (
            <View key={trend.category} style={styles.categoryItem}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryName}>{formatCategoryName(trend.category)}</Text>
                <View style={[styles.categoryTrend, { 
                  backgroundColor: `${getTrendColor(trend.direction)}15` 
                }]}>
                  <Text style={[styles.categoryTrendIcon, { 
                    color: getTrendColor(trend.direction) 
                  }]}>
                    {getTrendIcon(trend.direction)}
                  </Text>
                </View>
              </View>
              <Text style={styles.categoryRanking}>
                #{trend.current} {trend.direction !== 'stable' && (
                  <Text style={styles.categoryChange}>
                    (was #{trend.previous})
                  </Text>
                )}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Key Insights */}
      <View style={styles.insightsSection}>
        <View style={styles.insightItem}>
          <Text style={styles.insightLabel}>Best performing area</Text>
          <Text style={styles.insightValue}>{formatCategoryName(insights.bestCategory)}</Text>
        </View>
        
        {insights.improvingCategory && (
          <View style={styles.insightItem}>
            <Text style={styles.insightLabel}>Most improved</Text>
            <Text style={[styles.insightValue, { color: theme.colors.success }]}>
              {formatCategoryName(insights.improvingCategory)}
            </Text>
          </View>
        )}
        
        <View style={styles.insightItem}>
          <Text style={styles.insightLabel}>Tracking streak</Text>
          <Text style={styles.insightValue}>
            {insights.trends.filter(t => t.direction === 'up').length} areas improving
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  
  // Overall Section
  overallSection: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  overallHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  overallTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendIcon: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  trendValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  overallScore: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  overallSubtext: {
    fontSize: 12,
    color: theme.colors.textTertiary,
  },
  
  // Categories Section
  categoriesSection: {
    marginBottom: 16,
  },
  categoriesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 8,
    padding: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  categoryTrend: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryTrendIcon: {
    fontSize: 10,
    fontWeight: '600',
  },
  categoryRanking: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  categoryChange: {
    fontSize: 12,
    fontWeight: '400',
    color: theme.colors.textTertiary,
  },
  
  // Insights Section
  insightsSection: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 16,
  },
  insightItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  insightLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  insightValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    textAlign: 'center',
  },
});

export default WellnessInsightsCard;