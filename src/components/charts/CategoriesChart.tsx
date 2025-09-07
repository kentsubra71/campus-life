import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { theme } from '../../styles/theme';
import { ChartDataPoint, formatDateForChart, getCategoryChartConfig } from '../../utils/chartDataTransform';

interface CategoriesChartProps {
  data: ChartDataPoint[];
  period: 'daily' | 'weekly' | 'monthly';
}

const CategoriesChart: React.FC<CategoriesChartProps> = ({ data, period }) => {
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 80; // Card padding (32) + chart margins (48)
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

  // Prepare data for multi-line chart
  const primaryData = data.map((point, index) => ({
    value: point.sleep,
    label: formatDateForChart(point.date, period),
  }));

  const nutritionData = data.map((point, index) => ({
    value: point.nutrition,
    label: formatDateForChart(point.date, period),
  }));

  const academicsData = data.map((point, index) => ({
    value: point.academics,
    label: formatDateForChart(point.date, period),
  }));

  const socialData = data.map((point, index) => ({
    value: point.social,
    label: formatDateForChart(point.date, period),
  }));


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Category Performance</Text>
      <Text style={styles.subtitle}>Wellness areas ranked from best (4) to worst (1)</Text>
      
      <View style={styles.chartContainer}>
        <LineChart
          data={primaryData}
          
          width={chartWidth}
          height={260}
          spacing={data.length > 1 ? Math.max(40, (chartWidth - 100) / data.length) : 60}
          initialSpacing={30}
          endSpacing={30}
          
          // Primary line (Sleep)
          color={categoryConfig.sleep.color}
          thickness={3}
          curved
          curvature={0.3}
          areaChart
          startFillColor={`${categoryConfig.sleep.color}20`}
          endFillColor={`${categoryConfig.sleep.color}05`}
          startOpacity={0.4}
          endOpacity={0.1}
          
          // Second line (Nutrition)
          data2={nutritionData}
          color2={categoryConfig.nutrition.color}
          thickness2={3}
          curved2
          curvature2={0.3}
          
          // Third line (Academics)
          data3={academicsData}
          color3={categoryConfig.academics.color}
          thickness3={3}
          curved3
          curvature3={0.3}
          
          // Fourth line (Social)
          data4={socialData}
          color4={categoryConfig.social.color}
          thickness4={3}
          curved4
          curvature4={0.3}
          
          // Data points
          dataPointsColor1={categoryConfig.sleep.color}
          dataPointsColor2={categoryConfig.nutrition.color}
          dataPointsColor3={categoryConfig.academics.color}
          dataPointsColor4={categoryConfig.social.color}
          dataPointsRadius={4}
          hideDataPoints1={false}
          hideDataPoints2={false}
          hideDataPoints3={false}
          hideDataPoints4={false}
          
          // Grid and axes
          showVerticalLines={false}
          showHorizontalLines={true}
          horizontalLinesColor={theme.colors.border}
          yAxisColor={theme.colors.border}
          xAxisColor={theme.colors.border}
          
          // Y-axis configuration (1-4 scale)
          yAxisMinValue={1}
          yAxisMaxValue={4}
          noOfSections={3}
          yAxisLabelTexts={['1', '2', '3', '4']}
          yAxisTextStyle={{
            color: theme.colors.textTertiary,
            fontSize: 12,
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
          
          // Responsive sizing
          adjustToWidth={true}
        />
      </View>
      
      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: categoryConfig.sleep.color }]} />
            <Text style={styles.legendText}>Sleep</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: categoryConfig.nutrition.color }]} />
            <Text style={styles.legendText}>Nutrition</Text>
          </View>
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: categoryConfig.academics.color }]} />
            <Text style={styles.legendText}>Academics</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: categoryConfig.social.color }]} />
            <Text style={styles.legendText}>Social</Text>
          </View>
        </View>
      </View>
      
      {/* Performance Note */}
      <View style={styles.noteContainer}>
        <Text style={styles.noteText}>Higher position = better performance in that area</Text>
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
  chartContainer: {
    alignItems: 'center',
    marginVertical: 16,
    paddingBottom: 20,
  },
  legend: {
    marginTop: 16,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  noteContainer: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  noteText: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
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