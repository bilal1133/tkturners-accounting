'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

import { useAuth } from '@/lib/auth';
import { apiDownload, apiRequest } from '@/lib/api';
import { formatMinor, todayDate, todayMonth } from '@/lib/format';
import { validateWithSchema } from '@/lib/validation';
import type { Account, Category, Counterparty, FinanceTransaction } from '@/lib/types';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';

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

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.');

const baseTransactionSchema = z.object({
  date: dateSchema,
  description: z.string().trim().min(1, 'Description is required.').max(500, 'Description is too long.'),
  category_id: z.number().int().positive('Category is required.'),
  counterparty_id: z.number().int().positive().nullable(),
});

const incomeExpenseFormSchema = baseTransactionSchema.extend({
  type: z.enum(['INCOME', 'EXPENSE']),
  account_id: z.number().int().positive('Account is required.'),
  amount_minor: z.number().int().positive('Amount must be greater than 0.'),
});

const transferFormSchema = baseTransactionSchema
  .extend({
    type: z.literal('TRANSFER'),
    from_account_id: z.number().int().positive('From account is required.'),
    to_account_id: z.number().int().positive('To account is required.'),
    from_amount_minor: z.number().int().positive('Source amount must be greater than 0.'),
    to_amount_minor: z.number().int().positive('Destination amount must be greater than 0.'),
    transfer_fee_amount_minor: z.number().int().nonnegative('Transfer fee cannot be negative.'),
  })
  .refine((value) => value.from_account_id !== value.to_account_id, {
    message: 'From and to accounts must be different.',
    path: ['to_account_id'],
  });

