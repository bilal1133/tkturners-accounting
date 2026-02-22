'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { z } from 'zod';

import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/api';
import { formatMinor } from '@/lib/format';
import { validateWithSchema } from '@/lib/validation';
import type { Account, PayrollRun } from '@/lib/types';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';

type EditEntryForm = {
  entry_id: number;
  base_salary_minor: number;
  allowances_minor: number;
  non_loan_deductions_minor: number;
  planned_loan_deduction_minor: number;
};

type EntryPaymentConfig = {
  from_account_id: number;
  to_account_id: number;
  from_amount_minor: string;
  fx_rate: string;
  transfer_fee_amount_minor: string;
  extra_fee_amount_minor: string;
  extra_fee_description: string;
};

const editEntrySchema = z.object({
  entry_id: z.number().int().positive(),
  base_salary_minor: z.number().int().nonnegative('Base salary cannot be negative.'),
  allowances_minor: z.number().int().nonnegative('Allowances cannot be negative.'),
  non_loan_deductions_minor: z.number().int().nonnegative('Deductions cannot be negative.'),
  planned_loan_deduction_minor: z.number().int().nonnegative('Loan deduction cannot be negative.'),
});

export default function PayrollRunDetailPage() {
  const params = useParams<{ id: string }>();
  const payrollRunId = Number(params.id);
  const { token } = useAuth();

  const [run, setRun] = useState<PayrollRun | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editing, setEditing] = useState<EditEntryForm | null>(null);
  const [defaultFromAccountId, setDefaultFromAccountId] = useState(0);
  const [paymentConfig, setPaymentConfig] = useState<Record<number, EntryPaymentConfig>>({});
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cashAccounts = useMemo(
    () => accounts.filter((account) => account.is_active && account.account_kind !== 'LOAN_RECEIVABLE_CONTROL'),
    [accounts]
  );

  const accountById = useMemo(() => {
    return new Map(cashAccounts.map((account) => [account.id, account]));
  }, [cashAccounts]);

  const currency = useMemo(() => run?.entries?.[0]?.currency || 'USD', [run?.entries]);

  const load = async () => {
    if (!token || !payrollRunId) return;

    const [runPayload, accountsPayload] = await Promise.all([
      apiRequest<PayrollRun>(`/finance/payroll-runs/${payrollRunId}`, { token }),
      apiRequest<Account[]>('/finance/accounts', { token }),
    ]);

    const activeCash = accountsPayload.filter(
      (account) => account.is_active && account.account_kind !== 'LOAN_RECEIVABLE_CONTROL'
    );

    setRun(runPayload);
    setAccounts(accountsPayload);

    setDefaultFromAccountId((prev) => {
      if (prev > 0) {
        return prev;
      }

      const fromEntries = runPayload.entries || [];
      const firstDefault = fromEntries.find((entry) => Number(entry.default_funding_account_id || 0) > 0);
      if (firstDefault?.default_funding_account_id) {
        return Number(firstDefault.default_funding_account_id);
      }

      return activeCash[0]?.id || 0;
    });

    setPaymentConfig((prev) => {
      const next: Record<number, EntryPaymentConfig> = { ...prev };
      for (const entry of runPayload.entries || []) {
        const existing = prev[entry.id];
        next[entry.id] = {
          from_account_id:
            existing?.from_account_id
            || Number(entry.payout_from_account_id || entry.default_funding_account_id || 0),
          to_account_id:
            existing?.to_account_id || Number(entry.payout_to_account_id || entry.default_payout_account_id || 0),
          from_amount_minor:
            existing?.from_amount_minor
            || (entry.payout_from_amount_minor ? String(entry.payout_from_amount_minor) : ''),
          fx_rate: existing?.fx_rate || (entry.payout_fx_rate ? String(entry.payout_fx_rate) : ''),
          transfer_fee_amount_minor: existing?.transfer_fee_amount_minor || '',
          extra_fee_amount_minor: existing?.extra_fee_amount_minor || '',
          extra_fee_description: existing?.extra_fee_description || '',
        };
      }

      return next;
    });
  };

  useEffect(() => {
    load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load payroll run');
    });
  }, [token, payrollRunId]);

  const setEntryPayment = (entryId: number, updates: Partial<EntryPaymentConfig>) => {
    setPaymentConfig((prev) => {
      const current =
        prev[entryId]
        || {
          from_account_id: 0,
          to_account_id: 0,
          from_amount_minor: '',
          fx_rate: '',
          transfer_fee_amount_minor: '',
          extra_fee_amount_minor: '',
          extra_fee_description: '',
        };
      return {
        ...prev,
        [entryId]: {
          ...current,
          ...updates,
        },
      };
    });
  };

  const runAction = async (action: 'generate' | 'approve') => {
    if (!token || !payrollRunId) return;

    try {
      await apiRequest(`/finance/payroll-runs/${payrollRunId}/${action}`, {
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

  const payRun = async () => {
    if (!token || !payrollRunId || !run) return;

    const payableEntries = (run.entries || []).filter((entry) => entry.status !== 'PAID');
    if (payableEntries.length === 0) {
      setError('No payable entries found.');
      return;
    }

    const entryPayments = payableEntries.map((entry) => {
      const config = paymentConfig[entry.id] || {
        from_account_id: 0,
        to_account_id: Number(entry.default_payout_account_id || 0),
        from_amount_minor: '',
        fx_rate: '',
        transfer_fee_amount_minor: '',
        extra_fee_amount_minor: '',
        extra_fee_description: '',
      };

      const fromAccountId = Number(config.from_account_id || defaultFromAccountId || 0);
      const toAccountId = Number(config.to_account_id || entry.default_payout_account_id || 0);
      const feeAccount = accountById.get(fromAccountId) || accountById.get(toAccountId);

      const payload: Record<string, unknown> = {
        entry_id: entry.id,
        to_account_id: toAccountId,
        to_amount_minor: Number(entry.net_paid_minor),
        to_currency: entry.currency,
      };

      if (fromAccountId > 0) {
        payload.from_account_id = fromAccountId;
      }

      if (config.from_amount_minor.trim()) {
        payload.from_amount_minor = Number(config.from_amount_minor);
      }

      if (config.fx_rate.trim()) {
        payload.fx_rate = Number(config.fx_rate);
      }

      if (config.transfer_fee_amount_minor.trim() && Number(config.transfer_fee_amount_minor) > 0) {
        payload.transfer_fee_amount_minor = Number(config.transfer_fee_amount_minor);
        if (feeAccount) {
          payload.transfer_fee_currency = feeAccount.currency;
        }
      }

      if (config.extra_fee_amount_minor.trim() && Number(config.extra_fee_amount_minor) > 0) {
        payload.additional_fees = [
          {
            amount_minor: Number(config.extra_fee_amount_minor),
            currency: feeAccount?.currency,
            description:
              config.extra_fee_description.trim()
              || `Additional payroll payout fee (${entry.full_name || entry.employee_code || entry.id})`,
          },
        ];
      }

      return payload;
    });

    try {
      setPaying(true);
      await apiRequest(`/finance/payroll-runs/${payrollRunId}/pay`, {
        token,
        method: 'POST',
        body: {
          default_from_account_id: defaultFromAccountId > 0 ? defaultFromAccountId : undefined,
          entry_payments: entryPayments,
        },
      });
      await load();
      setError(null);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to pay payroll run');
    } finally {
      setPaying(false);
    }
  };

  const submitEntryEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !payrollRunId || !editing) return;

    const parsed = validateWithSchema(editEntrySchema, {
      entry_id: Number(editing.entry_id),
      base_salary_minor: Number(editing.base_salary_minor || 0),
      allowances_minor: Number(editing.allowances_minor || 0),
      non_loan_deductions_minor: Number(editing.non_loan_deductions_minor || 0),
      planned_loan_deduction_minor: Number(editing.planned_loan_deduction_minor || 0),
    });

    if (!parsed.success) {
      setError(parsed.message);
      return;
    }

    try {
      await apiRequest(`/finance/payroll-runs/${payrollRunId}/entries/${editing.entry_id}`, {
        token,
        method: 'PATCH',
        body: {
          base_salary_minor: parsed.data.base_salary_minor,
          allowances_minor: parsed.data.allowances_minor,
          non_loan_deductions_minor: parsed.data.non_loan_deductions_minor,
          planned_loan_deduction_minor: parsed.data.planned_loan_deduction_minor,
        },
      });
      setEditing(null);
      await load();
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update payroll entry');
    }
  };

  return (
    <section className="page">
      <PageHeader
        badge="PAYROLL RUN DETAIL"
        title={run ? `Payroll ${run.period_month}` : 'Payroll'}
        actions={
          <>
            <button className="ghost-button" type="button" onClick={() => runAction('generate')}>
              Generate
            </button>
            <button className="ghost-button" type="button" onClick={() => runAction('approve')}>
              Approve
            </button>
            <button className="primary-button" type="button" onClick={payRun} disabled={paying}>
              {paying ? 'Paying...' : 'Pay Run'}
            </button>
          </>
        }
      />

      {error ? <p className="error-text">{error}</p> : null}

      <div className="card">
        <h3>Run Snapshot</h3>
        <p>Status: {run?.status || '-'}</p>
        <p>Payday: {run?.payday_date || '-'}</p>
        <p>Entries: {run?.entries?.length || 0}</p>
      </div>

      <div className="card">
        <h3>Payout Defaults</h3>
        <div className="form-grid">
          <label>
            Default Funding Account
            <select
              value={defaultFromAccountId}
              onChange={(event) => setDefaultFromAccountId(Number(event.target.value || 0))}
            >
              <option value={0}>No default funding account</option>
              {cashAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.currency})
                </option>
              ))}
            </select>
          </label>
        </div>
        <p>
          For cross-currency payroll: set a funding account, set destination employee account, and provide source amount + FX.
        </p>
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Edit Entry #${editing.entry_id}` : 'Edit Payroll Entry'}
      >
        {editing ? (
          <form className="page" onSubmit={submitEntryEdit}>
            <div className="form-grid">
              <FormField label="Base Salary (minor)">
                <input
                  type="number"
                  min={0}
                  value={editing.base_salary_minor}
                  onChange={(event) =>
                    setEditing((prev) =>
                      prev
                        ? {
                            ...prev,
                            base_salary_minor: Number(event.target.value || 0),
                          }
                        : prev
                    )
                  }
                />
              </FormField>

              <FormField label="Allowances (minor)">
                <input
                  type="number"
                  min={0}
                  value={editing.allowances_minor}
                  onChange={(event) =>
                    setEditing((prev) =>
                      prev
                        ? {
                            ...prev,
                            allowances_minor: Number(event.target.value || 0),
                          }
                        : prev
                    )
                  }
                />
              </FormField>

              <FormField label="Non-loan Deductions (minor)">
                <input
                  type="number"
                  min={0}
                  value={editing.non_loan_deductions_minor}
                  onChange={(event) =>
                    setEditing((prev) =>
                      prev
                        ? {
                            ...prev,
                            non_loan_deductions_minor: Number(event.target.value || 0),
                          }
                        : prev
                    )
                  }
                />
              </FormField>

              <FormField label="Planned Loan Deduction (minor)">
                <input
                  type="number"
                  min={0}
                  value={editing.planned_loan_deduction_minor}
                  onChange={(event) =>
                    setEditing((prev) =>
                      prev
                        ? {
                            ...prev,
                            planned_loan_deduction_minor: Number(event.target.value || 0),
                          }
                        : prev
                    )
                  }
                />
              </FormField>
            </div>

            <FormActions>
              <button className="primary-button" type="submit">
                Save Entry
              </button>
              <button className="ghost-button" type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </FormActions>
          </form>
        ) : null}
      </Modal>

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Department</th>
              <th>Status</th>
              <th>Base</th>
              <th>Allowances</th>
              <th>Deductions</th>
              <th>Loan Planned/Actual</th>
              <th>Net Paid</th>
              <th>To Account</th>
              <th>From Account</th>
              <th>From Amount (minor)</th>
              <th>FX Rate</th>
              <th>Transfer Fee</th>
              <th>Extra Fee</th>
              <th>Linked Tx</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {run?.entries?.map((entry) => {
              const config = paymentConfig[entry.id] || {
                from_account_id: Number(entry.default_funding_account_id || 0),
                to_account_id: Number(entry.default_payout_account_id || 0),
                from_amount_minor: '',
                fx_rate: '',
                transfer_fee_amount_minor: '',
                extra_fee_amount_minor: '',
                extra_fee_description: '',
              };

              const destinationOptions = cashAccounts.filter((account) => account.currency === entry.currency);
              const rowDisabled = run.status === 'PAID' || entry.status === 'PAID';

              return (
                <tr key={entry.id}>
                  <td>{entry.full_name}</td>
                  <td>{entry.department_name || 'Unassigned'}</td>
                  <td>{entry.status}</td>
                  <td>{formatMinor(entry.base_salary_minor, entry.currency)}</td>
                  <td>{formatMinor(entry.allowances_minor, entry.currency)}</td>
                  <td>{formatMinor(entry.non_loan_deductions_minor, entry.currency)}</td>
                  <td>
                    {formatMinor(entry.planned_loan_deduction_minor, entry.currency)} /{' '}
                    {formatMinor(entry.actual_loan_deduction_minor, entry.currency)}
                  </td>
                  <td>{formatMinor(entry.net_paid_minor, entry.currency)}</td>
                  <td>
                    <select
                      value={config.to_account_id}
                      onChange={(event) =>
                        setEntryPayment(entry.id, {
                          to_account_id: Number(event.target.value || 0),
                        })
                      }
                      disabled={rowDisabled}
                    >
                      {destinationOptions.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({account.currency})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={config.from_account_id}
                      onChange={(event) =>
                        setEntryPayment(entry.id, {
                          from_account_id: Number(event.target.value || 0),
                        })
                      }
                      disabled={rowDisabled}
                    >
                      <option value={0}>Use default</option>
                      {cashAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({account.currency})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      value={config.from_amount_minor}
                      onChange={(event) =>
                        setEntryPayment(entry.id, {
                          from_amount_minor: event.target.value,
                        })
                      }
                      placeholder="Optional"
                      disabled={rowDisabled}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step="0.000001"
                      value={config.fx_rate}
                      onChange={(event) =>
                        setEntryPayment(entry.id, {
                          fx_rate: event.target.value,
                        })
                      }
                      placeholder="Optional"
                      disabled={rowDisabled}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      value={config.transfer_fee_amount_minor}
                      onChange={(event) =>
                        setEntryPayment(entry.id, {
                          transfer_fee_amount_minor: event.target.value,
                        })
                      }
                      placeholder="0"
                      disabled={rowDisabled}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      value={config.extra_fee_amount_minor}
                      onChange={(event) =>
                        setEntryPayment(entry.id, {
                          extra_fee_amount_minor: event.target.value,
                        })
                      }
                      placeholder="0"
                      disabled={rowDisabled}
                    />
                    <input
                      value={config.extra_fee_description}
                      onChange={(event) =>
                        setEntryPayment(entry.id, {
                          extra_fee_description: event.target.value,
                        })
                      }
                      placeholder="Optional fee note"
                      disabled={rowDisabled}
                    />
                  </td>
                  <td>
                    {entry.salary_expense_transaction_id ? `Salary #${entry.salary_expense_transaction_id}` : '-'}
                    {entry.payout_transfer_transaction_id
                      ? ` | Transfer #${entry.payout_transfer_transaction_id}`
                      : ''}
                    {entry.payout_transfer_fee_transaction_id
                      ? ` | Xfer Fee #${entry.payout_transfer_fee_transaction_id}`
                      : ''}
                    {entry.loan_principal_repayment_transaction_id
                      ? ` | Principal #${entry.loan_principal_repayment_transaction_id}`
                      : ''}
                    {entry.loan_interest_income_transaction_id
                      ? ` | Interest #${entry.loan_interest_income_transaction_id}`
                      : ''}
                    {entry.payout_additional_fee_count
                      ? ` | +${entry.payout_additional_fee_count} fee tx`
                      : ''}
                  </td>
                  <td>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() =>
                        setEditing({
                          entry_id: entry.id,
                          base_salary_minor: entry.base_salary_minor,
                          allowances_minor: entry.allowances_minor,
                          non_loan_deductions_minor: entry.non_loan_deductions_minor,
                          planned_loan_deduction_minor: entry.planned_loan_deduction_minor,
                        })
                      }
                      disabled={run.status === 'PAID'}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <p>Run currency preview: {currency}</p>
      </div>
    </section>
  );
}
