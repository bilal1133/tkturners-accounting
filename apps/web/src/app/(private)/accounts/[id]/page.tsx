'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/api';
import { formatMinor } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';

type AccountDetail = {
  id: number;
  name: string;
  currency: string;
  opening_balance_minor: number;
  current_balance_minor: number;
  ledger: Array<{
    id: number;
    transaction_id: number;
    transaction_date: string;
    transaction_type: string;
    transaction_status: string;
    direction: 'IN' | 'OUT';
    amount_minor: number;
    running_balance_minor: number;
    description: string;
  }>;
};

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const { token } = useAuth();
  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !params.id) return;

    apiRequest<AccountDetail>(`/finance/accounts/${params.id}`, { token })
      .then((payload) => {
        setDetail(payload);
        setError(null);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load account detail');
      });
  }, [token, params.id]);

  if (!detail) {
    return <div className="card">{error || 'Loading account detail...'}</div>;
  }

  return (
    <section className="page">
      <PageHeader badge="ACCOUNT LEDGER" title={detail.name} />

      <div className="grid-cards">
        <div className="stat-card">
          <p>Opening Balance</p>
          <h3>{formatMinor(detail.opening_balance_minor, detail.currency)}</h3>
        </div>
        <div className="stat-card">
          <p>Current Balance</p>
          <h3>{formatMinor(detail.current_balance_minor, detail.currency)}</h3>
        </div>
      </div>

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Description</th>
              <th>Direction</th>
              <th>Amount</th>
              <th>Running</th>
            </tr>
          </thead>
          <tbody>
            {detail.ledger.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.transaction_date}</td>
                <td>{entry.transaction_type}</td>
                <td>{entry.description}</td>
                <td>{entry.direction}</td>
                <td>{formatMinor(entry.amount_minor, detail.currency)}</td>
                <td>{formatMinor(entry.running_balance_minor, detail.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
