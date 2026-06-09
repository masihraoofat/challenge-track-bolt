import { Colors } from './theme';

export type GoalType = 'streak' | 'amount' | 'time' | 'checkin';

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
