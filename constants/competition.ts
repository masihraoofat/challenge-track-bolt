import { Colors } from './theme';

export type ScoringMode = 'daily' | 'cumulative_high' | 'cumulative_low';
export type CompetitionPreset = 'reading' | 'running' | 'screen_time' | 'custom';
export type LogInputType = 'checkin' | 'number' | 'duration';

/** @deprecated Use CompetitionPreset — kept for gradual migration */
export type CompetitionType = CompetitionPreset;

export interface CompetitionRow {
  competition_type?: string | null;
  scoring_mode?: string | null;
  unit_label?: string | null;
  description?: string | null;
  title?: string;
}

export interface CompetitionConfig {
  preset: CompetitionPreset;
  scoringMode: ScoringMode;
  unitLabel: string | null;
  description: string | null;
  sortOrder: 'desc' | 'asc';
  logInputType: LogInputType;
  label: string;
  placeholder: string;
  colorSet: typeof Colors.primary;
  icon: string;
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

export const COMPETITION_PRESETS: Record<CompetitionPreset, {
  label: string;
  defaultScoringMode: ScoringMode;
  defaultUnitLabel: string | null;
  logInputType: LogInputType;
  placeholder: string;
  colorSet: typeof Colors.primary;
  icon: string;
}> = {
  reading: {
    label: 'Reading',
    defaultScoringMode: 'daily',
    defaultUnitLabel: null,
    logInputType: 'checkin',
    placeholder: 'e.g. Read 20 pages a day',
    colorSet: Colors.primary,
    icon: 'BookOpen',
  },
  running: {
    label: 'Running',
    defaultScoringMode: 'cumulative_high',
    defaultUnitLabel: 'km',
    logInputType: 'number',
    placeholder: 'e.g. Run 5km a day',
    colorSet: Colors.blue,
    icon: 'Activity',
  },
  screen_time: {
    label: 'Screen Time',
    defaultScoringMode: 'cumulative_low',
    defaultUnitLabel: 'hr',
    logInputType: 'duration',
    placeholder: 'e.g. Under 2 hours screen time',
    colorSet: Colors.teal,
    icon: 'Smartphone',
  },
  custom: {
    label: 'Custom',
    defaultScoringMode: 'cumulative_high',
    defaultUnitLabel: null,
    logInputType: 'number',
    placeholder: 'e.g. Drink 8 glasses of water daily',
    colorSet: Colors.primary,
    icon: 'Sparkles',
  },
};

/** @deprecated Use COMPETITION_PRESETS */
export const COMPETITION_TYPES = COMPETITION_PRESETS;

function normalizePreset(type: string | null | undefined): CompetitionPreset {
  if (type === 'reading' || type === 'running' || type === 'screen_time' || type === 'custom') {
    return type;
  }
  return 'reading';
}

function normalizeScoringMode(mode: string | null | undefined, preset: CompetitionPreset): ScoringMode {
  if (mode === 'daily' || mode === 'cumulative_high' || mode === 'cumulative_low') {
    return mode;
  }
  return COMPETITION_PRESETS[preset].defaultScoringMode;
}

export function getCompetitionConfig(competition: CompetitionRow | null | undefined): CompetitionConfig {
  const preset = normalizePreset(competition?.competition_type);
  const presetDefaults = COMPETITION_PRESETS[preset];
  const scoringMode = normalizeScoringMode(competition?.scoring_mode, preset);
  const scoringConfig = SCORING_MODES[scoringMode];

  let logInputType = presetDefaults.logInputType;
  if (preset === 'custom') {
    logInputType = scoringMode === 'daily' ? 'checkin' : 'number';
  } else if (preset === 'screen_time' && scoringMode === 'cumulative_low') {
    logInputType = 'duration';
  } else if (scoringMode === 'daily') {
    logInputType = 'checkin';
  } else if (logInputType === 'duration' && preset !== 'screen_time') {
    logInputType = 'number';
  }

  const unitLabel =
    competition?.unit_label?.trim() ||
    presetDefaults.defaultUnitLabel ||
    null;

  return {
    preset,
    scoringMode,
    unitLabel,
    description: competition?.description?.trim() || null,
    sortOrder: scoringConfig.sortOrder,
    logInputType,
    label: preset === 'custom' ? 'Custom Challenge' : presetDefaults.label,
    placeholder: presetDefaults.placeholder,
    colorSet: presetDefaults.colorSet,
    icon: presetDefaults.icon,
  };
}

/** @deprecated Use getCompetitionConfig */
export function getCompetitionTypeConfig(type: string) {
  return getCompetitionConfig({ competition_type: type });
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

export function parseScreenTimeLog(
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

export function formatUnitScore(score: number, unitLabel: string | null, logInputType: LogInputType): string {
  if (logInputType === 'duration' || unitLabel === 'hr') {
    return formatDuration(score);
  }
  const unit = unitLabel || 'pts';
  const formatted = trimZeros(score, 1);
  const n = parseFloat(formatted);
  if (unit === 'km' || unit === 'mi') {
    return `${formatted} ${unit}`;
  }
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

export function formatScore(config: CompetitionConfig | CompetitionPreset, score: unknown): string {
  const resolved =
    typeof config === 'string'
      ? getCompetitionConfig({ competition_type: config })
      : config;
  const safe = toScoreNumber(score);
  return formatLeaderboardScore(resolved, safe, safe > 0);
}

export function getLeaderboardTitle(config: CompetitionConfig): string {
  if (config.scoringMode === 'cumulative_low') return 'Lowest Total';
  return 'Leaderboard';
}

export function getCheckInLabel(config: CompetitionConfig): string {
  if (config.scoringMode === 'daily') return "Log Today's Progress";
  if (config.logInputType === 'duration') return "Log Today's Screen Time";
  return "Log Today's Entry";
}

export function getLogValueLabel(config: CompetitionConfig): string {
  if (config.logInputType === 'duration') return 'Screen time today';
  const unit = config.unitLabel || 'units';
  return `${unit.charAt(0).toUpperCase() + unit.slice(1)} today`;
}

/** Count consecutive logged days ending today (or yesterday if today not logged). */
export function computeStreakFromDates(loggedDates: Set<string>, maxDays = 30): number {
  if (loggedDates.size === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(today);
  let streak = 0;

  for (let i = 0; i < maxDays; i++) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (loggedDates.has(dateStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}
