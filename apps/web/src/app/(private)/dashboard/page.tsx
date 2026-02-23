'use client';

import { useEffect, useMemo, useState } from 'react';

import { StatCard } from '@/components/stat-card';
import { TotalBalanceCard } from '@/components/dashboard/total-balance-card';
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/api';
import { todayDate, todayMonth } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import type { AccountBalanceSnapshot } from '@/lib/types';

type SummaryResponse = {
  month: string;
  mode: string;
  base_currency: string;
  totals: {
    revenue: number;
    expense: number;
    profit_loss: number;
    cash_in: number;
    cash_out: number;
    transfer_volume: number;
    excluded_unconverted_count: number;
  };
};

export default function DashboardPage() {
  const { token, me } = useAuth();
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [pending, setPending] = useState<number>(0);
  const [balances, setBalances] = useState<AccountBalanceSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);

  const month = useMemo(() => todayMonth(), []);
  const asOf = useMemo(() => todayDate(), []);

  useEffect(() => {
    if (!token) return;

    Promise.all([
      apiRequest<SummaryResponse>(`/finance/reports/monthly-summary?month=${month}&mode=base`, { token }),
      apiRequest<Array<unknown>>('/finance/transactions?status=PENDING&source=SLACK', { token }),
      apiRequest<AccountBalanceSnapshot[]>(`/finance/reports/account-balances?as_of=${asOf}`, { token }),
    ])
      .then(([summaryPayload, pendingPayload, accountBalancesPayload]) => {
        setSummary(summaryPayload);
        setPending(pendingPayload.length);
        setBalances(accountBalancesPayload);
        setError(null);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load dashboard');
      });
  }, [token, month, asOf]);

  const currency = me?.workspace.base_currency || 'USD';

  return (
    <section className="page">
      <PageHeader
        badge="MONTHLY SNAPSHOT"
        title={`${month} Summary`}
        subtitle="Track topline performance, cash movement, and review workload in one glance."
      />

      {error ? <p className="error-text">{error}</p> : null}

      <TotalBalanceCard balances={balances} workspaceBaseCurrency={currency} />

      {summary ? (
        <div className="grid-cards">
          <StatCard label="Revenue" valueMinor={summary.totals.revenue} currency={currency} tone="good" />
          <StatCard label="Expenses" valueMinor={summary.totals.expense} currency={currency} tone="bad" />
          <StatCard
            label="Profit / Loss"
            valueMinor={summary.totals.profit_loss}
            currency={currency}
            tone={summary.totals.profit_loss >= 0 ? 'good' : 'bad'}
          />
          <StatCard label="Cash In" valueMinor={summary.totals.cash_in} currency={currency} />
          <StatCard label="Cash Out" valueMinor={summary.totals.cash_out} currency={currency} />
          <StatCard label="Transfer Volume" valueMinor={summary.totals.transfer_volume} currency={currency} />
        </div>
      ) : (
        <div className="card">Loading summary...</div>
      )}

      <div className="card">
        <h3>Review Queue</h3>
        <p>
          Pending Slack transactions: <strong>{pending}</strong>
        </p>
        <p>Excluded unconverted rows: {summary?.totals.excluded_unconverted_count ?? 0}</p>
      </div>
    </section>
  );
}
