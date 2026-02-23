'use client';

import { useTheme } from '@/components/theme/theme-provider';

type ThemeToggleProps = {
  compact?: boolean;
  className?: string;
};

export function ThemeToggle({ compact = false, className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      className={`ghost-button theme-toggle${compact ? ' compact' : ''}${className ? ` ${className}` : ''}`}
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} theme`}
      data-theme={theme}
    >
      <span className="theme-toggle-label">Theme</span>
      <span className="theme-toggle-value">{theme === 'dark' ? 'Dark' : 'Light'}</span>
    </button>
  );
}
