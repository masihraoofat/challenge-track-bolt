import { Colors } from './theme';
import { buildColorSetFromHex, isCustomHexColor } from '@/lib/colorUtils';

export type ScoringMode = 'daily' | 'cumulative_high' | 'cumulative_low';
export type LogInputType = 'checkin' | 'number' | 'duration';
export type CompetitionColor =
  | 'primary'
  | 'blue'
  | 'teal'
  | 'success'
  | 'warm'
  | 'purple'
  | 'red';
export type CompetitionIcon =
  | 'trophy'
  | 'book'
  | 'activity'
  | 'flame'
  | 'target'
  | 'zap'
  | 'star'
  | 'heart'
  | 'clock'
  | 'dumbbell'
  | 'apple'
  | 'coffee'
  | 'smartphone'
  | 'sparkles'
  | 'bike'
  | 'moon'
  | 'sun'
  | 'medal'
  | 'music'
  | 'leaf';

export interface CompetitionColorSet {
  50: string;
  100: string;
  200: string;
  400: string;
  500: string;
  600: string;
  700: string;
}

export const COMPETITION_COLORS: Record<CompetitionColor, CompetitionColorSet> = {
  primary: Colors.primary,
  blue: Colors.blue,
  teal: Colors.teal,
  purple: Colors.purple,
  red: Colors.red,
  warm: {
    50: Colors.warm[50],
    100: Colors.warm[100],
    200: Colors.warm[200],
    400: Colors.warm[400],
    500: Colors.warm[500],
    600: '#E89B2E',
    700: '#CC8520',
  },
  success: {
    50: Colors.success[50],
    100: Colors.success[100],
    200: Colors.success[100],
    400: Colors.success[400],
    500: Colors.success[500],
    600: Colors.success[600],
    700: Colors.success[600],
  },
};

export const COMPETITION_COLOR_ORDER: CompetitionColor[] = [
  'primary',
  'blue',
  'teal',
  'success',
  'warm',
  'purple',
  'red',
];

export const COMPETITION_ICON_ORDER: CompetitionIcon[] = [
  'trophy',
  'flame',
  'target',
  'star',
  'book',
  'activity',
  'dumbbell',
  'heart',
  'zap',
  'clock',
  'apple',
  'coffee',
  'smartphone',
  'sparkles',
  'bike',
  'moon',
  'sun',
  'medal',
  'music',
  'leaf',
];

export interface CompetitionRow {
  scoring_mode?: string | null;
  unit_label?: string | null;
  description?: string | null;
  title?: string;
  icon?: string | null;
  color?: string | null;
}

export interface CompetitionConfig {
  scoringMode: ScoringMode;
  unitLabel: string | null;
  description: string | null;
  sortOrder: 'desc' | 'asc';
  logInputType: LogInputType;
  label: string;
  icon: CompetitionIcon;
  color: string;
  colorSet: CompetitionColorSet;
}

export const SCORING_MODES: Record<ScoringMode, {
  label: string;
  subtitle: string;
  sortOrder: 'desc' | 'asc';
  requiresUnit: boolean;
}> = {
  daily: {
    label: 'Daily Streak',
    subtitle: 'Log each day — most days wins',
    sortOrder: 'desc',
    requiresUnit: false,
  },
  cumulative_high: {
    label: 'Total Score',
    subtitle: 'Add a number each day — highest total wins',
    sortOrder: 'desc',
    requiresUnit: true,
  },
  cumulative_low: {
    label: 'Lowest Total',
    subtitle: 'Add a number each day — lowest total wins',
    sortOrder: 'asc',
    requiresUnit: true,
  },
};

function normalizeScoringMode(mode: string | null | undefined): ScoringMode {
  if (mode === 'daily' || mode === 'cumulative_high' || mode === 'cumulative_low') {
    return mode;
  }
  return 'daily';
}

function normalizePresetColor(color: string | null | undefined): CompetitionColor {
  if (color && color in COMPETITION_COLORS) {
    return color as CompetitionColor;
  }
  return 'primary';
}

export function resolveCompetitionColorSet(color: string | null | undefined): CompetitionColorSet {
  if (isCustomHexColor(color)) {
    return buildColorSetFromHex(color!) ?? COMPETITION_COLORS.primary;
  }
  return COMPETITION_COLORS[normalizePresetColor(color)];
}

export function isPresetColor(color: string | null | undefined): color is CompetitionColor {
  return !!color && color in COMPETITION_COLORS;
}

function normalizeIcon(icon: string | null | undefined): CompetitionIcon {
  if (icon && COMPETITION_ICON_ORDER.includes(icon as CompetitionIcon)) {
    return icon as CompetitionIcon;
  }
  return 'trophy';
}

function isDurationUnit(unit: string | null | undefined): boolean {
  if (!unit) return false;
  const u = unit.trim().toLowerCase();
  return (
    u === 'hr' ||
    u === 'hrs' ||
    u === 'hour' ||
    u === 'hours' ||
    u === 'min' ||
    u === 'mins' ||
    u === 'minute' ||
    u === 'minutes'
  );
}

/** Derive the log UI from scoring mode and unit label. */
function resolveLogInputType(scoringMode: ScoringMode, unitLabel: string | null): LogInputType {
  if (isDurationUnit(unitLabel)) return 'duration';
  if (scoringMode === 'daily' && !unitLabel?.trim()) return 'checkin';
  return 'number';
}

