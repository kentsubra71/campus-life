import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { theme } from '../../styles/theme';
import { ChartDataPoint, formatDateForChart, getCategoryChartConfig } from '../../utils/chartDataTransform';

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

  // Always prepare all data arrays, shift down by 1 to align with grid lines
  const primaryData = data.map((point) => ({
    value: point.sleep - 1, // Move down one position
    label: formatDateForChart(point.date, period),
  }));

  const nutritionData = data.map((point) => ({
    value: point.nutrition - 1, // Move down one position
    label: formatDateForChart(point.date, period),
  }));

  const academicsData = data.map((point) => ({
    value: point.academics - 1, // Move down one position
    label: formatDateForChart(point.date, period),
  }));

  const socialData = data.map((point) => ({
    value: point.social - 1, // Move down one position
    label: formatDateForChart(point.date, period),
  }));

  const toggleSeries = (series: keyof typeof visibleSeries) => {
    setVisibleSeries(prev => ({ ...prev, [series]: !prev[series] }));
  };


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Category Performance</Text>
      <Text style={styles.subtitle}>Wellness areas ranked from best (4) to worst (1)</Text>
      
      <View style={styles.chartContainer}>
        <LineChart
          data={primaryData}
          width={chartWidth}
          height={260}
          spacing={(chartWidth - 40) / Math.max(data.length - 1, 1)}
          initialSpacing={0}
          endSpacing={0}
          yAxisOffset={0}
          xAxisOffset={0}
          
          // Primary line (Sleep)
          color='#64748b'
          thickness={2}
          
          // Multi-line configuration - Control visibility with colors
          data2={visibleSeries.nutrition ? nutritionData : []}
          color2='#10b981'
          thickness2={2}
          
          data3={visibleSeries.academics ? academicsData : []}
          color3='#f59e0b'
          thickness3={2}
          
          data4={visibleSeries.social ? socialData : []}
          color4='#f43f5e'
          thickness4={2}
          
          // Enhanced data points
          dataPointsColor1='#64748b'
          dataPointsColor2='#10b981'
          dataPointsColor3='#f59e0b'
          dataPointsColor4='#f43f5e'
          dataPointsRadius={3}
          focusedDataPointRadius={5}
          hideDataPoints1={!visibleSeries.sleep}
          hideDataPoints2={!visibleSeries.nutrition}
          hideDataPoints3={!visibleSeries.academics}
          hideDataPoints4={!visibleSeries.social}
          
          // Subtle grid styling
          showVerticalLines={false}
          showHorizontalLines={true}
          horizontalLinesColor={`${theme.colors.border}25`}
          yAxisColor={`${theme.colors.border}60`}
          xAxisColor={`${theme.colors.border}60`}
          
          // Y-axis configuration - Simple 1-4 scale
          yAxisMinValue={1}
          yAxisMaxValue={4}
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
          }}
          
          // X-axis labels
          xAxisLabelTextStyle={{
            color: theme.colors.textTertiary,
            fontSize: 10,
            marginTop: 8,
          }}
          
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
    marginVertical: 16,
    paddingBottom: 20,
    overflow: 'hidden',
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