import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, vi } from 'vitest';

import { NavShell } from '@/components/nav-shell';
import { ThemeProvider } from '@/components/theme/theme-provider';

const replaceMock = vi.fn();
const logoutMock = vi.fn();
let pathname = '/dashboard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => pathname,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    token: 'demo-token',
    me: {
      workspace: { name: 'Demo Workspace', base_currency: 'USD' },
      membership: { role: 'OWNER' },
    },
    loading: false,
    logout: logoutMock,
  }),
}));

function renderShell() {
  return render(
    <ThemeProvider>
      <NavShell>
        <div>Dashboard Body</div>
      </NavShell>
    </ThemeProvider>
  );
}

describe('NavShell mobile drawer', () => {
  beforeEach(() => {
    pathname = '/dashboard';
    replaceMock.mockReset();
    logoutMock.mockReset();
  });

  it('opens and closes with Escape, keeping focus inside drawer when opened', async () => {
    const user = userEvent.setup();
    renderShell();

    const menuButton = screen.getByRole('button', { name: 'Menu' });
    await user.click(menuButton);

    const sidebar = document.getElementById('dashboard-sidebar');
    expect(sidebar?.classList.contains('open')).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    expect(sidebar?.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(sidebar?.classList.contains('open')).toBe(false);
      expect(document.body.style.overflow).toBe('');
    });
  });

  it('auto-closes drawer when route changes', async () => {
    const user = userEvent.setup();
    const view = renderShell();

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    const sidebar = document.getElementById('dashboard-sidebar');
    expect(sidebar?.classList.contains('open')).toBe(true);

    pathname = '/reports';
    view.rerender(
      <ThemeProvider>
        <NavShell>
          <div>Dashboard Body</div>
        </NavShell>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(sidebar?.classList.contains('open')).toBe(false);
    });
  });
});
