import { WellnessEntry } from '../stores/wellnessStore';
import { parseLocalDateString, getLocalDateString } from './dateUtils';

export interface ChartDataPoint {
  date: string;
  sleep: number;
  nutrition: number;
  academics: number;
  social: number;
  overallScore: number;
  overallMood: number;
}

export interface CategoryTrend {
  category: 'sleep' | 'nutrition' | 'academics' | 'social';
  current: number;
  previous: number;
  change: number;
  direction: 'up' | 'down' | 'stable';
}

export interface WellnessInsights {
  trends: CategoryTrend[];
  overallTrend: {
    current: number;
    previous: number;
    change: number;
    direction: 'up' | 'down' | 'stable';
  };
  bestCategory: string;
  improvingCategory: string | null;
}

// Invert rankings for intuitive chart display (1=worst, 4=best becomes 4=best, 1=worst)
const invertRanking = (ranking: number): number => 5 - ranking;

// Transform wellness entries for chart consumption
export const transformEntriesForCharts = (entries: WellnessEntry[]): ChartDataPoint[] => {
  return entries
    .sort((a, b) => parseLocalDateString(a.date).getTime() - parseLocalDateString(b.date).getTime())
    .map(entry => ({
      date: entry.date,
      sleep: invertRanking(entry.rankings.sleep),
      nutrition: invertRanking(entry.rankings.nutrition),
      academics: invertRanking(entry.rankings.academics),
      social: invertRanking(entry.rankings.social),
      overallScore: entry.overallScore,
      overallMood: entry.overallMood,
    }));
};

// Filter entries by date range based on period
export const filterEntriesByPeriod = (
  entries: WellnessEntry[],
  period: 'daily' | 'weekly' | 'monthly'
): WellnessEntry[] => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let cutoffDate: Date;
  
  switch (period) {
    case 'daily':
      // Last 7 days
      cutoffDate = new Date(today);
      cutoffDate.setDate(today.getDate() - 6); // 7 days including today
      break;
    case 'weekly':
      // Last 4 weeks (1 month)
      cutoffDate = new Date(today);
      cutoffDate.setDate(today.getDate() - 28); // 4 weeks
      break;
    case 'monthly':
      // Last 12 months
      cutoffDate = new Date(today);
      cutoffDate.setMonth(today.getMonth() - 11); // 12 months including current
      break;
    default:
      cutoffDate = new Date(0); // Return all entries
  }

  return entries.filter(entry => {
    const entryDate = parseLocalDateString(entry.date);
    return entryDate >= cutoffDate;
  }).sort((a, b) => parseLocalDateString(a.date).getTime() - parseLocalDateString(b.date).getTime());
};

// Group entries by time period
export const groupEntriesByPeriod = (
  entries: WellnessEntry[], 
  period: 'daily' | 'weekly' | 'monthly'
): WellnessEntry[] => {
  if (period === 'daily') return entries;

  const groups = new Map<string, WellnessEntry[]>();
  
  entries.forEach(entry => {
    const date = parseLocalDateString(entry.date);
    let key: string;
    
    if (period === 'weekly') {
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());
      key = getLocalDateString(startOfWeek);
    } else { // monthly
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    }
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(entry);
  });

  // Calculate averages for each group
  const aggregatedEntries: WellnessEntry[] = [];
  groups.forEach((groupEntries, key) => {
    const avgEntry: WellnessEntry = {
      id: `avg-${key}`,
      date: key,
      rankings: {
        sleep: Math.round(groupEntries.reduce((sum, e) => sum + e.rankings.sleep, 0) / groupEntries.length),
        nutrition: Math.round(groupEntries.reduce((sum, e) => sum + e.rankings.nutrition, 0) / groupEntries.length),
        academics: Math.round(groupEntries.reduce((sum, e) => sum + e.rankings.academics, 0) / groupEntries.length),
        social: Math.round(groupEntries.reduce((sum, e) => sum + e.rankings.social, 0) / groupEntries.length),
      },
      overallMood: Math.round(groupEntries.reduce((sum, e) => sum + e.overallMood, 0) / groupEntries.length),
      overallScore: Math.round((groupEntries.reduce((sum, e) => sum + e.overallScore, 0) / groupEntries.length) * 10) / 10,
    };
    aggregatedEntries.push(avgEntry);
  });

  return aggregatedEntries.sort((a, b) => parseLocalDateString(a.date).getTime() - parseLocalDateString(b.date).getTime());
};

// Calculate trends and insights
export const calculateWellnessInsights = (
  entries: WellnessEntry[],
  period: 'daily' | 'weekly' | 'monthly'
): WellnessInsights => {
  if (entries.length < 2) {
    return {
      trends: [],
      overallTrend: { current: 0, previous: 0, change: 0, direction: 'stable' },
      bestCategory: 'sleep',
      improvingCategory: null,
    };
  }

  const groupedEntries = groupEntriesByPeriod(entries, period);
  const recentEntries = groupedEntries.slice(-2); // Last 2 periods
  
  if (recentEntries.length < 2) {
    return {
      trends: [],
      overallTrend: { current: 0, previous: 0, change: 0, direction: 'stable' },
      bestCategory: 'sleep',
      improvingCategory: null,
    };
  }

  const [previous, current] = recentEntries;
  
  // Calculate category trends (remember: lower ranking = better performance)
  const categories: Array<'sleep' | 'nutrition' | 'academics' | 'social'> = ['sleep', 'nutrition', 'academics', 'social'];
  const trends: CategoryTrend[] = categories.map(category => {
    const currentVal = current.rankings[category];
    const previousVal = previous.rankings[category];
    const change = previousVal - currentVal; // Inverted because lower is better
    
    return {
      category,
      current: currentVal,
      previous: previousVal,
      change: Math.abs(change),
      direction: change > 0.1 ? 'up' : change < -0.1 ? 'down' : 'stable',
    };
  });

  // Overall trend
  const overallChange = current.overallScore - previous.overallScore;
  const overallTrend = {
    current: current.overallScore,
    previous: previous.overallScore,
    change: Math.abs(overallChange),
    direction: overallChange > 0.1 ? 'up' as const : overallChange < -0.1 ? 'down' as const : 'stable' as const,
  };

  // Find best category (lowest ranking number = best performance)
  const bestCategory = categories.reduce((best, category) => 
    current.rankings[category] < current.rankings[best] ? category : best
  );

  // Find most improving category
  const improvingCategory = trends
    .filter(trend => trend.direction === 'up')
    .sort((a, b) => b.change - a.change)[0]?.category || null;

  return {
    trends,
    overallTrend,
    bestCategory,
    improvingCategory,
  };
};

// Format date for chart display
export const formatDateForChart = (dateString: string, period: 'daily' | 'weekly' | 'monthly'): string => {
  // Parse date string manually to avoid timezone issues
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day); // month is 0-indexed
  
  switch (period) {
    case 'daily':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case 'weekly':
      const endOfWeek = new Date(date);
      endOfWeek.setDate(date.getDate() + 6);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    case 'monthly':
      return date.toLocaleDateString('en-US', { month: 'short' });
    default:
      return dateString;
  }
};

// Get chart configuration for category colors
export const getCategoryChartConfig = () => ({
  sleep: { color: '#60a5fa', name: 'Sleep' },
  nutrition: { color: '#34d399', name: 'Nutrition' },
  academics: { color: '#fbbf24', name: 'Academics' },
  social: { color: '#f87171', name: 'Social' },
});