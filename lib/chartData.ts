import { Colors } from '@/constants/theme';
import {
  type CompetitionConfig,
  toLocalDateString,
  toScoreNumber,
} from '@/constants/competition';

export interface ChartLog {
  user_id: string;
  date_logged: string;
  value: unknown;
}

export interface ChartParticipant {
  user_id: string;
  username: string;
}

export interface DailyBarItem {
  value: number;
  label: string;
  frontColor: string;
}

export interface DailyBarChartData {
  type: 'daily';
  bars: DailyBarItem[];
  maxValue: number;
  isEmpty: boolean;
}

export interface LineSeries {
  userId: string;
  username: string;
  color: string;
  data: { value: number; label?: string }[];
}

export interface CumulativeLineChartData {
  type: 'cumulative';
  series: LineSeries[];
  maxValue: number;
  isEmpty: boolean;
  pointCount: number;
}

export type CompetitionChartData = DailyBarChartData | CumulativeLineChartData;

const SERIES_COLORS = [
  Colors.primary[500],
  Colors.blue[500],
  Colors.teal[500],
  Colors.purple[500],
  Colors.success[500],
  Colors.warm[500],
  Colors.red[500],
];

const MAX_LINE_SERIES = 5;

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatShortDate(dateStr: string): string {
  const date = parseDate(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function truncateLabel(username: string, maxLen = 8): string {
  const trimmed = username.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = parseDate(startDate);
  const end = parseDate(endDate);

  while (current <= end) {
    dates.push(toLocalDateString(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function labelInterval(count: number): number {
  if (count <= 7) return 1;
  if (count <= 14) return 2;
  if (count <= 28) return 4;
  return Math.ceil(count / 7);
}

function chartEndDate(endDate: string): string {
  const today = toLocalDateString();
  return endDate < today ? endDate : today;
}

export function getChartSubtitle(config: CompetitionConfig): string {
  if (config.scoringMode === 'daily') return 'Days logged per participant';
  if (config.scoringMode === 'cumulative_low') return 'Running total — lower wins';
  return 'Total over time';
}

export function buildCompetitionChartData(
  config: CompetitionConfig,
  logs: ChartLog[],
  participants: ChartParticipant[],
  startDate: string,
  endDate: string,
  accentColor: string,
): CompetitionChartData {
  if (config.scoringMode === 'daily') {
    return buildDailyBarChartData(logs, participants, accentColor);
  }
  return buildCumulativeLineChartData(
    config,
    logs,
    participants,
    startDate,
    chartEndDate(endDate),
  );
}

function buildDailyBarChartData(
  logs: ChartLog[],
  participants: ChartParticipant[],
  accentColor: string,
): DailyBarChartData {
  const counts: Record<string, number> = {};
  logs.forEach((log) => {
    counts[log.user_id] = (counts[log.user_id] || 0) + 1;
  });

  const sorted = [...participants].sort(
    (a, b) => (counts[b.user_id] || 0) - (counts[a.user_id] || 0),
  );

  const bars: DailyBarItem[] = sorted.map((participant) => ({
    value: counts[participant.user_id] || 0,
    label: truncateLabel(participant.username),
    frontColor: accentColor,
  }));

  const maxValue = Math.max(1, ...bars.map((bar) => bar.value));
  const isEmpty = logs.length === 0;

  return { type: 'daily', bars, maxValue, isEmpty };
}

function buildCumulativeLineChartData(
  config: CompetitionConfig,
  logs: ChartLog[],
  participants: ChartParticipant[],
  startDate: string,
  endDate: string,
): CumulativeLineChartData {
  const dates = enumerateDates(startDate, endDate);
  const interval = labelInterval(dates.length);
  const valuesByUserDate: Record<string, Record<string, number>> = {};

  logs.forEach((log) => {
    if (!valuesByUserDate[log.user_id]) {
      valuesByUserDate[log.user_id] = {};
    }
    valuesByUserDate[log.user_id][log.date_logged] = toScoreNumber(log.value);
  });

  const participantFinals = participants.map((participant) => {
    let total = 0;
    dates.forEach((date) => {
      total += valuesByUserDate[participant.user_id]?.[date] ?? 0;
    });
    return { participant, total };
  });

  participantFinals.sort((a, b) =>
    config.sortOrder === 'asc' ? a.total - b.total : b.total - a.total,
  );

  const visibleParticipants = participantFinals
    .slice(0, MAX_LINE_SERIES)
    .map((entry) => entry.participant);

  const series: LineSeries[] = visibleParticipants.map((participant, index) => {
    let runningTotal = 0;
    const data = dates.map((date, dateIndex) => {
      runningTotal += valuesByUserDate[participant.user_id]?.[date] ?? 0;
      const label =
        dateIndex === 0 || dateIndex === dates.length - 1 || dateIndex % interval === 0
          ? formatShortDate(date)
          : '';
      return { value: runningTotal, label };
    });

    return {
      userId: participant.user_id,
      username: participant.username,
      color: SERIES_COLORS[index % SERIES_COLORS.length],
      data,
    };
  });

  const maxValue = Math.max(
    1,
    ...series.flatMap((entry) => entry.data.map((point) => point.value)),
  );

  return {
    type: 'cumulative',
    series,
    maxValue,
    isEmpty: logs.length === 0,
    pointCount: dates.length,
  };
}
