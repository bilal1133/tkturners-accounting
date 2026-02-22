'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/api';
import { formatMinor, todayDate } from '@/lib/format';
import type { Account, Category, Counterparty, Subscription } from '@/lib/types';

type FormState = {
  vendor_counterparty_id: number;
  vendor_name: string;
  amount_major: string;
  currency: string;
  account_id: number;
  category_id: number;
  frequency: 'MONTHLY' | 'ANNUAL' | 'CUSTOM';
  interval_count: number;
  next_run_date: string;
  description: string;
};

function minorToMajorInput(amountMinor: number | null | undefined): string {
  const numeric = Number(amountMinor || 0);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return '';
  }

  const major = numeric / 100;
  return Number.isInteger(major) ? String(major) : major.toFixed(2);
}

function majorInputToMinor(rawValue: string): number {
  const normalized = String(rawValue || '').replace(/,/g, '').trim();
  if (!normalized) {
    return 0;
  }

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.round(numeric * 100);
}

export default function SubscriptionsPage() {
  const { token } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [editingSubscriptionId, setEditingSubscriptionId] = useState<number | null>(null);
  const [busySubscriptionId, setBusySubscriptionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    vendor_counterparty_id: 0,
    vendor_name: '',
    amount_major: '',
    currency: 'USD',
    account_id: 0,
    category_id: 0,
    frequency: 'MONTHLY',
    interval_count: 1,
    next_run_date: todayDate(),
    description: '',
  });

  const vendorCounterparties = useMemo(
    () => counterparties.filter((entry) => entry.kind !== 'EMPLOYEE'),
    [counterparties]
  );

  const vendorByNameMap = useMemo(() => {
    const map = new Map<string, Counterparty>();
    for (const entry of vendorCounterparties) {
      map.set(entry.name.trim().toLowerCase(), entry);
    }
    return map;
  }, [vendorCounterparties]);

  const loadData = async () => {
    if (!token) return;

    const [subscriptionPayload, accountPayload, categoryPayload, counterpartyPayload] = await Promise.all([
      apiRequest<Subscription[]>('/finance/subscriptions', { token }),
      apiRequest<Account[]>('/finance/accounts', { token }),
      apiRequest<Category[]>('/finance/categories', { token }),
      apiRequest<Counterparty[]>('/finance/counterparties', { token }),
    ]);

    const vendorOptions = counterpartyPayload.filter((entry) => entry.kind !== 'EMPLOYEE');

    setSubscriptions(subscriptionPayload);
    setAccounts(accountPayload);
    setCategories(categoryPayload);
    setCounterparties(counterpartyPayload);

    setForm((prev) => ({
      ...prev,
      account_id: prev.account_id || accountPayload[0]?.id || 0,
      category_id:
        prev.category_id ||
        categoryPayload.find((category) => category.name === 'Subscriptions')?.id ||
        categoryPayload[0]?.id ||
        0,
      vendor_counterparty_id: prev.vendor_counterparty_id || vendorOptions[0]?.id || 0,
      vendor_name: prev.vendor_name || vendorOptions[0]?.name || '',
      currency: accountPayload[0]?.currency || 'USD',
    }));
  };

  useEffect(() => {
    loadData().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load subscriptions');
    });
  }, [token]);

  const resolveVendorCounterpartyId = async () => {
    const vendorName = form.vendor_name.trim();
    if (!vendorName) {
      throw new Error('Vendor is required.');
    }

    const exactMatch = vendorByNameMap.get(vendorName.toLowerCase());
    if (exactMatch) {
      return exactMatch.id;
    }

    if (!token) {
      throw new Error('Authentication required.');
    }

    const createdCounterparty = await apiRequest<Counterparty>('/finance/counterparties', {
      token,
      method: 'POST',
      body: {
        name: vendorName,
        kind: 'VENDOR',
      },
    });

    setCounterparties((previous) =>
      [...previous, createdCounterparty].sort((left, right) => left.name.localeCompare(right.name))
    );

    return Number(createdCounterparty.id);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    try {
      const amountMinor = majorInputToMinor(form.amount_major);
      if (amountMinor <= 0) {
        setError('Amount must be greater than 0.');
        return;
      }

      const selectedAccount = accounts.find((account) => Number(account.id) === Number(form.account_id));
      const payload = {
        vendor_counterparty_id: await resolveVendorCounterpartyId(),
        amount_minor: amountMinor,
        currency: selectedAccount?.currency || form.currency,
        account_id: Number(form.account_id),
        category_id: Number(form.category_id),
        frequency: form.frequency,
        interval_count: Number(form.interval_count || 1),
        next_run_date: form.next_run_date,
        description: form.description || null,
      };

      if (editingSubscriptionId) {
        await apiRequest(`/finance/subscriptions/${editingSubscriptionId}`, {
          token,
          method: 'PATCH',
          body: payload,
        });
      } else {
        await apiRequest('/finance/subscriptions', {
          token,
          method: 'POST',
          body: payload,
        });
      }
      setEditingSubscriptionId(null);
      await loadData();
      setForm((prev) => ({
        ...prev,
        amount_major: '',
        description: '',
      }));
      setError(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save subscription');
    }
  };

  const startEdit = (subscription: Subscription) => {
    setEditingSubscriptionId(Number(subscription.id));
    const vendor =
      counterparties.find((entry) => Number(entry.id) === Number(subscription.vendor_counterparty_id)) || null;
    setForm({
      vendor_counterparty_id: Number(subscription.vendor_counterparty_id || 0),
      vendor_name: vendor?.name || subscription.vendor_name || '',
      amount_major: minorToMajorInput(Number(subscription.amount_minor || 0)),
      currency: subscription.currency,
      account_id: Number(subscription.account_id || 0),
      category_id: Number(subscription.category_id || 0),
      frequency: subscription.frequency,
      interval_count: Number(subscription.interval_count || 1),
      next_run_date: subscription.next_run_date,
      description: subscription.description || '',
    });
  };

  const removeSubscription = async (subscriptionId: number) => {
    if (!token) return;
    const confirmed = window.confirm('Delete this subscription?');
    if (!confirmed) return;

    try {
      setBusySubscriptionId(subscriptionId);
      await apiRequest(`/finance/subscriptions/${subscriptionId}`, {
        token,
        method: 'DELETE',
      });
      if (editingSubscriptionId === subscriptionId) {
        setEditingSubscriptionId(null);
      }
      await loadData();
      setError(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete subscription');
    } finally {
      setBusySubscriptionId(null);
    }
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="badge">RECURRING EXPENSES</p>
          <h2>Subscriptions</h2>
        </div>
      </header>

      {error ? <p className="error-text">{error}</p> : null}

      <form className="card" onSubmit={submit}>
        <h3>{editingSubscriptionId ? `Edit Subscription #${editingSubscriptionId}` : 'Add Subscription'}</h3>
        <div className="form-grid">
          <label>
            Vendor
            <input
              list="subscription-vendors"
              placeholder="Type vendor (e.g., ChatGPT, Figma)"
              value={form.vendor_name}
              onChange={(event) => {
                const value = event.target.value;
                const match = vendorByNameMap.get(value.trim().toLowerCase());
                setForm((prev) => ({
                  ...prev,
                  vendor_name: value,
                  vendor_counterparty_id: match ? Number(match.id) : 0,
                }));
              }}
              required
            />
            <datalist id="subscription-vendors">
              {vendorCounterparties.map((entry) => (
                <option key={entry.id} value={entry.name} />
              ))}
            </datalist>
            <small style={{ color: 'var(--muted)' }}>
              Select an existing vendor or type a new one. New names are saved automatically.
            </small>
          </label>
          <label>
            Amount ({accounts.find((entry) => Number(entry.id) === Number(form.account_id))?.currency || form.currency})
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.amount_major}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, amount_major: event.target.value }))
              }
              placeholder="0.00"
              required
            />
          </label>
          <label>
            Account
            <select
              value={form.account_id}
              onChange={(event) => {
                const accountId = Number(event.target.value);
                const selectedAccount = accounts.find((entry) => Number(entry.id) === accountId);
                setForm((prev) => ({
                  ...prev,
                  account_id: accountId,
                  currency: selectedAccount?.currency || prev.currency,
                }));
              }}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
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
            Frequency
            <select
              value={form.frequency}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, frequency: event.target.value as FormState['frequency'] }))
              }
            >
              <option value="MONTHLY">Monthly</option>
              <option value="ANNUAL">Annual</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </label>
          <label>
            Interval Count
            <input
              type="number"
              value={form.interval_count}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, interval_count: Number(event.target.value || 1) }))
              }
            />
          </label>
          <label>
            Next Run Date
            <input
              type="date"
              value={form.next_run_date}
              onChange={(event) => setForm((prev) => ({ ...prev, next_run_date: event.target.value }))}
            />
          </label>
        </div>
        <label>
          Description
          <textarea
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="primary-button" type="submit">
            {editingSubscriptionId ? 'Update Subscription' : 'Save Subscription'}
          </button>
          {editingSubscriptionId ? (
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                setEditingSubscriptionId(null);
                setForm((prev) => ({
                  ...prev,
                  amount_major: '',
                  interval_count: 1,
                  description: '',
                }));
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
              <th>Vendor</th>
              <th>Amount</th>
              <th>Frequency</th>
              <th>Next Run</th>
              <th>Account</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((subscription) => (
              <tr key={subscription.id}>
                <td>{subscription.vendor_name}</td>
                <td>{formatMinor(subscription.amount_minor, subscription.currency)}</td>
                <td>
                  {subscription.frequency} ({subscription.interval_count})
                </td>
                <td>{subscription.next_run_date}</td>
                <td>{subscription.account_name}</td>
                <td>{subscription.is_active ? 'Active' : 'Inactive'}</td>
                <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="ghost-button" type="button" onClick={() => startEdit(subscription)}>
                    Edit
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      if (!token) return;
                      apiRequest(`/finance/subscriptions/${subscription.id}/generate`, {
                        token,
                        method: 'POST',
                      })
                        .then(() => loadData())
                        .catch((generateError) => {
                          setError(
                            generateError instanceof Error
                              ? generateError.message
                              : 'Failed to generate subscription run'
                          );
                        });
                    }}
                  >
                    Generate
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => removeSubscription(Number(subscription.id))}
                    disabled={busySubscriptionId === Number(subscription.id)}
                  >
                    {busySubscriptionId === Number(subscription.id) ? 'Deleting...' : 'Delete'}
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
