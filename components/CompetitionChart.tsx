import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import {
  type CompetitionConfig,
  type CompetitionColorSet,
} from '@/constants/competition';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import {
  buildCompetitionChartData,
  getChartSubtitle,
  type ChartLog,
  type ChartParticipant,
} from '@/lib/chartData';

interface CompetitionChartProps {
  config: CompetitionConfig;
  logs: ChartLog[];
  participants: ChartParticipant[];
  startDate: string;
  endDate: string;
  colorSet: CompetitionColorSet;
  height?: number;
}

export function CompetitionChart({
  config,
  logs,
  participants,
  startDate,
  endDate,
  colorSet,
  height = 220,
}: CompetitionChartProps) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          marginHorizontal: Spacing.lg,
          marginBottom: Spacing.lg,
          borderRadius: BorderRadius.lg,
          padding: Spacing.lg,
          borderWidth: 1,
          borderColor: colors.mutedBorder,
        },
        title: {
          fontSize: FontSizes.lg,
          fontWeight: '700',
          color: colors.text,
          marginBottom: Spacing.xs,
        },
        subtitle: {
          fontSize: FontSizes.sm,
          color: colors.textSecondary,
          marginBottom: Spacing.md,
        },
        emptyText: {
          fontSize: FontSizes.sm,
          color: Colors.neutral[400],
          textAlign: 'center',
          paddingVertical: Spacing.lg,
        },
        legend: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: Spacing.sm,
          marginTop: Spacing.md,
        },
        legendItem: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.xs,
          maxWidth: '48%',
        },
        legendDot: {
          width: 8,
          height: 8,
          borderRadius: BorderRadius.full,
        },
        legendText: {
          fontSize: FontSizes.xs,
          color: colors.textSecondary,
          flexShrink: 1,
        },
      }),
    [colors],
  );

  const axisTextStyle = useMemo(
    () => ({
      color: colors.textSecondary,
      fontSize: FontSizes.xs,
    }),
    [colors.textSecondary],
  );

  const chartData = useMemo(
    () =>
      buildCompetitionChartData(
        config,
        logs,
        participants,
        startDate,
        endDate,
        colorSet[500],
      ),
    [config, logs, participants, startDate, endDate, colorSet],
  );

  const subtitle = getChartSubtitle(config);
  const chartWidth = Math.max(windowWidth - Spacing.lg * 4, 280);
  const axisColor = colors.border;
  const rulesColor = colors.muted;

  if (chartData.isEmpty) {
    return (
      <View style={[styles.card, { backgroundColor: colorSet[50] }]}>
        <Text style={styles.title}>Progress</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Text style={styles.emptyText}>Log activity to see progress</Text>
      </View>
    );
  }

  if (chartData.type === 'daily') {
    const barCount = Math.max(chartData.bars.length, 1);
    const minChartWidth = barCount * 56 + 48;
    const contentWidth = Math.max(chartWidth, minChartWidth);

    return (
      <View style={[styles.card, { backgroundColor: colorSet[50] }]}>
        <Text style={styles.title}>Progress</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <BarChart
            data={chartData.bars}
            width={contentWidth}
            height={height}
            barWidth={32}
            spacing={24}
            initialSpacing={16}
            endSpacing={16}
            roundedTop
            roundedBottom
            noOfSections={4}
            maxValue={chartData.maxValue}
            yAxisThickness={0}
            xAxisThickness={1}
            xAxisColor={axisColor}
            rulesColor={rulesColor}
            rulesType="solid"
            yAxisTextStyle={axisTextStyle}
            xAxisLabelTextStyle={axisTextStyle}
          />
        </ScrollView>
      </View>
    );
  }

  const spacing = chartData.pointCount > 14 ? 18 : 28;
  const minChartWidth = chartData.pointCount * spacing + 48;
  const contentWidth = Math.max(chartWidth, minChartWidth);

  return (
    <View style={[styles.card, { backgroundColor: colorSet[50] }]}>
      <Text style={styles.title}>Progress</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <LineChart
          dataSet={chartData.series.map((series) => ({
            data: series.data,
            color: series.color,
          }))}
          width={contentWidth}
          height={height}
          spacing={spacing}
          initialSpacing={12}
          endSpacing={12}
          curved
          thickness={2}
          hideDataPoints={chartData.pointCount > 14}
          dataPointsRadius={3}
          noOfSections={4}
          maxValue={Math.ceil(chartData.maxValue * 1.1)}
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor={axisColor}
          rulesColor={rulesColor}
          rulesType="solid"
          yAxisTextStyle={axisTextStyle}
          xAxisLabelTextStyle={axisTextStyle}
        />
      </ScrollView>
      <View style={styles.legend}>
        {chartData.series.map((series) => (
          <View key={series.userId} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: series.color }]} />
            <Text style={styles.legendText} numberOfLines={1}>
              {series.username}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
