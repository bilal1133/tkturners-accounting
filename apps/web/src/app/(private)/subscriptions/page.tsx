'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

import { useAuth } from '@/lib/auth';
import { apiRequest, buildIdempotencyKey } from '@/lib/api';
import { formatMinor, todayDate } from '@/lib/format';
import { validateWithSchema } from '@/lib/validation';
import type { Account, Category, Counterparty, Subscription } from '@/lib/types';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';

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

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.');

const subscriptionFormSchema = z.object({
  vendor_name: z.string().trim().min(1, 'Vendor name is required.').max(120, 'Vendor name is too long.'),
  amount_major: z
    .string()
    .trim()
    .min(1, 'Amount is required.')
    .refine((value) => {
      const parsed = Number(value.replace(/,/g, ''));
      return Number.isFinite(parsed) && parsed > 0;
    }, 'Amount must be greater than 0.'),
  account_id: z.number().int().positive('Account is required.'),
  category_id: z.number().int().positive('Category is required.'),
  frequency: z.enum(['MONTHLY', 'ANNUAL', 'CUSTOM']),
  interval_count: z.number().int().positive('Interval count must be at least 1.'),
  next_run_date: dateSchema,
  description: z.string().max(500, 'Description cannot exceed 500 characters.'),
});

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

const emptyForm: FormState = {
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
};

