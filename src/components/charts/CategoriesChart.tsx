import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { theme } from '../../styles/theme';
import { ChartDataPoint, formatDateForChart, getCategoryChartConfig } from '../../utils/chartDataTransform';
import { parseLocalDateString, getLocalDateString } from '../../utils/dateUtils';

interface CategoriesChartProps {
  data: ChartDataPoint[];
  period: 'daily' | 'weekly' | 'monthly';
}

const CategoriesChart: React.FC<CategoriesChartProps> = ({ data, period }) => {
  // Interactive legend state
  const [visibleSeries, setVisibleSeries] = useState({
    sleep: true,
    nutrition: true,
    academics: true,
    social: true,
  });

  // Professional color palette
  const colors = {
    sleep: '#64748b', // slate
    nutrition: '#10b981', // emerald 
    academics: '#f59e0b', // amber
    social: '#f43f5e', // rose
  };
  // Fixed container approach - chart must fit in card
  const screenWidth = Dimensions.get('window').width;
  const cardPadding = 32; // Total card padding
  const containerWidth = screenWidth - cardPadding;
  const chartWidth = containerWidth - 60; // Leave room for Y-axis and margins
  
  console.log('📊 Chart sizing:', { 
    screenWidth, 
    containerWidth, 
    chartWidth, 
    dataPoints: data.length
  });
  const categoryConfig = getCategoryChartConfig();

  if (data.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Category Trends</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No data available</Text>
          <Text style={styles.emptySubtext}>Start logging your wellness to see category trends</Text>
        </View>
      </View>
    );
  }

  // Create continuous date range for proper X-axis spacing - only for daily view
  const createContinuousData = (data: ChartDataPoint[], category: string) => {
    if (data.length === 0) return [];
    
    // Only create continuous data for daily view, weekly/monthly should use actual data points
    if (period !== 'daily') {
      return data.map(point => {
        const categoryValue = (point[category as keyof ChartDataPoint] as number) || 1;
        const reInverted = 5 - categoryValue; // Un-invert: 4→1, 1→4
        return {
          value: reInverted - 1, // Convert to 0-3 for chart library
          label: formatDateForChart(point.date, period),
        };
      });
    }
    
    const sortedData = [...data].sort((a, b) => parseLocalDateString(a.date).getTime() - parseLocalDateString(b.date).getTime());
    const firstDate = parseLocalDateString(sortedData[0].date);
    const lastDate = parseLocalDateString(sortedData[sortedData.length - 1].date);
    
    const dataMap = new Map(sortedData.map(d => [d.date, d]));
    const continuousData = [];
    
    const currentDate = new Date(firstDate);
    while (currentDate <= lastDate) {
      const dateStr = getLocalDateString(currentDate);
      const existing = dataMap.get(dateStr);
      
      if (existing) {
        // Category values are already inverted by transformEntriesForCharts
        // Original: 1(worst)→4, 4(best)→1. We want: 4(best)→top, 1(worst)→bottom
        // So we need to re-invert them, then subtract 1 for chart library
        const categoryValue = (existing[category as keyof ChartDataPoint] as number) || 1;
        const reInverted = 5 - categoryValue; // Un-invert: 4→1, 1→4
        continuousData.push({
          value: reInverted - 1, // Convert to 0-3 for chart library
          label: formatDateForChart(dateStr, period),
        });
      } else {
        // Skip missing dates entirely to avoid NaN errors
        // Don't add placeholder points
      }
      
      // Increment date safely
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return continuousData;
  };

  const sleepData = createContinuousData(data, 'sleep');
  const nutritionData = createContinuousData(data, 'nutrition');  
  const academicsData = createContinuousData(data, 'academics');
  const socialData = createContinuousData(data, 'social');

  const toggleSeries = (series: keyof typeof visibleSeries) => {
    setVisibleSeries(prev => ({ ...prev, [series]: !prev[series] }));
  };


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Category Performance</Text>
      <Text style={styles.subtitle}>Wellness areas ranked from best (4) to worst (1)</Text>
      
      <View style={styles.chartContainer}>
        <LineChart
          key={`${period}-${data.length}-${data[0]?.date || 'empty'}`}
          data={sleepData}
          width={chartWidth}
          height={240}
          spacing={(chartWidth - 60) / Math.max(sleepData.length - 1, 1)}
          initialSpacing={20}
          endSpacing={20}
          yAxisOffset={0}
          
          // Sleep line - Subtle curves
          color={colors.sleep}
          thickness={visibleSeries.sleep ? 2.5 : 0}
          curved
          curvature={0.1}
          hideDataPoints={!visibleSeries.sleep}
          dataPointsColor1={colors.sleep}
          dataPointsRadius={3}
          focusedDataPointRadius={5}
          
          // Nutrition line
          data2={nutritionData}
          color2={colors.nutrition}
          thickness2={visibleSeries.nutrition ? 2.5 : 0}
          curved2
          curvature2={0.1}
          hideDataPoints2={!visibleSeries.nutrition}
          dataPointsColor2={colors.nutrition}
          
          // Academics line  
          data3={academicsData}
          color3={colors.academics}
          thickness3={visibleSeries.academics ? 2.5 : 0}
          curved3
          curvature3={0.1}
          hideDataPoints3={!visibleSeries.academics}
          dataPointsColor3={colors.academics}
          
          // Social line
          data4={socialData}
          color4={colors.social}
          thickness4={visibleSeries.social ? 2.5 : 0}
          curved4
          curvature4={0.1}
          hideDataPoints4={!visibleSeries.social}
          dataPointsColor4={colors.social}
          
          // Subtle grid styling
          showVerticalLines={false}
          showHorizontalLines={true}
          horizontalLinesColor={`${theme.colors.border}25`}
          rulesLength={chartWidth - 60}
          yAxisColor={`${theme.colors.border}60`}
          xAxisColor={`${theme.colors.border}60`}
          
          // Y-axis configuration - Simple 1-4 scale (but chart uses 0-3 values)
          yAxisMinValue={0}
          yAxisMaxValue={3}
          noOfSections={3}
          stepValue={1}
          yAxisLabelTexts={['1', '2', '3', '4']}
          yAxisTextStyle={{
            color: theme.colors.textTertiary,
            fontSize: 10,
            fontWeight: '500',
          }}
          xAxisLabelTextStyle={{
            color: theme.colors.textTertiary,
            fontSize: 9,
            fontWeight: '400',
            textAlign: 'center',
          }}
          
          // X-axis positioning to prevent cutoff
          xAxisOffset={0}
          xAxisThickness={1}
          xAxisLength={chartWidth - 60}
          
          // Animation
          animateOnDataChange
          animationDuration={1200}
          
          // Tooltip
          showTooltip
          tooltipBgColor={theme.colors.backgroundCard}
          tooltipTextColor={theme.colors.textPrimary}
          
        />
      </View>
      
      {/* Interactive Legend */}
      <View style={styles.interactiveLegend}>
        {Object.entries(colors).map(([key, color]) => {
          const isVisible = visibleSeries[key as keyof typeof visibleSeries];
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.legendButton,
                { opacity: isVisible ? 1 : 0.4 }
              ]}
              onPress={() => toggleSeries(key as keyof typeof visibleSeries)}
              accessibilityRole="button"
              accessibilityState={{ pressed: isVisible }}
              accessibilityLabel={`${isVisible ? 'Hide' : 'Show'} ${key} data`}
            >
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={[styles.legendLabel, { opacity: isVisible ? 1 : 0.6 }]}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      
      {/* Rank explanation */}
      <View style={styles.rankExplanation}>
        <Text style={styles.rankText}>Rank 4 = Best Performance • Rank 1 = Needs Improvement</Text>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
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
  chartContainer: {
    alignItems: 'center',
    marginVertical: 12,
    paddingBottom: 25,
    paddingTop: 10,
    overflow: 'visible',
  },
  interactiveLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: `${theme.colors.border}15`,
  },
  legendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  rankExplanation: {
    alignItems: 'center',
    marginTop: 8,
  },
  rankText: {
    fontSize: 10,
    color: theme.colors.textTertiary,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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

export default CategoriesChart;