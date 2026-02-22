'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/api';
import { formatMinor } from '@/lib/format';
import type { Account } from '@/lib/types';

type FormState = {
  name: string;
  currency: string;
  opening_balance_minor: number;
  notes: string;
};

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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    try {
      if (editingAccountId) {
        await apiRequest(`/finance/accounts/${editingAccountId}`, {
          token,
          method: 'PATCH',
          body: {
            ...form,
            notes: form.notes || null,
          },
        });
      } else {
        await apiRequest('/finance/accounts', {
          token,
          method: 'POST',
          body: {
            ...form,
            notes: form.notes || null,
          },
        });
      }
      setEditingAccountId(null);
      setForm(initialForm);
      await loadAccounts();
      setError(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save account');
    }
  };

  const startEdit = (account: Account) => {
    setEditingAccountId(Number(account.id));
    setForm({
      name: account.name,
      currency: account.currency,
      opening_balance_minor: Number(account.opening_balance_minor || 0),
      notes: account.notes || '',
    });
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
        setEditingAccountId(null);
        setForm(initialForm);
      }
      await loadAccounts();
      setError(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete account');
    } finally {
      setBusyAccountId(null);
    }
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="badge">MANUAL ACCOUNTS</p>
          <h2>Accounts</h2>
        </div>
      </header>

      {error ? <p className="error-text">{error}</p> : null}

      <form className="card" onSubmit={submit}>
        <h3>{editingAccountId ? `Edit Account #${editingAccountId}` : 'Create Account'}</h3>
        <div className="form-grid">
          <label>
            Name
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Bilal - Wise USD"
              required
            />
          </label>
          <label>
            Currency
            <select
              value={form.currency}
              onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))}
            >
              <option>USD</option>
              <option>PKR</option>
              <option>EUR</option>
              <option>GBP</option>
              <option>AED</option>
            </select>
          </label>
          <label>
            Opening Balance (minor)
            <input
              type="number"
              value={form.opening_balance_minor}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, opening_balance_minor: Number(event.target.value || 0) }))
              }
            />
          </label>
        </div>
        <label>
          Notes
          <textarea
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="primary-button" type="submit">
            {editingAccountId ? 'Update Account' : 'Save Account'}
          </button>
          {editingAccountId ? (
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                setEditingAccountId(null);
                setForm(initialForm);
              }}
            >
              Cancel Edit
            </button>
          ) : null}
        </div>
      </form>

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
                <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="ghost-button" type="button" onClick={() => startEdit(account)}>
                    Edit
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => deleteAccount(Number(account.id))}
                    disabled={busyAccountId === Number(account.id)}
                  >
                    {busyAccountId === Number(account.id) ? 'Deleting...' : 'Delete'}
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
