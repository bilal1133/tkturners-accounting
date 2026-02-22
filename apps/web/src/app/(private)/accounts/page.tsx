'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { z } from 'zod';

import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/api';
import { formatMinor } from '@/lib/format';
import { validateWithSchema } from '@/lib/validation';
import type { Account } from '@/lib/types';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';

type FormState = {
  name: string;
  currency: string;
  opening_balance_minor: number;
  notes: string;
};

const currencies = ['USD', 'PKR', 'EUR', 'GBP', 'AED'] as const;

const accountFormSchema = z.object({
  name: z.string().trim().min(1, 'Account name is required.').max(120, 'Account name is too long.'),
  currency: z.enum(currencies),
  opening_balance_minor: z.number().int('Opening balance must be a whole number.'),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters.'),
});

const initialForm: FormState = {
  name: '',
  currency: 'USD',
  opening_balance_minor: 0,
  notes: '',
};

export default function AccountsPage() {
  const { token } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [busyAccountId, setBusyAccountId] = useState<number | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = async () => {
    if (!token) return;
    const payload = await apiRequest<Account[]>('/finance/accounts', { token });
    setAccounts(payload);
  };

  useEffect(() => {
    loadAccounts().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load accounts');
    });
  }, [token]);

  const closeAccountModal = () => {
    setIsAccountModalOpen(false);
    setEditingAccountId(null);
    setForm(initialForm);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    const parsed = validateWithSchema(accountFormSchema, {
      ...form,
      notes: form.notes || '',
    });

    if (!parsed.success) {
      setError(parsed.message);
      return;
    }

    try {
      if (editingAccountId) {
        await apiRequest(`/finance/accounts/${editingAccountId}`, {
          token,
          method: 'PATCH',
          body: {
            ...parsed.data,
            notes: parsed.data.notes || null,
          },
        });
      } else {
        await apiRequest('/finance/accounts', {
          token,
          method: 'POST',
          body: {
            ...parsed.data,
            notes: parsed.data.notes || null,
          },
        });
      }
      closeAccountModal();
      await loadAccounts();
      setError(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save account');
    }
  };

  const startCreate = () => {
    setEditingAccountId(null);
    setForm(initialForm);
    setIsAccountModalOpen(true);
  };

  const startEdit = (account: Account) => {
    setEditingAccountId(Number(account.id));
    setForm({
      name: account.name,
      currency: account.currency,
      opening_balance_minor: Number(account.opening_balance_minor || 0),
      notes: account.notes || '',
    });
    setIsAccountModalOpen(true);
  };

  const deleteAccount = async (accountId: number) => {
    if (!token) return;
    const confirmed = window.confirm('Delete this account? If linked to transactions, it will be marked inactive.');
    if (!confirmed) return;

    try {
      setBusyAccountId(accountId);
      await apiRequest(`/finance/accounts/${accountId}`, {
        token,
        method: 'DELETE',
      });
      if (editingAccountId === accountId) {
        closeAccountModal();
      }
      await loadAccounts();
      setError(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete account');
    } finally {
      setBusyAccountId(null);
    }
  };

  const reactivateAccount = async (accountId: number) => {
    if (!token) return;

    try {
      setBusyAccountId(accountId);
      await apiRequest(`/finance/accounts/${accountId}`, {
        token,
        method: 'PATCH',
        body: {
          is_active: true,
        },
      });
      await loadAccounts();
      setError(null);
    } catch (reactivateError) {
      setError(reactivateError instanceof Error ? reactivateError.message : 'Failed to reactivate account');
    } finally {
      setBusyAccountId(null);
    }
  };

  return (
    <section className="page">
      <PageHeader
        badge="MANUAL ACCOUNTS"
        title="Accounts"
        subtitle="Create and maintain internal cash or control accounts."
        actions={
          <button className="primary-button" type="button" onClick={startCreate}>
            New Account
          </button>
        }
      />

      {error ? <p className="error-text">{error}</p> : null}

      <Modal
        open={isAccountModalOpen}
        onClose={closeAccountModal}
        title={editingAccountId ? `Edit Account #${editingAccountId}` : 'Create Account'}
        description="Account create and update flows are handled in this modal."
      >
        <form className="page" onSubmit={submit}>
          <div className="form-grid">
            <FormField label="Name">
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Bilal - Wise USD"
                required
              />
            </FormField>

            <FormField label="Currency">
              <select
                value={form.currency}
                onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))}
              >
                {currencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Opening Balance (minor)">
              <input
                type="number"
                value={form.opening_balance_minor}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, opening_balance_minor: Number(event.target.value || 0) }))
                }
              />
            </FormField>
          </div>

          <FormField label="Notes">
            <textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
          </FormField>

          <FormActions>
            <button className="primary-button" type="submit">
              {editingAccountId ? 'Update Account' : 'Save Account'}
            </button>
            <button className="ghost-button" type="button" onClick={closeAccountModal}>
              Cancel
            </button>
          </FormActions>
        </form>
      </Modal>

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Currency</th>
              <th>Opening</th>
              <th>Current</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>
                  <Link href={`/accounts/${account.id}`}>{account.name}</Link>
                </td>
                <td>{account.currency}</td>
                <td>{formatMinor(account.opening_balance_minor, account.currency)}</td>
                <td>{formatMinor(account.current_balance_minor, account.currency)}</td>
                <td>{account.is_active ? 'Active' : 'Inactive'}</td>
                <td>
                  <div className="table-actions">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => startEdit(account)}
                      disabled={busyAccountId === Number(account.id)}
                    >
                      Edit
                    </button>
                    {account.is_active ? (
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => deleteAccount(Number(account.id))}
                        disabled={busyAccountId === Number(account.id)}
                      >
                        {busyAccountId === Number(account.id) ? 'Deleting...' : 'Delete'}
                      </button>
                    ) : (
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => reactivateAccount(Number(account.id))}
                        disabled={busyAccountId === Number(account.id)}
                      >
                        {busyAccountId === Number(account.id) ? 'Reactivating...' : 'Reactivate'}
                      </button>
                    )}
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
