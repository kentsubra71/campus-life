import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
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
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 80; // Card padding (32) + chart margins (48)

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

  // Calculate min/max for better scaling
  const values = data.map(d => d.overallScore);
  const minValue = Math.max(Math.min(...values) - 1, 1);
  const maxValue = Math.min(Math.max(...values) + 1, 10);

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
          spacing={data.length > 1 ? Math.max(40, (chartWidth - 100) / data.length) : 60}
          initialSpacing={30}
          endSpacing={30}
          
          // Line styling
          color={theme.colors.primary}
          thickness={3}
          curved
          curvature={0.2}
          
          // Data points
          dataPointsColor={theme.colors.primary}
          dataPointsRadius={4}
          focusedDataPointColor={theme.colors.primary}
          focusedDataPointRadius={6}
          
          // Grid and axes
          showVerticalLines={false}
          showHorizontalLines={true}
          horizontalLinesColor={theme.colors.border}
          yAxisColor={theme.colors.border}
          xAxisColor={theme.colors.border}
          
          // Y-axis configuration
          yAxisMinValue={minValue}
          yAxisMaxValue={maxValue}
          noOfSections={4}
          yAxisLabelTexts={['1', '3', '5', '7', '9']}
          yAxisTextStyle={{
            color: theme.colors.textTertiary,
            fontSize: 12,
          }}
          
          // Animation
          animateOnDataChange
          animationDuration={800}
          
          // Gradient fill
          areaChart
          startFillColor={`${theme.colors.primary}20`}
          endFillColor={`${theme.colors.primary}05`}
          startOpacity={0.4}
          endOpacity={0.1}
          
          // Tooltip
          showTooltip
          tooltipBgColor={theme.colors.backgroundCard}
          tooltipTextColor={theme.colors.textPrimary}
          
          // Responsive sizing
          adjustToWidth
        />
      </View>
      
      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: theme.colors.primary }]} />
          <Text style={styles.legendText}>Overall Wellness Score (1-10)</Text>
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
  },
  legend: {
    marginTop: 12,
    alignItems: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
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