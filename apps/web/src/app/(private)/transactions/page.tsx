'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { apiDownload, apiRequest } from '@/lib/api';
import { formatMinor, todayDate, todayMonth } from '@/lib/format';
import type { Account, Category, Counterparty, FinanceTransaction } from '@/lib/types';

type TransactionForm = {
  date: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  description: string;
  amount_minor: number;
  currency: string;
  account_id: number;
  from_account_id: number;
  to_account_id: number;
  from_amount_minor: number;
  to_amount_minor: number;
  transfer_fee_amount_minor: number;
  category_id: number;
  counterparty_id: number | null;
};

type EditTransactionForm = {
  id: number;
  date: string;
  description: string;
  category_id: number;
  counterparty_id: number | null;
  fx_rate_to_base: string;
};

const initialForm: TransactionForm = {
  date: todayDate(),
  type: 'INCOME',
  description: '',
  amount_minor: 0,
  currency: 'USD',
  account_id: 0,
  from_account_id: 0,
  to_account_id: 0,
  from_amount_minor: 0,
  to_amount_minor: 0,
  transfer_fee_amount_minor: 0,
  category_id: 0,
  counterparty_id: null,
};

export default function TransactionsPage() {
  const { token } = useAuth();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [form, setForm] = useState<TransactionForm>(initialForm);
  const [editing, setEditing] = useState<EditTransactionForm | null>(null);
  const [month, setMonth] = useState(todayMonth());
  const [status, setStatus] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [busyTransactionId, setBusyTransactionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === Number(form.account_id)),
    [accounts, form.account_id]
  );

  const loadBase = async () => {
    if (!token) return;

    const [accountPayload, categoryPayload, counterpartyPayload] = await Promise.all([
      apiRequest<Account[]>('/finance/accounts', { token }),
      apiRequest<Category[]>('/finance/categories', { token }),
      apiRequest<Counterparty[]>('/finance/counterparties', { token }),
    ]);

    setAccounts(accountPayload);
    setCategories(categoryPayload);
    setCounterparties(counterpartyPayload);

    setForm((prev) => ({
      ...prev,
      account_id: prev.account_id || accountPayload[0]?.id || 0,
      from_account_id: prev.from_account_id || accountPayload[0]?.id || 0,
      to_account_id: prev.to_account_id || accountPayload[1]?.id || accountPayload[0]?.id || 0,
      category_id:
        prev.category_id
        || categoryPayload.find((entry) => entry.name === 'Uncategorized')?.id
        || categoryPayload[0]?.id
        || 0,
      currency: accountPayload[0]?.currency || 'USD',
    }));
  };

  const loadTransactions = async () => {
    if (!token) return;

    const query = new URLSearchParams();
    if (month) query.set('month', month);
    if (status) query.set('status', status);

    const payload = await apiRequest<FinanceTransaction[]>(`/finance/transactions?${query.toString()}`, {
      token,
    });

    setTransactions(payload);
  };

  useEffect(() => {
    Promise.all([loadBase(), loadTransactions()]).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load transactions');
    });
  }, [token]);

  useEffect(() => {
    loadTransactions().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Failed to refresh transactions');
    });
  }, [month, status]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    try {
      if (form.type === 'TRANSFER') {
        const fromAccount = accounts.find((a) => a.id === Number(form.from_account_id));
        const toAccount = accounts.find((a) => a.id === Number(form.to_account_id));
        const transferFeeMinor = Number(form.transfer_fee_amount_minor || 0);

        await apiRequest('/finance/transactions', {
          token,
          method: 'POST',
          body: {
            type: 'TRANSFER',
            date: form.date,
            description: form.description,
            from_account_id: Number(form.from_account_id),
            to_account_id: Number(form.to_account_id),
            from_amount_minor: Number(form.from_amount_minor),
            from_currency: fromAccount?.currency || 'USD',
            to_amount_minor: Number(form.to_amount_minor),
            to_currency: toAccount?.currency || 'USD',
            category_id: Number(form.category_id),
            counterparty_id: form.counterparty_id,
            source: 'WEB',
            ...(transferFeeMinor > 0
              ? {
                  fee_amount_minor: transferFeeMinor,
                  fee_currency: fromAccount?.currency || 'USD',
                }
              : {}),
          },
        });
      } else {
        await apiRequest('/finance/transactions', {
          token,
          method: 'POST',
          body: {
            type: form.type,
            date: form.date,
            description: form.description,
            amount_minor: Number(form.amount_minor),
            currency: selectedAccount?.currency || form.currency,
            account_id: Number(form.account_id),
            category_id: Number(form.category_id),
            counterparty_id: form.counterparty_id,
            source: 'WEB',
          },
        });
      }

      setForm((prev) => ({ ...initialForm, date: prev.date }));
      await loadTransactions();
      setError(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create transaction');
    }
  };

  const beginEdit = (transaction: FinanceTransaction) => {
    setEditing({
      id: Number(transaction.id),
      date: transaction.transaction_date,
      description: transaction.description,
      category_id: Number(
        transaction.category_id
        || categories.find((entry) => entry.name === transaction.category_name)?.id
        || categories.find((entry) => entry.name === 'Uncategorized')?.id
        || categories[0]?.id
        || 0
      ),
      counterparty_id: transaction.counterparty_id ? Number(transaction.counterparty_id) : null,
      fx_rate_to_base:
        transaction.fx_rate_to_base !== null && transaction.fx_rate_to_base !== undefined
          ? String(transaction.fx_rate_to_base)
          : '',
    });
  };

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !editing) return;

    try {
      setSavingEdit(true);
      await apiRequest(`/finance/transactions/${editing.id}`, {
        token,
        method: 'PATCH',
        body: {
          date: editing.date,
          description: editing.description,
          category_id: Number(editing.category_id),
          counterparty_id: editing.counterparty_id,
          fx_rate_to_base: editing.fx_rate_to_base.trim() ? Number(editing.fx_rate_to_base) : undefined,
        },
      });
      setEditing(null);
      await loadTransactions();
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update transaction');
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteTransaction = async (transactionId: number) => {
    if (!token) return;
    const confirmed = window.confirm('Delete this transaction? This action cannot be undone.');
    if (!confirmed) return;

    try {
      setBusyTransactionId(transactionId);
      await apiRequest(`/finance/transactions/${transactionId}`, {
        token,
        method: 'DELETE',
      });
      await loadTransactions();
      setError(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete transaction');
    } finally {
      setBusyTransactionId(null);
    }
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="badge">LEDGER</p>
          <h2>Transactions</h2>
        </div>
        <button
          className="ghost-button"
          onClick={() => {
            if (!token) return;
            apiDownload(`/finance/exports/transactions.csv?month=${month}`, token).catch((downloadError) => {
              setError(downloadError instanceof Error ? downloadError.message : 'Download failed');
            });
          }}
        >
          Export CSV
        </button>
      </header>

      {error ? <p className="error-text">{error}</p> : null}

      <form className="card" onSubmit={submit}>
        <h3>Add Transaction</h3>
        <div className="form-grid">
          <label>
            Date
            <input
              type="date"
              value={form.date}
              onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
              required
            />
          </label>
          <label>
            Type
            <select
              value={form.type}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, type: event.target.value as TransactionForm['type'] }))
              }
            >
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
              <option value="TRANSFER">Transfer</option>
            </select>
          </label>
          {form.type === 'TRANSFER' ? (
            <>
              <label>
                From Account
                <select
                  value={form.from_account_id}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, from_account_id: Number(event.target.value) }))
                  }
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                To Account
                <select
                  value={form.to_account_id}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, to_account_id: Number(event.target.value) }))
                  }
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                From Amount (minor)
                <input
                  type="number"
                  value={form.from_amount_minor}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, from_amount_minor: Number(event.target.value || 0) }))
                  }
                  required
                />
              </label>
              <label>
                To Amount (minor)
                <input
                  type="number"
                  value={form.to_amount_minor}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, to_amount_minor: Number(event.target.value || 0) }))
                  }
                  required
                />
              </label>
              <label>
                Transfer Fee (minor)
                <input
                  type="number"
                  min={0}
                  value={form.transfer_fee_amount_minor}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      transfer_fee_amount_minor: Number(event.target.value || 0),
                    }))
                  }
                />
              </label>
            </>
          ) : (
            <>
              <label>
                Account
                <select
                  value={form.account_id}
                  onChange={(event) => setForm((prev) => ({ ...prev, account_id: Number(event.target.value) }))}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Amount (minor)
                <input
                  type="number"
                  value={form.amount_minor}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, amount_minor: Number(event.target.value || 0) }))
                  }
                  required
                />
              </label>
            </>
          )}
          <label>
            Category
            <select
              value={form.category_id}
              onChange={(event) => setForm((prev) => ({ ...prev, category_id: Number(event.target.value) }))}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Counterparty
            <select
              value={form.counterparty_id ?? ''}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  counterparty_id: event.target.value ? Number(event.target.value) : null,
                }))
              }
            >
              <option value="">None</option>
              {counterparties.map((counterparty) => (
                <option key={counterparty.id} value={counterparty.id}>
                  {counterparty.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Description
          <textarea
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            required
          />
        </label>
        <button className="primary-button" type="submit">
          Save Transaction
        </button>
      </form>

      {editing ? (
        <form className="card" onSubmit={submitEdit}>
          <h3>Edit Pending Transaction #{editing.id}</h3>
          <div className="form-grid">
            <label>
              Date
              <input
                type="date"
                value={editing.date}
                onChange={(event) => setEditing((prev) => (prev ? { ...prev, date: event.target.value } : prev))}
                required
              />
            </label>
            <label>
              Category
              <select
                value={editing.category_id}
                onChange={(event) =>
                  setEditing((prev) => (prev ? { ...prev, category_id: Number(event.target.value) } : prev))
                }
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Counterparty
              <select
                value={editing.counterparty_id ?? ''}
                onChange={(event) =>
                  setEditing((prev) =>
                    prev
                      ? {
                          ...prev,
                          counterparty_id: event.target.value ? Number(event.target.value) : null,
                        }
                      : prev
                  )
                }
              >
                <option value="">None</option>
                {counterparties.map((counterparty) => (
                  <option key={counterparty.id} value={counterparty.id}>
                    {counterparty.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              FX Rate To Base (optional)
              <input
                type="number"
                min={0}
                step="0.000001"
                value={editing.fx_rate_to_base}
                onChange={(event) =>
                  setEditing((prev) => (prev ? { ...prev, fx_rate_to_base: event.target.value } : prev))
                }
                placeholder="Leave empty to keep unchanged"
              />
            </label>
          </div>
          <label>
            Description
            <textarea
              value={editing.description}
              onChange={(event) =>
                setEditing((prev) => (prev ? { ...prev, description: event.target.value } : prev))
              }
              required
            />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="primary-button" type="submit" disabled={savingEdit}>
              {savingEdit ? 'Saving...' : 'Save Changes'}
            </button>
            <button className="ghost-button" type="button" onClick={() => setEditing(null)} disabled={savingEdit}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="card">
        <div className="form-grid">
          <label>
            Month
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </label>
        </div>
      </div>

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Status</th>
              <th>Description</th>
              <th>Category</th>
              <th>Counterparty</th>
              <th>Account</th>
              <th>Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td>{transaction.transaction_date}</td>
                <td>{transaction.type}</td>
                <td>
                  <span className={`tag ${transaction.status.toLowerCase()}`}>{transaction.status}</span>
                </td>
                <td>{transaction.description}</td>
                <td>{transaction.category_name || 'Uncategorized'}</td>
                <td>{transaction.counterparty_name || '-'}</td>
                <td>
                  {transaction.type === 'TRANSFER'
                    ? `${transaction.from_account_name} -> ${transaction.to_account_name}`
                    : transaction.type === 'INCOME'
                      ? transaction.to_account_name
                      : transaction.from_account_name}
                </td>
                <td>{formatMinor(transaction.amount_minor, transaction.currency)}</td>
                <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {transaction.status === 'PENDING' ? (
                    <button className="ghost-button" type="button" onClick={() => beginEdit(transaction)}>
                      Edit
                    </button>
                  ) : (
                    <span>Locked</span>
                  )}
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => deleteTransaction(Number(transaction.id))}
                    disabled={busyTransactionId === Number(transaction.id)}
                  >
                    {busyTransactionId === Number(transaction.id) ? 'Deleting...' : 'Delete'}
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
