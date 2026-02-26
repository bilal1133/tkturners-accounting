'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import {
  isThemeName,
  THEME_STORAGE_KEY,
  type ThemeName,
} from '@/theme/theme-config';

type ThemeContextShape = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextShape | undefined>(undefined);

function resolveThemeFromDocument(): ThemeName {
  if (typeof document === 'undefined') {
    return 'light';
  }

  const datasetTheme = document.documentElement.dataset.theme;
  if (isThemeName(datasetTheme)) {
    return datasetTheme;
  }

  return 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(resolveThemeFromDocument);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const fallback: ThemeName = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const resolved = isThemeName(stored) ? stored : fallback;
    setThemeState(resolved);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (nextTheme: ThemeName) => {
    setThemeState(nextTheme);
  };

  const toggleTheme = () => {
    setThemeState((current) => (current === 'dark' ? 'light' : 'dark'));
  };

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider.');
  }
  return context;
}
