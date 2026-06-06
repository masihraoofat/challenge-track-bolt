import { Colors } from './theme';

export type CompetitionType = 'reading' | 'running' | 'screen_time';

export const COMPETITION_TYPES: Record<CompetitionType, {
  label: string;
  description: string;
  unit: string;
  unitLabel: string;
  placeholder: string;
  colorSet: typeof Colors.primary;
  icon: string;
  sortOrder: 'desc' | 'asc';
  scoreMultiplier: number;
}> = {
  reading: {
    label: 'Reading',
    description: 'Log daily reading streaks',
    unit: 'day',
    unitLabel: 'days read',
    placeholder: 'e.g. Read 20 pages a day',
    colorSet: Colors.primary,
    icon: 'BookOpen',
    sortOrder: 'desc',
    scoreMultiplier: 1,
  },
  running: {
    label: 'Running',
    description: 'Log kilometers ran daily',
    unit: 'km',
    unitLabel: 'km ran',
    placeholder: 'e.g. Run 5km a day',
    colorSet: Colors.blue,
    icon: 'Activity',
    sortOrder: 'desc',
    scoreMultiplier: 1,
  },
  screen_time: {
    label: 'Screen Time',
    description: 'Lowest screen time wins',
    unit: 'hr',
    unitLabel: 'hrs screen time',
    placeholder: 'e.g. Under 2 hours screen time',
    colorSet: Colors.teal,
    icon: 'Smartphone',
    sortOrder: 'asc',
    scoreMultiplier: 1,
  },
};

export function getCompetitionTypeConfig(type: string) {
  return COMPETITION_TYPES[(type as CompetitionType) || 'reading'] || COMPETITION_TYPES.reading;
}

function trimZeros(n: number, maxDecimals: number): string {
  if (Number.isInteger(n)) return n.toString();
  return parseFloat(n.toFixed(maxDecimals)).toString();
}

export function formatScore(type: CompetitionType, score: number): string {
  const safe = Number.isFinite(score) ? score : 0;
  if (type === 'reading') {
    const n = Math.round(safe);
    return `${n} ${n === 1 ? 'day' : 'days'}`;
  }
  if (type === 'running') {
    return `${trimZeros(safe, 1)} km`;
  }
  const hrs = trimZeros(safe, 1);
  const isOne = parseFloat(hrs) === 1;
  return `${hrs} hr${isOne ? '' : 's'}`;
}
