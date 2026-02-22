'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/api';
import { formatMinor, todayDate, todayMonth } from '@/lib/format';
import type { PayrollRun } from '@/lib/types';

type CreateRunForm = {
  period_month: string;
  cutoff_date: string;
  payday_date: string;
};

const initialForm: CreateRunForm = {
  period_month: todayMonth(),
  cutoff_date: todayDate(),
  payday_date: todayDate(),
};

export default function PayrollRunsPage() {
  const { token, me } = useAuth();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [form, setForm] = useState<CreateRunForm>(initialForm);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    const payload = await apiRequest<PayrollRun[]>('/finance/payroll-runs', { token });
    setRuns(payload);
  };

  useEffect(() => {
    load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load payroll runs');
    });
  }, [token]);

  const createRun = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    try {
      await apiRequest('/finance/payroll-runs', {
        token,
        method: 'POST',
        body: {
          period_month: form.period_month,
          cutoff_date: form.cutoff_date || null,
          payday_date: form.payday_date,
        },
      });
      await load();
      setError(null);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create payroll run');
    }
  };

  const runAction = async (runId: number, action: 'generate' | 'approve' | 'pay') => {
    if (!token) return;

    try {
      await apiRequest(`/finance/payroll-runs/${runId}/${action}`, {
        token,
        method: 'POST',
        body: {},
      });
      await load();
      setError(null);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `Failed to ${action} payroll run`);
    }
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="badge">PAYROLL WORKFLOW</p>
          <h2>Payroll Runs</h2>
        </div>
      </header>

      {error ? <p className="error-text">{error}</p> : null}

      <form className="card" onSubmit={createRun}>
        <h3>Create Monthly Run</h3>
        <div className="form-grid">
          <label>
            Period Month
            <input
              type="month"
              value={form.period_month}
              onChange={(event) => setForm((prev) => ({ ...prev, period_month: event.target.value }))}
              required
            />
          </label>
          <label>
            Cutoff Date
            <input
              type="date"
              value={form.cutoff_date}
              onChange={(event) => setForm((prev) => ({ ...prev, cutoff_date: event.target.value }))}
            />
          </label>
          <label>
            Payday Date
            <input
              type="date"
              value={form.payday_date}
              onChange={(event) => setForm((prev) => ({ ...prev, payday_date: event.target.value }))}
              required
            />
          </label>
        </div>
        <button className="primary-button" type="submit">
          Create Run
        </button>
      </form>

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Status</th>
              <th>Payday</th>
              <th>Entries</th>
              <th>Total Net</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>
                  <Link href={`/payroll/${run.id}`}>{run.period_month}</Link>
                </td>
                <td>{run.status}</td>
                <td>{run.payday_date}</td>
                <td>{run.entries_count || 0}</td>
                <td>{formatMinor(run.total_net_paid_minor || 0, me?.workspace.base_currency || 'USD')}</td>
                <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="ghost-button" onClick={() => runAction(run.id, 'generate')}>
                    Generate
                  </button>
                  <button className="ghost-button" onClick={() => runAction(run.id, 'approve')}>
                    Approve
                  </button>
                  <button className="primary-button" onClick={() => runAction(run.id, 'pay')}>
                    Pay
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
