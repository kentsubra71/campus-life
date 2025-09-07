import React from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { theme } from '../../styles/theme';
import { ChartDataPoint, formatDateForChart } from '../../utils/chartDataTransform';

interface WellnessLineChartProps {
  data: ChartDataPoint[];
  period: 'daily' | 'weekly' | 'monthly';
  title: string;
  subtitle?: string;
}

const WellnessLineChart: React.FC<WellnessLineChartProps> = ({ 
  data, 
  period, 
  title,
  subtitle 
}) => {
  // Fixed container approach - chart must fit in card
  const screenWidth = Dimensions.get('window').width;
  const cardPadding = 32; // Total card padding
  const containerWidth = screenWidth - cardPadding;
  const chartWidth = containerWidth - 60; // Leave room for Y-axis and margins
  
  console.log('📊 Overall chart sizing:', { 
    screenWidth, 
    containerWidth, 
    chartWidth, 
    dataPoints: data.length
  });

  if (data.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No data available</Text>
          <Text style={styles.emptySubtext}>Start logging your wellness to see trends</Text>
        </View>
      </View>
    );
  }

  // Transform data for chart
  const chartData = data.map((point, index) => ({
    value: point.overallScore,
    label: formatDateForChart(point.date, period),
    labelTextStyle: {
      color: theme.colors.textTertiary,
      fontSize: 10,
      marginTop: 5,
    },
  }));

  // Force Y domain to 1-10 for consistency
  const yAxisLabels = ['1', '3', '5', '7', '9'];
  const maxTicksX = Math.min(6, data.length); // Limit X-axis ticks to max 6

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      
      <View style={styles.chartContainer}>
        <LineChart
          data={chartData}
          width={chartWidth}
          height={240}
          spacing={(chartWidth - 40) / Math.max(data.length - 1, 1)}
          initialSpacing={0}
          endSpacing={0}
          yAxisOffset={0}
          xAxisOffset={0}
          
          // Professional line styling
          color={theme.colors.primary}
          thickness={2.5}
          curved
          curvature={0.3}
          
          // Enhanced data points
          dataPointsColor={theme.colors.primary}
          dataPointsRadius={5}
          focusedDataPointColor={theme.colors.primary}
          focusedDataPointRadius={7}
          hideDataPoints={false}
          
          // Subtle grid styling
          showVerticalLines={false}
          showHorizontalLines={true}
          horizontalLinesColor={`${theme.colors.border}30`}
          yAxisColor={`${theme.colors.border}60`}
          xAxisColor={`${theme.colors.border}60`}
          
          // Y-axis configuration - Force 1-10 scale
          yAxisMinValue={1}
          yAxisMaxValue={10}
          noOfSections={4}
          yAxisLabelTexts={yAxisLabels}
          yAxisLabelPrefix=""
          yAxisLabelSuffix=""
          yAxisTextStyle={{
            color: theme.colors.textTertiary,
            fontSize: 11,
            fontWeight: '500',
          }}
          xAxisLabelTextStyle={{
            color: theme.colors.textTertiary,
            fontSize: 10,
            fontWeight: '400',
          }}
          
          // Animation
          animateOnDataChange
          animationDuration={800}
          
          // Soft gradient area
          areaChart
          startFillColor={`${theme.colors.primary}25`}
          endFillColor={`${theme.colors.primary}05`}
          startOpacity={0.25}
          endOpacity={0.05}
          
          // Tooltip
          showTooltip
          tooltipBgColor={theme.colors.backgroundCard}
          tooltipTextColor={theme.colors.textPrimary}
          
        />
      </View>
      
      {/* Y-axis label */}
      <View style={styles.axisLabel}>
        <Text style={styles.axisLabelText}>Score (1-10)</Text>
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
  header: {
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
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 16,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  axisLabel: {
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: `${theme.colors.border}15`,
  },
  axisLabelText: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    fontWeight: '500',
    letterSpacing: 0.3,
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

export default WellnessLineChart;