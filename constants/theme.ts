export const Colors = {
  primary: {
    50: '#FFF8F0',
    100: '#FFEDD5',
    200: '#FED7AA',
    300: '#FDBA74',
    400: '#FB923C',
    500: '#F97316',
    600: '#EA580C',
    700: '#C2410C',
    800: '#9A3412',
    900: '#7C2D12',
  },
  warm: {
    50: '#FFFBF5',
    100: '#FFF5E8',
    200: '#FFE8CC',
    300: '#FFD9A8',
    400: '#FFC77D',
    500: '#FFB347',
  },
  neutral: {
    50: '#FAFAF9',
    100: '#F5F5F4',
    200: '#E7E5E4',
    300: '#D6D3D1',
    400: '#A8A29E',
    500: '#78716C',
    600: '#57534E',
    700: '#44403C',
    800: '#292524',
    900: '#1C1917',
  },
  success: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    400: '#4ADE80',
    500: '#22C55E',
    600: '#16A34A',
  },
  error: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
  },
  blue: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
  },
  teal: {
    50: '#F0FDFA',
    100: '#CCFBF1',
    200: '#99F6E4',
    300: '#5EEAD4',
    400: '#2DD4BF',
    500: '#14B8A6',
    600: '#0D9488',
    700: '#0F766E',
    800: '#115E59',
    900: '#134E4A',
  },
  purple: {
    50: '#FAF5FF',
    100: '#F3E8FF',
    200: '#E9D5FF',
    300: '#D8B4FE',
    400: '#C084FC',
    500: '#A855F7',
    600: '#9333EA',
    700: '#7E22CE',
    800: '#6B21A8',
    900: '#581C87',
  },
  red: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
  },
  background: '#FFFBF5',
  surface: '#FFFFFF',
  text: '#1C1917',
  textSecondary: '#78716C',
  border: '#E7E5E4',
};

export interface ThemeColors {
  background: string;
  surface: string;
  headerBackground: string;
  text: string;
  textSecondary: string;
  border: string;
  muted: string;
  mutedBorder: string;
  progressTrack: string;
}

export const lightTheme: ThemeColors = {
  background: Colors.background,
  surface: Colors.surface,
  headerBackground: Colors.warm[100],
  text: Colors.text,
  textSecondary: Colors.textSecondary,
  border: Colors.border,
  muted: Colors.neutral[100],
  mutedBorder: Colors.neutral[100],
  progressTrack: Colors.neutral[100],
};

export const darkTheme: ThemeColors = {
  background: Colors.neutral[900],
  surface: Colors.neutral[800],
  headerBackground: Colors.neutral[800],
  text: Colors.neutral[50],
  textSecondary: Colors.neutral[400],
  border: Colors.neutral[700],
  muted: Colors.neutral[800],
  mutedBorder: Colors.neutral[700],
  progressTrack: Colors.neutral[600],
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const FontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 28,
  xxxl: 36,
};
