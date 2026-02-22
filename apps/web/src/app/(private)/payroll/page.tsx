'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { z } from 'zod';

import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/api';
import { formatMinor, todayDate, todayMonth } from '@/lib/format';
import { validateWithSchema } from '@/lib/validation';
import type { PayrollRun } from '@/lib/types';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';

type CreateRunForm = {
  period_month: string;
  cutoff_date: string;
  payday_date: string;
};

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.');
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format.');

const createRunSchema = z.object({
  period_month: monthSchema,
  cutoff_date: z.string().trim(),
  payday_date: dateSchema,
});

const initialForm: CreateRunForm = {
  period_month: todayMonth(),
  cutoff_date: todayDate(),
  payday_date: todayDate(),
};

export default function PayrollRunsPage() {
  const { token, me } = useAuth();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [form, setForm] = useState<CreateRunForm>(initialForm);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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

  const openCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setForm((prev) => ({ ...prev, cutoff_date: prev.cutoff_date || todayDate() }));
  };

  const createRun = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    const parsed = validateWithSchema(createRunSchema, {
      period_month: form.period_month,
      cutoff_date: form.cutoff_date || '',
      payday_date: form.payday_date,
    });

    if (!parsed.success) {
      setError(parsed.message);
      return;
    }

    try {
      await apiRequest('/finance/payroll-runs', {
        token,
        method: 'POST',
        body: {
          period_month: parsed.data.period_month,
          cutoff_date: parsed.data.cutoff_date || null,
          payday_date: parsed.data.payday_date,
        },
      });
      closeCreateModal();
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
      <PageHeader
        badge="PAYROLL WORKFLOW"
        title="Payroll Runs"
        subtitle="Create, approve, and pay monthly payroll cycles."
        actions={
          <button className="primary-button" type="button" onClick={openCreateModal}>
            New Payroll Run
          </button>
        }
      />

      {error ? <p className="error-text">{error}</p> : null}

      <Modal open={isCreateModalOpen} onClose={closeCreateModal} title="Create Monthly Payroll Run" size="sm">
        <form className="page" onSubmit={createRun}>
          <div className="form-grid">
            <FormField label="Period Month">
              <input
                type="month"
                value={form.period_month}
                onChange={(event) => setForm((prev) => ({ ...prev, period_month: event.target.value }))}
                required
              />
            </FormField>

            <FormField label="Cutoff Date">
              <input
                type="date"
                value={form.cutoff_date}
                onChange={(event) => setForm((prev) => ({ ...prev, cutoff_date: event.target.value }))}
              />
            </FormField>

            <FormField label="Payday Date">
              <input
                type="date"
                value={form.payday_date}
                onChange={(event) => setForm((prev) => ({ ...prev, payday_date: event.target.value }))}
                required
              />
            </FormField>
          </div>

          <FormActions>
            <button className="primary-button" type="submit">
              Create Run
            </button>
            <button className="ghost-button" type="button" onClick={closeCreateModal}>
              Cancel
            </button>
          </FormActions>
        </form>
      </Modal>

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
                <td>
                  <div className="table-actions">
                    <button className="ghost-button" type="button" onClick={() => runAction(run.id, 'generate')}>
                      Generate
                    </button>
                    <button className="ghost-button" type="button" onClick={() => runAction(run.id, 'approve')}>
                      Approve
                    </button>
                    <button className="primary-button" type="button" onClick={() => runAction(run.id, 'pay')}>
                      Pay
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
