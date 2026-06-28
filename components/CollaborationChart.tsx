import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { type CompetitionColorSet } from '@/constants/competition';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { type CollaborationChartSeries } from '@/lib/collaborationChartData';

interface CollaborationChartProps {
  series: CollaborationChartSeries;
  colorSet: CompetitionColorSet;
  height?: number;
}

export function CollaborationChart({
  series,
  colorSet,
  height = 220,
}: CollaborationChartProps) {
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

  const chartWidth = Math.max(windowWidth - Spacing.lg * 4, 280);
  const axisColor = colors.border;
  const rulesColor = colors.muted;

  const stackData = useMemo(
    () =>
      series.bars.map((bar) => ({
        label: bar.label,
        stacks: bar.stacks.map((segment) => ({
          value: segment.value,
          color: segment.color,
        })),
      })),
    [series.bars],
  );

  if (series.isEmpty) {
    return (
      <View style={[styles.card, { backgroundColor: colorSet[50] }]}>
        <Text style={styles.title}>{series.title}</Text>
        {series.subtitle ? <Text style={styles.subtitle}>{series.subtitle}</Text> : null}
        <Text style={styles.emptyText}>Log activity to see progress</Text>
      </View>
    );
  }

  const barCount = Math.max(stackData.length, 1);
  const minChartWidth = barCount * 56 + 48;
  const contentWidth = Math.max(chartWidth, minChartWidth);

  return (
    <View style={[styles.card, { backgroundColor: colorSet[50] }]}>
      <Text style={styles.title}>{series.title}</Text>
      {series.subtitle ? <Text style={styles.subtitle}>{series.subtitle}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <BarChart
          stackData={stackData}
          width={contentWidth}
          height={height}
          barWidth={32}
          spacing={24}
          initialSpacing={16}
          endSpacing={16}
          noOfSections={4}
          maxValue={series.maxValue}
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor={axisColor}
          rulesColor={rulesColor}
          rulesType="solid"
          yAxisTextStyle={axisTextStyle}
          xAxisLabelTextStyle={axisTextStyle}
        />
      </ScrollView>
      {series.members.length > 0 && (
        <View style={styles.legend}>
          {series.members.map((member) => (
            <View key={member.userId} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: member.color }]} />
              <Text style={styles.legendText} numberOfLines={1}>
                {member.username}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
