'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { ThemeToggle } from '@/components/theme/theme-toggle';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/employees', label: 'Employees' },
  { href: '/loans', label: 'Loans' },
  { href: '/payroll', label: 'Payroll' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/subscriptions', label: 'Subscriptions' },
  { href: '/reports', label: 'Reports' },
  { href: '/review', label: 'Review Queue' },
  { href: '/settings', label: 'Settings' },
];

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
}

export function NavShell({ children }: { children: React.ReactNode }) {
  const { token, me, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!loading && !token) {
      router.replace('/login');
    }
  }, [loading, token, router]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 980) {
        setMobileNavOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) {
      return;
    }

    const sidebar = sidebarRef.current;
    if (!sidebar) {
      return;
    }

    const previousActiveElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lastActiveElementRef.current = previousActiveElement;

    const focusable = getFocusableElements(sidebar);
    focusable[0]?.focus();

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileNavOpen(false);
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const currentFocusable = getFocusableElements(sidebar);
      if (!currentFocusable.length) {
        event.preventDefault();
        return;
      }

      const first = currentFocusable[0];
      const last = currentFocusable[currentFocusable.length - 1];
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (event.shiftKey) {
        if (!active || active === first || !sidebar.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (!active || active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      lastActiveElementRef.current?.focus();
    };
  }, [mobileNavOpen]);

  if (loading || !token || !me) {
    return <div className="loader">Loading finance workspace...</div>;
  }

  return (
    <div className="shell">
      <header className="mobile-topbar">
        <button
          className="ghost-button icon-button"
          type="button"
          onClick={() => setMobileNavOpen((current) => !current)}
          aria-expanded={mobileNavOpen}
          aria-controls="dashboard-sidebar"
        >
          {mobileNavOpen ? 'Close' : 'Menu'}
        </button>
        <div className="mobile-topbar-brand">
          <p className="badge">TKTURNERS</p>
          <p className="mobile-topbar-title">{me.workspace.name}</p>
        </div>
        <ThemeToggle compact />
      </header>

      <button
        className={mobileNavOpen ? 'sidebar-overlay open' : 'sidebar-overlay'}
        type="button"
        aria-label="Close navigation"
        onClick={() => setMobileNavOpen(false)}
      />

      <aside
        id="dashboard-sidebar"
        ref={sidebarRef}
        className={mobileNavOpen ? 'sidebar open' : 'sidebar'}
        aria-label="Primary navigation"
      >
        <div className="brand-panel">
          <div className="brand-row">
            <div className="brand">
              <p className="badge">TKTURNERS</p>
              <h1>{me.workspace.name}</h1>
              <p className="meta">{me.membership.role}</p>
            </div>
            <ThemeToggle className="sidebar-theme-toggle" />
          </div>
        </div>
        <nav className="nav">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? 'nav-link active' : 'nav-link'}
              onClick={() => setMobileNavOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button
            className="ghost-button"
            onClick={() => {
              logout();
              router.replace('/login');
            }}
          >
            Sign Out
          </button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
