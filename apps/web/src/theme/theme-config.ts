import {
  darkThemeTokens,
  lightThemeTokens,
  sharedThemeTokens,
  type ThemeTokens,
} from '@/theme/theme-tokens';

export type ThemeName = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'tkturners_finance_theme';

function serialize(tokens: ThemeTokens) {
  return Object.entries(tokens)
    .map(([token, value]) => `${token}:${value};`)
    .join('');
}

export const themeCssText = `:root{${serialize(sharedThemeTokens)}${serialize(lightThemeTokens)}}:root[data-theme="dark"]{${serialize(darkThemeTokens)}}`;

export const chartPalette = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
] as const;

export function isThemeName(value: string | null | undefined): value is ThemeName {
  return value === 'light' || value === 'dark';
}

export const themeBootstrapScript = `(() => {
  try {
    const key = '${THEME_STORAGE_KEY}';
    const stored = window.localStorage.getItem(key);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored === 'light' || stored === 'dark' ? stored : prefersDark ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
  } catch (_error) {
    document.documentElement.dataset.theme = 'light';
  }
})();`;
