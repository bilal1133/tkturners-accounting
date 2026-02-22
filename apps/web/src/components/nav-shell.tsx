'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth';

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

export function NavShell({ children }: { children: React.ReactNode }) {
  const { token, me, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !token) {
      router.replace('/login');
    }
  }, [loading, token, router]);

  if (loading || !token || !me) {
    return <div className="loader">Loading finance workspace...</div>;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <p className="badge">TKTURNERS</p>
          <h1>{me.workspace.name}</h1>
          <p className="meta">{me.membership.role}</p>
        </div>
        <nav className="nav">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? 'nav-link active' : 'nav-link'}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          className="ghost-button"
          onClick={() => {
            logout();
            router.replace('/login');
          }}
        >
          Sign Out
        </button>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
