import React from 'react';
import {
  Activity,
  Apple,
  Bike,
  BookOpen,
  Clock,
  Coffee,
  Dumbbell,
  Flame,
  Heart,
  Leaf,
  Medal,
  Moon,
  Music,
  Smartphone,
  Sparkles,
  Star,
  Sun,
  Target,
  Trophy,
  Zap,
} from 'lucide-react-native';
import type { CompetitionColorSet, CompetitionIcon } from '@/constants/competition';

type IconComponent = React.ComponentType<{ size?: number; color?: string }>;

const ICON_COMPONENTS: Record<CompetitionIcon, IconComponent> = {
  trophy: Trophy,
  book: BookOpen,
  activity: Activity,
  flame: Flame,
  target: Target,
  zap: Zap,
  star: Star,
  heart: Heart,
  clock: Clock,
  dumbbell: Dumbbell,
  apple: Apple,
  coffee: Coffee,
  smartphone: Smartphone,
  sparkles: Sparkles,
  bike: Bike,
  moon: Moon,
  sun: Sun,
  medal: Medal,
  music: Music,
  leaf: Leaf,
};

interface CompetitionIconProps {
  icon: CompetitionIcon;
  size?: number;
  colorSet: CompetitionColorSet;
  shade?: 500 | 600;
}

export function CompetitionIcon({
  icon,
  size = 20,
  colorSet,
  shade = 600,
}: CompetitionIconProps) {
  const Icon = ICON_COMPONENTS[icon] ?? Trophy;
  return <Icon size={size} color={colorSet[shade]} />;
}