export default function SubscriptionsPage() {
  const { token } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingSubscriptionId, setEditingSubscriptionId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [busySubscriptionId, setBusySubscriptionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accountOptions = useMemo(
    () => accounts.filter((account) => account.is_active && account.account_kind !== 'LOAN_RECEIVABLE_CONTROL'),
    [accounts]
  );
  const categoryOptions = useMemo(
    () => categories.filter((category) => category.type === 'EXPENSE' || category.type === 'BOTH'),
    [categories]
  );

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

  const resetForm = (accountPayload: Account[] = accountOptions, categoryPayload: Category[] = categoryOptions) => {
    const defaultAccount = accountPayload[0];
    const defaultCategory =
      categoryPayload.find((category) => category.name === 'Subscriptions') || categoryPayload[0] || null;

    setForm({
      ...emptyForm,
      account_id: defaultAccount?.id || 0,
      category_id: defaultCategory?.id || 0,
      currency: defaultAccount?.currency || 'USD',
    });
  };

  const loadData = async () => {
    if (!token) return;

    const [subscriptionPayload, accountPayload, categoryPayload, counterpartyPayload] = await Promise.all([
      apiRequest<Subscription[]>('/finance/subscriptions', { token }),
      apiRequest<Account[]>('/finance/accounts', { token }),
      apiRequest<Category[]>('/finance/categories', { token }),
      apiRequest<Counterparty[]>('/finance/counterparties', { token }),
    ]);

    setSubscriptions(subscriptionPayload);
    setAccounts(accountPayload);
    setCategories(categoryPayload);
    setCounterparties(counterpartyPayload);

    setForm((prev) => {
      if (prev.account_id && prev.category_id) {
        return prev;
      }

      const activeAccounts = accountPayload.filter(
        (account) => account.is_active && account.account_kind !== 'LOAN_RECEIVABLE_CONTROL'
      );
      const expenseCategories = categoryPayload.filter(
        (category) => category.type === 'EXPENSE' || category.type === 'BOTH'
      );
      const defaultAccount = activeAccounts[0];
      const defaultCategory =
        expenseCategories.find((category) => category.name === 'Subscriptions')
        || expenseCategories[0]
        || null;

      return {
        ...prev,
        account_id: prev.account_id || defaultAccount?.id || 0,
        category_id: prev.category_id || defaultCategory?.id || 0,
        currency: defaultAccount?.currency || prev.currency,
      };
    });
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

  const openCreateModal = () => {
    setEditingSubscriptionId(null);
    resetForm(accountOptions, categoryOptions);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSubscriptionId(null);
    resetForm(accountOptions, categoryOptions);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    const parsed = validateWithSchema(subscriptionFormSchema, {
      ...form,
      description: form.description || '',
      vendor_name: form.vendor_name || '',
      amount_major: form.amount_major || '',
      account_id: Number(form.account_id),
      category_id: Number(form.category_id),
      interval_count: Number(form.interval_count || 1),
      next_run_date: form.next_run_date,
    });

    if (!parsed.success) {
      setError(parsed.message);
      return;
    }

    try {
      const amountMinor = majorInputToMinor(parsed.data.amount_major);
      const selectedAccount = accountOptions.find((account) => Number(account.id) === Number(parsed.data.account_id));
      if (!selectedAccount) {
        setError('Select an active cash account for this subscription.');
        return;
      }
      const payload = {
        vendor_counterparty_id: await resolveVendorCounterpartyId(),
        amount_minor: amountMinor,
        currency: selectedAccount?.currency || form.currency,
        account_id: Number(parsed.data.account_id),
        category_id: Number(parsed.data.category_id),
        frequency: parsed.data.frequency,
        interval_count: Number(parsed.data.interval_count || 1),
        next_run_date: parsed.data.next_run_date,
        description: parsed.data.description || null,
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

      closeModal();
      await loadData();
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
    setIsModalOpen(true);
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
        closeModal();
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
      <PageHeader
        badge="RECURRING EXPENSES"
        title="Subscriptions"
        subtitle="Track recurring expenses and generate due transactions."
        actions={
          <button className="primary-button" type="button" onClick={openCreateModal}>
            New Subscription
          </button>
        }
      />

      {error ? <p className="error-text">{error}</p> : null}

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editingSubscriptionId ? `Edit Subscription #${editingSubscriptionId}` : 'Add Subscription'}
      >
        <form className="page" onSubmit={submit}>
          <div className="form-grid">
            <FormField
              label="Vendor"
              hint="Select an existing vendor or type a new one. New names are saved automatically."
            >
              <>
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
              </>
            </FormField>

            <FormField
              label={`Amount (${accounts.find((entry) => Number(entry.id) === Number(form.account_id))?.currency || form.currency})`}
            >
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.amount_major}
                onChange={(event) => setForm((prev) => ({ ...prev, amount_major: event.target.value }))}
                placeholder="0.00"
                required
              />
            </FormField>

            <FormField label="Account">
              <select
                value={form.account_id}
                onChange={(event) => {
                  const accountId = Number(event.target.value);
                  const selectedAccount = accountOptions.find((entry) => Number(entry.id) === accountId);
                  setForm((prev) => ({
                    ...prev,
                    account_id: accountId,
                    currency: selectedAccount?.currency || prev.currency,
                  }));
                }}
              >
                {accountOptions.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Category">
              <select
                value={form.category_id}
                onChange={(event) => setForm((prev) => ({ ...prev, category_id: Number(event.target.value) }))}
              >
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Frequency">
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
            </FormField>

            <FormField label="Interval Count">
              <input
                type="number"
                min={1}
                value={form.interval_count}
                onChange={(event) => setForm((prev) => ({ ...prev, interval_count: Number(event.target.value || 1) }))}
              />
            </FormField>

            <FormField label="Next Run Date">
              <input
                type="date"
                value={form.next_run_date}
                onChange={(event) => setForm((prev) => ({ ...prev, next_run_date: event.target.value }))}
              />
            </FormField>
          </div>

          <FormField label="Description">
            <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
          </FormField>

          <FormActions>
            <button className="primary-button" type="submit">
              {editingSubscriptionId ? 'Update Subscription' : 'Save Subscription'}
            </button>
            <button className="ghost-button" type="button" onClick={closeModal}>
              Cancel
            </button>
          </FormActions>
        </form>
      </Modal>

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
                <td>
                  <div className="table-actions">
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
                          headers: {
                            'Idempotency-Key': buildIdempotencyKey(`subscription-generate-${subscription.id}`),
                          },
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