export function getCompetitionConfig(competition: CompetitionRow | null | undefined): CompetitionConfig {
  const scoringMode = normalizeScoringMode(competition?.scoring_mode);
  const scoringConfig = SCORING_MODES[scoringMode];
  const unitLabel = competition?.unit_label?.trim() || null;
  const logInputType = resolveLogInputType(scoringMode, unitLabel);
  const storedColor = competition?.color?.trim() || 'primary';
  const icon = normalizeIcon(competition?.icon);

  return {
    scoringMode,
    unitLabel,
    description: competition?.description?.trim() || null,
    sortOrder: scoringConfig.sortOrder,
    logInputType,
    label: scoringConfig.label,
    icon,
    color: storedColor,
    colorSet: resolveCompetitionColorSet(storedColor),
  };
}

/** Supabase returns PostgreSQL numeric columns as strings — normalize everywhere. */
export function toScoreNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function trimZeros(n: number, maxDecimals: number): string {
  if (Number.isInteger(n)) return n.toString();
  return parseFloat(n.toFixed(maxDecimals)).toString();
}

export function formatDuration(decimalHours: unknown): string {
  const safe = Math.max(0, toScoreNumber(decimalHours));
  const totalMinutes = Math.round(safe * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0 && minutes === 0) return '0 min';
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr${hours === 1 ? '' : 's'}`;
  return `${hours} hr${hours === 1 ? '' : 's'} ${minutes} min`;
}

export function parseDurationLog(
  hoursStr: string,
  minutesStr: string,
): { decimalHours: number } | { error: string } {
  const hoursTrimmed = hoursStr.trim();
  const minutesTrimmed = minutesStr.trim();

  if (!hoursTrimmed && !minutesTrimmed) {
    return { error: 'Please enter hours and/or minutes' };
  }

  const hours = hoursTrimmed ? parseInt(hoursTrimmed, 10) : 0;
  const minutes = minutesTrimmed ? parseInt(minutesTrimmed, 10) : 0;

  if (isNaN(hours) || hours < 0) {
    return { error: 'Please enter valid hours' };
  }
  if (isNaN(minutes) || minutes < 0 || minutes > 59) {
    return { error: 'Minutes must be between 0 and 59' };
  }

  return { decimalHours: hours + minutes / 60 };
}

/** @deprecated Use parseDurationLog */
export const parseScreenTimeLog = parseDurationLog;

export function formatUnitScore(score: number, unitLabel: string | null, logInputType: LogInputType): string {
  if (logInputType === 'duration' || isDurationUnit(unitLabel)) {
    return formatDuration(score);
  }
  const unit = unitLabel || 'pts';
  const formatted = trimZeros(score, 1);
  return `${formatted} ${unit}`;
}

export function resolveCompetitionScore(
  config: CompetitionConfig,
  participantScore: unknown,
  logTotal: number,
  logCount: number,
): { score: number; hasLogged: boolean } {
  const storedScore = toScoreNumber(participantScore);

  if (config.scoringMode === 'daily') {
    const score = logCount > 0 ? logCount : storedScore;
    return { score, hasLogged: logCount > 0 || storedScore > 0 };
  }

  const hasLogged = logCount > 0 || storedScore > 0;

  if (logCount > 0) {
    return { score: logTotal, hasLogged: true };
  }

  return { score: storedScore, hasLogged: storedScore > 0 };
}

export function formatLeaderboardScore(
  config: CompetitionConfig,
  score: unknown,
  hasLogged: boolean,
): string {
  const safe = toScoreNumber(score);

  if (config.scoringMode === 'daily') {
    const n = Math.round(safe);
    if (!hasLogged) return 'No logs yet';
    return `${n} ${n === 1 ? 'day' : 'days'}`;
  }

  if (!hasLogged) {
    return 'No logs yet';
  }

  return formatUnitScore(safe, config.unitLabel, config.logInputType);
}

export function formatScore(config: CompetitionConfig, score: unknown): string {
  const safe = toScoreNumber(score);
  return formatLeaderboardScore(config, safe, safe > 0);
}

export function getLeaderboardTitle(config: CompetitionConfig): string {
  if (config.scoringMode === 'cumulative_low') return 'Lowest Total';
  return 'Leaderboard';
}

export function getCheckInLabel(config: CompetitionConfig): string {
  if (config.scoringMode === 'daily') return "Log Today's Progress";
  if (config.logInputType === 'duration') return "Log Today's Time";
  return "Log Today's Entry";
}

export function getLogValueLabel(config: CompetitionConfig): string {
  if (config.logInputType === 'duration') return 'Time today';
  const unit = config.unitLabel || 'units';
  return `${unit.charAt(0).toUpperCase() + unit.slice(1)} today`;
}

/** YYYY-MM-DD in the user's local timezone. */
export function toLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Count consecutive logged days ending today (or yesterday if today not logged). */
export function computeStreakFromDates(loggedDates: Set<string>, maxDays = 30): number {
  if (loggedDates.size === 0) return 0;

  const checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);
  let streak = 0;

  for (let i = 0; i < maxDays; i++) {
    const dateStr = toLocalDateString(checkDate);
    if (loggedDates.has(dateStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}
