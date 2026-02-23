import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider } from '@/components/theme/theme-provider';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { THEME_STORAGE_KEY } from '@/theme/theme-config';

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>
  );
}

describe('ThemeProvider', () => {
  it('restores stored theme on mount', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    renderToggle();

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark');
    });

    expect(screen.queryByRole('button', { name: /switch to light theme/i })).not.toBeNull();
  });

  it('toggles theme and persists selection', async () => {
    const user = userEvent.setup();
    renderToggle();

    const button = screen.getByRole('button', { name: /switch to dark theme/i });
    await user.click(button);

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(screen.queryByRole('button', { name: /switch to light theme/i })).not.toBeNull();
  });
});
