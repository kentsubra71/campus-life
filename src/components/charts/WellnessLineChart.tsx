import React from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { theme } from '../../styles/theme';
import { ChartDataPoint, formatDateForChart } from '../../utils/chartDataTransform';
import { parseLocalDateString, getLocalDateString } from '../../utils/dateUtils';

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

  // Create continuous date range for proper X-axis spacing - only for daily view
  const createContinuousData = (data: ChartDataPoint[]) => {
    if (data.length === 0) return [];
    
    // Only create continuous data for daily view, weekly/monthly should use actual data points
    if (period !== 'daily') {
      return data.map(point => ({
        value: (point.overallScore || 0) - 1, // Adjust for chart library's 0-based scaling
        label: formatDateForChart(point.date, period),
        labelTextStyle: {
          color: theme.colors.textTertiary,
          fontSize: 10,
          marginTop: 5,
        },
      }));
    }
    
    const sortedData = [...data].sort((a, b) => parseLocalDateString(a.date).getTime() - parseLocalDateString(b.date).getTime());
    const firstDate = parseLocalDateString(sortedData[0].date);
    const lastDate = parseLocalDateString(sortedData[sortedData.length - 1].date);
    
    const dataMap = new Map(sortedData.map(d => [d.date, d]));
    const continuousData = [];
    
    // Use a safer date iteration to avoid timezone issues
    const currentDate = new Date(firstDate);
    while (currentDate <= lastDate) {
      const dateStr = getLocalDateString(currentDate);
      const existing = dataMap.get(dateStr);
      
      const label = formatDateForChart(dateStr, period);
      
      if (existing) {
        continuousData.push({
          value: (existing.overallScore || 0) - 1, // Adjust for chart library's 0-based scaling
          label,
          labelTextStyle: {
            color: theme.colors.textTertiary,
            fontSize: 10,
            marginTop: 5,
          },
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

  const chartData = createContinuousData(data);

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
          height={220}
          spacing={(chartWidth - 60) / Math.max(chartData.length - 1, 1)}
          initialSpacing={20}
          endSpacing={20}
          yAxisOffset={0}
          
          // Professional line styling with reduced curvature
          color={theme.colors.primary}
          thickness={2.5}
          curved
          curvature={0.2}
          
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
          rulesLength={chartWidth - 60}
          yAxisColor={`${theme.colors.border}60`}
          xAxisColor={`${theme.colors.border}60`}
          
          // Y-axis configuration - Force 1-10 scale (but chart uses 0-9 values)
          yAxisMinValue={0}
          yAxisMaxValue={9}
          noOfSections={9}
          stepValue={1}
          yAxisLabelTexts={['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']}
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
            textAlign: 'center',
          }}
          
          // X-axis positioning to prevent cutoff
          xAxisThickness={1}
          xAxisLength={chartWidth - 60}
          
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
    marginVertical: 12,
    paddingBottom: 25,
    paddingTop: 10,
    overflow: 'visible',
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