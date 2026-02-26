export type ThemeName = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'tkturners_finance_theme';

type ThemeTokens = Record<`--${string}`, string>;

const sharedTokens: ThemeTokens = {
  '--radius-sm': '10px',
  '--radius-md': '14px',
  '--radius-lg': '18px',
  '--space-1': '0.35rem',
  '--space-2': '0.55rem',
  '--space-3': '0.75rem',
  '--space-4': '1rem',
  '--space-5': '1.25rem',
  '--space-6': '1.5rem',
  '--space-7': '2rem',
};

const lightTokens: ThemeTokens = {
  '--color-scheme': 'light',
  '--bg': '#f1efe8',
  '--bg-soft': '#faf7f0',
  '--bg-elevated': '#fffdfa',
  '--surface': '#ffffff',
  '--surface-subtle': '#f9f7f3',
  '--text': '#1f1f1a',
  '--muted': '#6a685f',
  '--line': '#d8d2c4',
  '--line-strong': '#c7bfaf',
  '--accent': '#0f766e',
  '--accent-soft': '#def3f0',
  '--good': '#0f766e',
  '--bad': '#be123c',
  '--warn': '#9a3412',
  '--bg-gradient-top': 'rgba(15, 118, 110, 0.14)',
  '--bg-gradient-bottom': 'rgba(190, 18, 60, 0.08)',
  '--sidebar-bg': 'rgba(255, 255, 255, 0.64)',
  '--input-bg': '#ffffff',
  '--input-disabled-bg': '#f5f4f0',
  '--input-disabled-text': '#8d897d',
  '--overlay': 'rgba(14, 13, 12, 0.5)',
  '--overlay-strong': 'rgba(14, 13, 12, 0.36)',
  '--focus-ring': 'rgba(15, 118, 110, 0.14)',
  '--stat-good-border': '#99f6e4',
  '--stat-good-bg': '#ecfdf5',
  '--stat-bad-border': '#fda4af',
  '--stat-bad-bg': '#fff1f2',
  '--tag-pending-bg': '#fff7ed',
  '--tag-pending-text': '#9a3412',
  '--tag-approved-bg': '#ecfdf5',
  '--tag-approved-text': '#065f46',
  '--tag-rejected-bg': '#fff1f2',
  '--tag-rejected-text': '#9f1239',
  '--status-paid-bg': '#ecfeff',
  '--status-paid-text': '#0f766e',
  '--table-row-hover': '#fffdf8',
  '--row-locked': '#f9f7f3',
  '--progress-track': 'rgba(0, 0, 0, 0.08)',
  '--chart-1': '#0f766e',
  '--chart-2': '#1d4ed8',
  '--chart-3': '#ea580c',
  '--chart-4': '#16a34a',
  '--chart-5': '#be185d',
  '--chart-6': '#b45309',
  '--chart-7': '#475569',
  '--chart-muted': '#e5e7eb',
  '--shadow-sm': '0 8px 20px rgba(18, 18, 18, 0.07)',
  '--shadow-md': '0 16px 40px rgba(18, 18, 18, 0.1)',
};

const darkTokens: ThemeTokens = {
  '--color-scheme': 'dark',
  '--bg': '#0f1518',
  '--bg-soft': '#111a1f',
  '--bg-elevated': '#162329',
  '--surface': '#1a2b32',
  '--surface-subtle': '#18242b',
  '--text': '#e7eeea',
  '--muted': '#a6b4ad',
  '--line': '#2c3f47',
  '--line-strong': '#3b4f58',
  '--accent': '#2dd4bf',
  '--accent-soft': '#123036',
  '--good': '#34d399',
  '--bad': '#fb7185',
  '--warn': '#fbbf24',
  '--bg-gradient-top': 'rgba(45, 212, 191, 0.18)',
  '--bg-gradient-bottom': 'rgba(251, 113, 133, 0.12)',
  '--sidebar-bg': 'rgba(15, 21, 24, 0.88)',
  '--input-bg': '#132026',
  '--input-disabled-bg': '#101a1f',
  '--input-disabled-text': '#697d86',
  '--overlay': 'rgba(4, 7, 10, 0.72)',
  '--overlay-strong': 'rgba(4, 7, 10, 0.58)',
  '--focus-ring': 'rgba(45, 212, 191, 0.24)',
  '--stat-good-border': '#0f766e',
  '--stat-good-bg': '#102a23',
  '--stat-bad-border': '#be123c',
  '--stat-bad-bg': '#31131d',
  '--tag-pending-bg': '#372110',
  '--tag-pending-text': '#fbbf24',
  '--tag-approved-bg': '#0d2f27',
  '--tag-approved-text': '#6ee7b7',
  '--tag-rejected-bg': '#3a1420',
  '--tag-rejected-text': '#fda4af',
  '--status-paid-bg': '#12343a',
  '--status-paid-text': '#5eead4',
  '--table-row-hover': '#203038',
  '--row-locked': '#1a2830',
  '--progress-track': 'rgba(148, 163, 184, 0.35)',
  '--chart-1': '#2dd4bf',
  '--chart-2': '#60a5fa',
  '--chart-3': '#fb923c',
  '--chart-4': '#4ade80',
  '--chart-5': '#f472b6',
  '--chart-6': '#facc15',
  '--chart-7': '#94a3b8',
  '--chart-muted': '#334155',
  '--shadow-sm': '0 8px 20px rgba(0, 0, 0, 0.28)',
  '--shadow-md': '0 16px 40px rgba(0, 0, 0, 0.38)',
};

function serialize(tokens: ThemeTokens) {
  return Object.entries(tokens)
    .map(([token, value]) => `${token}:${value};`)
    .join('');
}

export const themeCssText = `:root{${serialize(sharedTokens)}${serialize(lightTokens)}}:root[data-theme="dark"]{${serialize(darkTokens)}}`;

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
