import {
  type CollaborationLog,
  type PeriodType,
  MEMBER_COLORS,
  PERIOD_LABELS,
  PERIOD_SHORT_LABELS,
  formatPeriodTarget,
  getPeriodBuckets,
  getWeeklyBuckets,
  sumMemberLogsInBucket,
  type PeriodBucket,
} from '@/constants/collaboration';
import { toScoreNumber } from '@/constants/competition';

export interface ChartMember {
  user_id: string;
  username: string;
}

export interface StackSegment {
  value: number;
  color: string;
  userId: string;
}

export interface StackedBarItem {
  label: string;
  stacks: StackSegment[];
  total: number;
}

export interface CollaborationChartSeries {
  periodType: PeriodType | 'overall';
  title: string;
  subtitle: string | null;
  bars: StackedBarItem[];
  maxValue: number;
  isEmpty: boolean;
  members: { userId: string; username: string; color: string }[];
}

export interface BuildChartParams {
  startDate: string;
  endDate: string | null;
  goalMode: string;
  unitLabel?: string | null;
  overallTargetValue?: number | string | null;
  goalPeriods: { period_type: PeriodType; target_value?: number | string | null }[];
  logs: CollaborationLog[];
  members: ChartMember[];
}

function assignMemberColors(members: ChartMember[]): Map<string, string> {
  const colorMap = new Map<string, string>();
  members.forEach((member, index) => {
    colorMap.set(member.user_id, MEMBER_COLORS[index % MEMBER_COLORS.length]);
  });
  return colorMap;
}

function buildBarsForBuckets(
  buckets: PeriodBucket[],
  logs: CollaborationLog[],
  members: ChartMember[],
  colorMap: Map<string, string>,
): StackedBarItem[] {
  return buckets.map((bucket) => {
    const stacks: StackSegment[] = members
      .map((member) => ({
        value: sumMemberLogsInBucket(logs, member.user_id, bucket),
        color: colorMap.get(member.user_id) ?? MEMBER_COLORS[0],
        userId: member.user_id,
      }))
      .filter((segment) => segment.value > 0);

    const total = stacks.reduce((sum, s) => sum + s.value, 0);
    return { label: bucket.label, stacks, total };
  });
}

function buildSeries(
  periodType: PeriodType | 'overall',
  title: string,
  subtitle: string | null,
  buckets: PeriodBucket[],
  logs: CollaborationLog[],
  members: ChartMember[],
): CollaborationChartSeries {
  const colorMap = assignMemberColors(members);
  const bars = buildBarsForBuckets(buckets, logs, members, colorMap);
  const maxValue = Math.max(1, ...bars.map((b) => b.total));
  const isEmpty = logs.length === 0;

  return {
    periodType,
    title,
    subtitle,
    bars,
    maxValue,
    isEmpty,
    members: members.map((m) => ({
      userId: m.user_id,
      username: m.username,
      color: colorMap.get(m.user_id) ?? MEMBER_COLORS[0],
    })),
  };
}

export function buildCollaborationChartSeries(params: BuildChartParams): CollaborationChartSeries[] {
  const { startDate, endDate, goalMode, unitLabel, overallTargetValue, goalPeriods, logs, members } =
    params;

  if (goalMode === 'overall') {
    const buckets = getWeeklyBuckets(startDate, endDate);
    const target = overallTargetValue != null ? toScoreNumber(overallTargetValue) : null;
    const subtitle =
      target != null && target > 0
        ? `Group target: ${target}${unitLabel?.trim() ? ` ${unitLabel.trim()}` : ''} total`
        : 'Total contributions by week';

    return [
      buildSeries('overall', 'Overall progress', subtitle, buckets, logs, members),
    ];
  }

  return goalPeriods.map((period) => {
    const periodType = period.period_type;
    const buckets = getPeriodBuckets(periodType, startDate, endDate);
    const targetStr = formatPeriodTarget(period.target_value, periodType, unitLabel);
    const subtitle = targetStr ? `Group target: ${targetStr}` : `Contributions per ${PERIOD_SHORT_LABELS[periodType]}`;

    return buildSeries(periodType, PERIOD_LABELS[periodType], subtitle, buckets, logs, members);
  });
}