const editTransactionSchema = z.object({
  date: dateSchema,
  description: z.string().trim().min(1, 'Description is required.').max(500, 'Description is too long.'),
  category_id: z.number().int().positive('Category is required.'),
  counterparty_id: z.number().int().positive().nullable(),
  fx_rate_to_base: z
    .string()
    .trim()
    .refine((value) => !value || (Number.isFinite(Number(value)) && Number(value) > 0), {
      message: 'FX rate must be a positive number when provided.',
    }),
});

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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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

  const openCreateModal = () => {
    setForm((prev) => ({ ...initialForm, date: prev.date || todayDate(), account_id: prev.account_id, category_id: prev.category_id, from_account_id: prev.from_account_id, to_account_id: prev.to_account_id }));
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    const normalized = {
      ...form,
      description: form.description || '',
      category_id: Number(form.category_id),
      counterparty_id: form.counterparty_id ? Number(form.counterparty_id) : null,
      account_id: Number(form.account_id),
      amount_minor: Number(form.amount_minor || 0),
      from_account_id: Number(form.from_account_id),
      to_account_id: Number(form.to_account_id),
      from_amount_minor: Number(form.from_amount_minor || 0),
      to_amount_minor: Number(form.to_amount_minor || 0),
      transfer_fee_amount_minor: Number(form.transfer_fee_amount_minor || 0),
    };

    try {
      if (normalized.type === 'TRANSFER') {
        const parsedTransfer = validateWithSchema(transferFormSchema, normalized);
        if (!parsedTransfer.success) {
          setError(parsedTransfer.message);
          return;
        }
        const transferData = parsedTransfer.data;
        const fromAccount = accounts.find((a) => a.id === Number(transferData.from_account_id));
        const toAccount = accounts.find((a) => a.id === Number(transferData.to_account_id));

        await apiRequest('/finance/transactions', {
          token,
          method: 'POST',
          body: {
            type: 'TRANSFER',
            date: transferData.date,
            description: transferData.description,
            from_account_id: Number(transferData.from_account_id),
            to_account_id: Number(transferData.to_account_id),
            from_amount_minor: Number(transferData.from_amount_minor),
            from_currency: fromAccount?.currency || 'USD',
            to_amount_minor: Number(transferData.to_amount_minor),
            to_currency: toAccount?.currency || 'USD',
            category_id: Number(transferData.category_id),
            counterparty_id: transferData.counterparty_id,
            source: 'WEB',
            ...(Number(transferData.transfer_fee_amount_minor || 0) > 0
              ? {
                  fee_amount_minor: Number(transferData.transfer_fee_amount_minor),
                  fee_currency: fromAccount?.currency || 'USD',
                }
              : {}),
          },
        });
      } else {
        const parsedIncomeExpense = validateWithSchema(incomeExpenseFormSchema, normalized);
        if (!parsedIncomeExpense.success) {
          setError(parsedIncomeExpense.message);
          return;
        }
        const transactionData = parsedIncomeExpense.data;

        await apiRequest('/finance/transactions', {
          token,
          method: 'POST',
          body: {
            type: transactionData.type,
            date: transactionData.date,
            description: transactionData.description,
            amount_minor: Number(transactionData.amount_minor),
            currency: selectedAccount?.currency || form.currency,
            account_id: Number(transactionData.account_id),
            category_id: Number(transactionData.category_id),
            counterparty_id: transactionData.counterparty_id,
            source: 'WEB',
          },
        });
      }

      closeCreateModal();
      setForm((prev) => ({ ...initialForm, date: prev.date, account_id: prev.account_id, category_id: prev.category_id, from_account_id: prev.from_account_id, to_account_id: prev.to_account_id }));
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

    const parsed = validateWithSchema(editTransactionSchema, {
      ...editing,
      category_id: Number(editing.category_id),
      counterparty_id: editing.counterparty_id ? Number(editing.counterparty_id) : null,
      description: editing.description || '',
      fx_rate_to_base: editing.fx_rate_to_base || '',
    });

    if (!parsed.success) {
      setError(parsed.message);
      return;
    }

    try {
      setSavingEdit(true);
      await apiRequest(`/finance/transactions/${editing.id}`, {
        token,
        method: 'PATCH',
        body: {
          date: parsed.data.date,
          description: parsed.data.description,
          category_id: Number(parsed.data.category_id),
          counterparty_id: parsed.data.counterparty_id,
          fx_rate_to_base: parsed.data.fx_rate_to_base.trim() ? Number(parsed.data.fx_rate_to_base) : undefined,
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
      <PageHeader
        badge="LEDGER"
        title="Transactions"
        subtitle="Record income, expense, and transfer flows with audit-ready data."
        actions={
          <>
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                if (!token) return;
                apiDownload(`/finance/exports/transactions.csv?month=${month}`, token).catch((downloadError) => {
                  setError(downloadError instanceof Error ? downloadError.message : 'Download failed');
                });
              }}
            >
              Export CSV
            </button>
            <button className="primary-button" type="button" onClick={openCreateModal}>
              New Transaction
            </button>
          </>
        }
      />

      {error ? <p className="error-text">{error}</p> : null}

      <Modal open={isCreateModalOpen} onClose={closeCreateModal} title="Add Transaction" size="lg">
        <form className="page" onSubmit={submit}>
          <div className="form-grid">
            <FormField label="Date">
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                required
              />
            </FormField>

            <FormField label="Type">
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
            </FormField>

            {form.type === 'TRANSFER' ? (
              <>
                <FormField label="From Account">
                  <select
                    value={form.from_account_id}
                    onChange={(event) => setForm((prev) => ({ ...prev, from_account_id: Number(event.target.value) }))}
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="To Account">
                  <select
                    value={form.to_account_id}
                    onChange={(event) => setForm((prev) => ({ ...prev, to_account_id: Number(event.target.value) }))}
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="From Amount (minor)">
                  <input
                    type="number"
                    min={1}
                    value={form.from_amount_minor}
                    onChange={(event) => setForm((prev) => ({ ...prev, from_amount_minor: Number(event.target.value || 0) }))}
                    required
                  />
                </FormField>

                <FormField label="To Amount (minor)">
                  <input
                    type="number"
                    min={1}
                    value={form.to_amount_minor}
                    onChange={(event) => setForm((prev) => ({ ...prev, to_amount_minor: Number(event.target.value || 0) }))}
                    required
                  />
                </FormField>

                <FormField label="Transfer Fee (minor)">
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
                </FormField>
              </>
            ) : (
              <>
                <FormField label="Account">
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
                </FormField>

                <FormField label="Amount (minor)">
                  <input
                    type="number"
                    min={1}
                    value={form.amount_minor}
                    onChange={(event) => setForm((prev) => ({ ...prev, amount_minor: Number(event.target.value || 0) }))}
                    required
                  />
                </FormField>
              </>
            )}

            <FormField label="Category">
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
            </FormField>

            <FormField label="Counterparty">
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
            </FormField>
          </div>

          <FormField label="Description">
            <textarea
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              required
            />
          </FormField>

          <FormActions>
            <button className="primary-button" type="submit">
              Save Transaction
            </button>
            <button className="ghost-button" type="button" onClick={closeCreateModal}>
              Cancel
            </button>
          </FormActions>
        </form>
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Edit Pending Transaction #${editing.id}` : 'Edit Transaction'}
      >
        {editing ? (
          <form className="page" onSubmit={submitEdit}>
            <div className="form-grid">
              <FormField label="Date">
                <input
                  type="date"
                  value={editing.date}
                  onChange={(event) => setEditing((prev) => (prev ? { ...prev, date: event.target.value } : prev))}
                  required
                />
              </FormField>

              <FormField label="Category">
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
              </FormField>

              <FormField label="Counterparty">
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
              </FormField>

              <FormField label="FX Rate To Base (optional)">
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
              </FormField>
            </div>

            <FormField label="Description">
              <textarea
                value={editing.description}
                onChange={(event) =>
                  setEditing((prev) => (prev ? { ...prev, description: event.target.value } : prev))
                }
                required
              />
            </FormField>

            <FormActions>
              <button className="primary-button" type="submit" disabled={savingEdit}>
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
              <button className="ghost-button" type="button" onClick={() => setEditing(null)} disabled={savingEdit}>
                Cancel
              </button>
            </FormActions>
          </form>
        ) : null}
      </Modal>

      <div className="card">
        <div className="form-grid">
          <FormField label="Month">
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </FormField>

          <FormField label="Status">
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </FormField>
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
                <td>
                  <div className="table-actions">
                    {transaction.status === 'PENDING' ? (
                      <button className="ghost-button" type="button" onClick={() => beginEdit(transaction)}>
                        Edit
                      </button>
                    ) : (
                      <span className="muted-text">Locked</span>
                    )}
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => deleteTransaction(Number(transaction.id))}
                      disabled={busyTransactionId === Number(transaction.id)}
                    >
                      {busyTransactionId === Number(transaction.id) ? 'Deleting...' : 'Delete'}
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
