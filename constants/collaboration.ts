import { Colors } from './theme';
import { toLocalDateString, toScoreNumber } from '@/constants/competition';

export type GoalMode = 'overall' | 'periodic';
export type PeriodType = 'weekly' | 'monthly' | 'yearly';

export interface CollaborationRow {
  id: string;
  title: string;
  description?: string | null;
  creator_id: string;
  start_date: string;
  end_date?: string | null;
  unit_label?: string | null;
  icon?: string | null;
  color?: string | null;
  join_code: string;
  goal_mode: string;
  overall_target_value?: number | string | null;
  created_at?: string;
}

export interface CollaborationGoalPeriod {
  id: string;
  collaboration_id: string;
  period_type: PeriodType;
  target_value?: number | string | null;
}

export interface CollaborationMember {
  user_id: string;
  left_at?: string | null;
  users?: { username: string; avatar_url?: string | null };
}

export interface CollaborationLog {
  user_id: string;
  date_logged: string;
  value: unknown;
}

export const PERIOD_TYPES: PeriodType[] = ['weekly', 'monthly', 'yearly'];

export const PERIOD_LABELS: Record<PeriodType, string> = {
  weekly: 'Weekly goals',
  monthly: 'Monthly goals',
  yearly: 'Yearly goals',
};

export const PERIOD_SHORT_LABELS: Record<PeriodType, string> = {
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
};

export function isCollaborationContinuous(collab: Pick<CollaborationRow, 'end_date'>): boolean {
  return collab.end_date == null;
}

export function isCollaborationActive(collab: Pick<CollaborationRow, 'start_date' | 'end_date'>): boolean {
  const today = toLocalDateString();
  if (collab.start_date > today) return false;
  if (collab.end_date != null && collab.end_date < today) return false;
  return true;
}

export function formatCollabUnitScore(value: number, unitLabel?: string | null): string {
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
  if (unitLabel?.trim()) return `${rounded} ${unitLabel.trim()}`;
  return rounded;
}

export function formatPeriodTarget(
  target: number | string | null | undefined,
  periodType: PeriodType,
  unitLabel?: string | null,
): string | null {
  if (target == null) return null;
  const num = toScoreNumber(target);
  if (num <= 0) return null;
  return `${formatCollabUnitScore(num, unitLabel)} / ${PERIOD_SHORT_LABELS[periodType]}`;
}

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export interface PeriodBucket {
  index: number;
  label: string;
  startDate: string;
  endDate: string;
  isComplete: boolean;
}

function dateToStr(d: Date): string {
  return toLocalDateString(d);
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function startOfYear(year: number): Date {
  return new Date(year, 0, 1);
}

function endOfYear(year: number): Date {
  return new Date(year, 11, 31);
}

export function getWeeklyBuckets(
  startDate: string,
  endDate: string | null,
): PeriodBucket[] {
  const start = parseDate(startDate);
  const today = parseDate(toLocalDateString());
  const rangeEnd = endDate ? parseDate(endDate) : today;
  const effectiveEnd = rangeEnd < today ? rangeEnd : today;

  const buckets: PeriodBucket[] = [];
  let weekStart = new Date(start);
  let index = 1;

  while (weekStart <= effectiveEnd) {
    const weekEnd = addDays(weekStart, 6);
    const bucketEnd = weekEnd < effectiveEnd ? weekEnd : effectiveEnd;
    const isComplete = weekEnd <= effectiveEnd && (!endDate || weekEnd <= parseDate(endDate));

    buckets.push({
      index,
      label: `W${index}`,
      startDate: dateToStr(weekStart),
      endDate: dateToStr(bucketEnd),
      isComplete,
    });

    weekStart = addDays(weekStart, 7);
    index += 1;
  }

  return buckets;
}

export function getMonthlyBuckets(
  startDate: string,
  endDate: string | null,
): PeriodBucket[] {
  const start = parseDate(startDate);
  const today = parseDate(toLocalDateString());
  const rangeEnd = endDate ? parseDate(endDate) : today;
  const effectiveEnd = rangeEnd < today ? rangeEnd : today;

  const buckets: PeriodBucket[] = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  let index = 1;

  while (cursor <= effectiveEnd) {
    const monthStart = index === 1 ? start : new Date(cursor);
    const monthEndRaw = endOfMonth(cursor);
    const monthEnd = monthEndRaw < effectiveEnd ? monthEndRaw : effectiveEnd;
    const isComplete = monthEndRaw <= effectiveEnd && (!endDate || monthEndRaw <= parseDate(endDate));

    buckets.push({
      index,
      label: `M${index}`,
      startDate: dateToStr(monthStart),
      endDate: dateToStr(monthEnd),
      isComplete,
    });

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    index += 1;
  }

  return buckets;
}

export function getYearlyBuckets(
  startDate: string,
  endDate: string | null,
): PeriodBucket[] {
  const start = parseDate(startDate);
  const today = parseDate(toLocalDateString());
  const rangeEnd = endDate ? parseDate(endDate) : today;
  const effectiveEnd = rangeEnd < today ? rangeEnd : today;

  const buckets: PeriodBucket[] = [];
  let year = start.getFullYear();
  let index = 1;

  while (startOfYear(year) <= effectiveEnd) {
    const yearStart = index === 1 ? start : startOfYear(year);
    const yearEndRaw = endOfYear(year);
    const yearEnd = yearEndRaw < effectiveEnd ? yearEndRaw : effectiveEnd;
    const isComplete = yearEndRaw <= effectiveEnd && (!endDate || yearEndRaw <= parseDate(endDate));

    buckets.push({
      index,
      label: `Y${index}`,
      startDate: dateToStr(yearStart),
      endDate: dateToStr(yearEnd),
      isComplete,
    });

    year += 1;
    index += 1;
  }

  return buckets;
}

export function getPeriodBuckets(
  periodType: PeriodType,
  startDate: string,
  endDate: string | null,
): PeriodBucket[] {
  switch (periodType) {
    case 'weekly':
      return getWeeklyBuckets(startDate, endDate);
    case 'monthly':
      return getMonthlyBuckets(startDate, endDate);
    case 'yearly':
      return getYearlyBuckets(startDate, endDate);
  }
}

export function getCurrentPeriodBucket(
  periodType: PeriodType,
  startDate: string,
  endDate: string | null,
): PeriodBucket | null {
  const buckets = getPeriodBuckets(periodType, startDate, endDate);
  return buckets.length > 0 ? buckets[buckets.length - 1] : null;
}

export function sumLogsInBucket(
  logs: CollaborationLog[],
  bucket: PeriodBucket,
): number {
  let total = 0;
  logs.forEach((log) => {
    if (log.date_logged >= bucket.startDate && log.date_logged <= bucket.endDate) {
      total += toScoreNumber(log.value);
    }
  });
  return total;
}

export function sumMemberLogsInBucket(
  logs: CollaborationLog[],
  userId: string,
  bucket: PeriodBucket,
): number {
  let total = 0;
  logs.forEach((log) => {
    if (
      log.user_id === userId &&
      log.date_logged >= bucket.startDate &&
      log.date_logged <= bucket.endDate
    ) {
      total += toScoreNumber(log.value);
    }
  });
  return total;
}

export const MEMBER_COLORS = [
  Colors.primary[500],
  Colors.blue[500],
  Colors.teal[500],
  Colors.purple[500],
  Colors.success[500],
  Colors.warm[500],
  Colors.red[500],
];
