'use client';

import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/api';
import { formatMinor } from '@/lib/format';
import type { FinanceTransaction } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';

export default function ReviewQueuePage() {
  const { token } = useAuth();
  const [pending, setPending] = useState<FinanceTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    const payload = await apiRequest<FinanceTransaction[]>('/finance/transactions?status=PENDING&source=SLACK', {
      token,
    });
    setPending(payload);
  };

  useEffect(() => {
    load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load review queue');
    });
  }, [token]);

  const changeStatus = async (id: number, action: 'approve' | 'reject') => {
    if (!token) return;

    try {
      await apiRequest(`/finance/transactions/${id}/${action}`, {
        token,
        method: 'POST',
        body: {},
      });
      await load();
      setError(null);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Failed to update status');
    }
  };

  return (
    <section className="page">
      <PageHeader badge="SLACK APPROVALS" title="Review Queue" />

      {error ? <p className="error-text">{error}</p> : null}

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Category</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((transaction) => (
              <tr key={transaction.id}>
                <td>{transaction.transaction_date}</td>
                <td>{transaction.type}</td>
                <td>{transaction.description}</td>
                <td>{formatMinor(transaction.amount_minor, transaction.currency)}</td>
                <td>{transaction.category_name || 'Uncategorized'}</td>
                <td className="inline-actions">
                  <button className="primary-button" onClick={() => changeStatus(transaction.id, 'approve')}>
                    Approve
                  </button>
                  <button className="ghost-button" onClick={() => changeStatus(transaction.id, 'reject')}>
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
