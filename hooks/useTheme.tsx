import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { darkTheme, lightTheme, ThemeColors } from '@/constants/theme';

const THEME_STORAGE_KEY = 'app_color_scheme';

interface ThemeContextType {
  isDark: boolean;
  colors: ThemeColors;
  setDarkMode: (enabled: boolean) => void;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  colors: lightTheme,
  setDarkMode: () => {},
  toggleDarkMode: () => {},
});

async function getStoredDarkMode(): Promise<boolean> {
  try {
    const value =
      Platform.OS === 'web'
        ? localStorage.getItem(THEME_STORAGE_KEY)
        : await SecureStore.getItemAsync(THEME_STORAGE_KEY);
    return value === 'dark';
  } catch {
    return false;
  }
}

async function storeDarkMode(isDark: boolean): Promise<void> {
  const value = isDark ? 'dark' : 'light';
  if (Platform.OS === 'web') {
    localStorage.setItem(THEME_STORAGE_KEY, value);
    return;
  }
  await SecureStore.setItemAsync(THEME_STORAGE_KEY, value);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getStoredDarkMode().then((stored) => {
      setIsDark(stored);
      setReady(true);
    });
  }, []);

  const setDarkMode = useCallback((enabled: boolean) => {
    setIsDark(enabled);
    void storeDarkMode(enabled);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      void storeDarkMode(next);
      return next;
    });
  }, []);

  const colors = ready ? (isDark ? darkTheme : lightTheme) : lightTheme;

  const value = useMemo(
    () => ({ isDark: ready ? isDark : false, colors, setDarkMode, toggleDarkMode }),
    [ready, isDark, colors, setDarkMode, toggleDarkMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
