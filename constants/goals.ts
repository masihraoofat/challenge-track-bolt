import { Colors } from './theme';
import { computeStreakFromDates, formatDuration, parseScreenTimeLog, toScoreNumber } from './competition';

export type GoalType = 'streak' | 'amount' | 'time' | 'checkin';
export type GoalLogInputType = 'checkin' | 'number' | 'duration';

export interface GoalColorSet {
  50: string;
  100: string;
  500: string;
  600: string;
  700: string;
}

export interface GoalTypeConfig {
  label: string;
  description: string;
  colorSet: GoalColorSet;
}

export const GOAL_TYPES: Record<GoalType, GoalTypeConfig> = {
  streak: {
    label: 'Streak',
    description: 'Build a consecutive daily habit',
    colorSet: Colors.primary,
  },
  amount: {
    label: 'Amount',
    description: 'Track a numeric target',
    colorSet: Colors.blue,
  },
  time: {
    label: 'Time',
    description: 'Track duration or time spent',
    colorSet: Colors.teal,
  },
  checkin: {
    label: 'Check-in',
    description: 'Simple daily yes/no completion',
    colorSet: {
      50: Colors.success[50],
      100: Colors.success[100],
      500: Colors.success[500],
      600: Colors.success[600],
      700: Colors.success[600],
    },
  },
};

export const GOAL_TYPE_ORDER: GoalType[] = ['streak', 'amount', 'time', 'checkin'];

export function getGoalTypeConfig(type: string): GoalTypeConfig {
  if (type in GOAL_TYPES) {
    return GOAL_TYPES[type as GoalType];
  }
  return GOAL_TYPES.streak;
}

export function normalizeGoalType(type: string): GoalType {
  if (type in GOAL_TYPES) return type as GoalType;
  return 'streak';
}

export function getGoalLogInputType(type: GoalType): GoalLogInputType {
  if (type === 'amount') return 'number';
  if (type === 'time') return 'duration';
  return 'checkin';
}

export function getGoalCheckInLabel(type: GoalType): string {
  if (type === 'amount') return "Log Today's Amount";
  if (type === 'time') return "Log Today's Time";
  if (type === 'checkin') return 'Check In Today';
  return 'Log Today';
}

export function getGoalLogValueLabel(type: GoalType): string {
  if (type === 'amount') return 'Amount today';
  if (type === 'time') return 'Time today';
  return '';
}

function trimZeros(n: number, maxDecimals: number): string {
  if (Number.isInteger(n)) return n.toString();
  return parseFloat(n.toFixed(maxDecimals)).toString();
}

export interface GoalLogStats {
  checkedInToday: boolean;
  todayValue: number | null;
  streak: number;
  total: number;
  logCount: number;
}

export function computeGoalLogStats(
  logs: { date_logged: string; value: unknown }[],
  today: string,
): GoalLogStats {
  const loggedDates = new Set<string>();
  let total = 0;
  let todayValue: number | null = null;
  let checkedInToday = false;

  logs.forEach((log) => {
    loggedDates.add(log.date_logged);
    const val = toScoreNumber(log.value);
    total += val;
    if (log.date_logged === today) {
      checkedInToday = true;
      todayValue = val;
    }
  });

  return {
    checkedInToday,
    todayValue,
    streak: computeStreakFromDates(loggedDates),
    total,
    logCount: logs.length,
  };
}

export function formatGoalStat(type: GoalType, stats: GoalLogStats): string {
  if (type === 'streak' || type === 'checkin') {
    if (stats.streak === 0) return 'No streak yet';
    return `${stats.streak} day${stats.streak === 1 ? '' : 's'} streak`;
  }
  if (type === 'amount') {
    if (stats.logCount === 0) return 'No logs yet';
    return `${trimZeros(stats.total, 1)} total`;
  }
  if (stats.logCount === 0) return 'No logs yet';
  return `${formatDuration(stats.total)} total`;
}

export function formatGoalTodayValue(type: GoalType, value: number): string {
  if (type === 'time') return formatDuration(value);
  return trimZeros(value, 1);
}

export function parseGoalLogValue(
  type: GoalType,
  valueStr: string,
  hoursStr: string,
  minutesStr: string,
): { value: number | null } | { error: string } {
  const logInputType = getGoalLogInputType(type);

  if (logInputType === 'checkin') {
    return { value: null };
  }

  if (logInputType === 'number') {
    const amount = parseFloat(valueStr);
    if (!valueStr.trim() || isNaN(amount) || amount < 0) {
      return { error: 'Please enter a valid amount' };
    }
    return { value: amount };
  }

  const parsed = parseScreenTimeLog(hoursStr, minutesStr);
  if ('error' in parsed) return parsed;
  return { value: parsed.decimalHours };
}
