'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { z } from 'zod';

import { useAuth } from '@/lib/auth';
import { apiDownload, apiRequest, buildIdempotencyKey } from '@/lib/api';
import { formatMinor } from '@/lib/format';
import { validateWithSchema } from '@/lib/validation';
import type { Account, PayrollRun } from '@/lib/types';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import styles from './page.module.css';

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

type LoanDeductionControl = {
  include: boolean;
  amount_minor: string;
};

const editEntrySchema = z.object({
  entry_id: z.number().int().positive(),
  base_salary_minor: z.number().int().nonnegative('Base salary cannot be negative.'),
  allowances_minor: z.number().int().nonnegative('Allowances cannot be negative.'),
  non_loan_deductions_minor: z.number().int().nonnegative('Deductions cannot be negative.'),
  planned_loan_deduction_minor: z.number().int().nonnegative('Loan deduction cannot be negative.'),
});

function getStatusClassName(status: 'DRAFT' | 'APPROVED' | 'PAID') {
  if (status === 'PAID') return styles.statusPaid;
  if (status === 'APPROVED') return styles.statusApproved;
  return styles.statusDraft;
}

function toPositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.round(parsed);
  return normalized > 0 ? normalized : null;
}

function toPositiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export default function PayrollRunDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const payrollRunId = Number(params.id);
  const { token } = useAuth();

  const [run, setRun] = useState<PayrollRun | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editing, setEditing] = useState<EditEntryForm | null>(null);
  const [defaultFromAccountId, setDefaultFromAccountId] = useState(0);
  const [paymentConfig, setPaymentConfig] = useState<Record<number, EntryPaymentConfig>>({});
  const [loanDeductionConfig, setLoanDeductionConfig] = useState<Record<number, LoanDeductionControl>>({});
  const [savingLoanEntryId, setSavingLoanEntryId] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cashAccounts = useMemo(
    () => accounts.filter((account) => account.is_active && account.account_kind !== 'LOAN_RECEIVABLE_CONTROL'),
    [accounts]
  );

  const accountById = useMemo(() => {
    return new Map(cashAccounts.map((account) => [account.id, account]));
  }, [cashAccounts]);

  const currency = useMemo(() => run?.entries?.[0]?.currency || 'USD', [run?.entries]);
  const payableCount = useMemo(
    () => (run?.entries || []).filter((entry) => entry.status !== 'PAID').length,
    [run?.entries]
  );
  const payoutConfigValidationError = useMemo(() => {
    const entries = (run?.entries || []).filter((entry) => entry.status !== 'PAID');
    for (const entry of entries) {
      const config = paymentConfig[entry.id] || {
        from_account_id: Number(entry.default_funding_account_id || defaultFromAccountId || 0),
        to_account_id: Number(entry.default_payout_account_id || 0),
        from_amount_minor: '',
        fx_rate: '',
        transfer_fee_amount_minor: '',
        extra_fee_amount_minor: '',
        extra_fee_description: '',
      };

      const fromAccountId = Number(config.from_account_id || defaultFromAccountId || entry.default_funding_account_id || 0);
      const toAccountId = Number(config.to_account_id || entry.default_payout_account_id || 0);
      const payoutToAccount = toAccountId ? accountById.get(toAccountId) : undefined;
      if (!payoutToAccount) {
        return `Payroll entry #${entry.id} is missing a destination account.`;
      }

      const payoutFromAccount = fromAccountId ? accountById.get(fromAccountId) : undefined;
      const shouldTransfer = Boolean(
        payoutFromAccount
          && payoutToAccount
          && Number(payoutFromAccount.id) !== Number(payoutToAccount.id)
      );

      if (!shouldTransfer) {
        continue;
      }
      if (!payoutFromAccount) {
        continue;
      }

      const isCrossCurrency = payoutFromAccount.currency !== payoutToAccount.currency;
      if (!isCrossCurrency) {
        continue;
      }

      if (!toPositiveInt(config.from_amount_minor) || !toPositiveNumber(config.fx_rate)) {
        return `Payroll entry #${entry.id} is cross-currency and requires source amount + FX rate.`;
      }
    }

    return null;
  }, [accountById, defaultFromAccountId, paymentConfig, run?.entries]);

  const load = async () => {
    if (!token || !payrollRunId) return null;

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

    setLoanDeductionConfig((prev) => {
      const next: Record<number, LoanDeductionControl> = { ...prev };
      for (const entry of runPayload.entries || []) {
        const include = Number(entry.planned_loan_deduction_minor || 0) > 0;
        const amountMinor =
          Number(entry.planned_loan_deduction_minor || 0) > 0
            ? Number(entry.planned_loan_deduction_minor)
            : Number(entry.auto_loan_deduction_minor || 0);
        next[entry.id] = {
          include,
          amount_minor: String(amountMinor),
        };
      }
      return next;
    });

    return runPayload;
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

  const setLoanDeductionInput = (entryId: number, updates: Partial<LoanDeductionControl>) => {
    setLoanDeductionConfig((prev) => {
      const current = prev[entryId] || { include: false, amount_minor: '0' };
      return {
        ...prev,
        [entryId]: {
          ...current,
          ...updates,
        },
      };
    });
  };

  const saveLoanDeduction = async (entry: NonNullable<PayrollRun['entries']>[number], override?: LoanDeductionControl) => {
    if (!token || !payrollRunId) return;

    const current = override || loanDeductionConfig[entry.id] || { include: false, amount_minor: '0' };
    const hasActiveLoan = Boolean(
      entry.loan_id && ['ACTIVE', 'APPROVED'].includes(String(entry.loan_status || ''))
    );
    const autoAmountMinor = Number(entry.auto_loan_deduction_minor || 0);

    let plannedLoanDeductionMinor = 0;
    if (hasActiveLoan && current.include) {
      const rawAmount = current.amount_minor.trim();
      const parsed = rawAmount ? Number(rawAmount) : autoAmountMinor;
      plannedLoanDeductionMinor = Number.isFinite(parsed)
        ? Math.max(0, Math.round(parsed))
        : Math.max(0, autoAmountMinor);
    }

    try {
      setSavingLoanEntryId(entry.id);
      await apiRequest(`/finance/payroll-runs/${payrollRunId}/entries/${entry.id}`, {
        token,
        method: 'PATCH',
        body: {
          planned_loan_deduction_minor: plannedLoanDeductionMinor,
        },
      });
      await load();
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update loan deduction');
    } finally {
      setSavingLoanEntryId(null);
    }
  };

  const downloadPayrollCsv = async () => {
    if (!token || !run?.period_month) return;

    try {
      await apiDownload(`/finance/exports/payroll.csv?month=${encodeURIComponent(run.period_month)}`, token);
      setError(null);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Failed to download payroll CSV');
    }
  };

  const runAction = async (action: 'generate' | 'approve') => {
    if (!token || !payrollRunId) return;

    try {
      await apiRequest(`/finance/payroll-runs/${payrollRunId}/${action}`, {
        token,
        method: 'POST',
        body: {},
        headers: {
          'Idempotency-Key': buildIdempotencyKey(`payroll-${action}-${payrollRunId}`),
        },
      });
      const refreshedRun = await load();
      if (action === 'approve') {
        const markPaid = window.confirm('Payroll approved. Mark as paid now?');
        if (markPaid) {
          await payRun(refreshedRun);
          return;
        }
      }
      setError(null);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `Failed to ${action} payroll run`);
    }
  };

  const payRun = async (runOverride?: PayrollRun | null) => {
    const effectiveRun = runOverride || run;
    if (!token || !payrollRunId || !effectiveRun) return;
    if (effectiveRun.status !== 'APPROVED') {
      setError('Payroll run must be approved before payment.');
      return;
    }

    const payableEntries = (effectiveRun.entries || []).filter((entry) => entry.status !== 'PAID');
    if (payableEntries.length === 0) {
      setError('No payable entries found.');
      return;
    }
    if (payoutConfigValidationError) {
      setError(payoutConfigValidationError);
      return;
    }

    const entryPayments = payableEntries.map((entry) => {
      const entryId = toPositiveInt(entry.id);
      if (!entryId) {
        return null;
      }

      const config = paymentConfig[entry.id] || {
        from_account_id: 0,
        to_account_id: Number(entry.default_payout_account_id || 0),
        from_amount_minor: '',
        fx_rate: '',
        transfer_fee_amount_minor: '',
        extra_fee_amount_minor: '',
        extra_fee_description: '',
      };

      const fromAccountId = toPositiveInt(config.from_account_id || defaultFromAccountId || 0);
      const toAccountId = toPositiveInt(config.to_account_id || entry.default_payout_account_id || 0);
      const feeAccount =
        (fromAccountId ? accountById.get(fromAccountId) : undefined)
        || (toAccountId ? accountById.get(toAccountId) : undefined);

      const payload: Record<string, unknown> = {
        entry_id: entryId,
      };

      if (toAccountId) {
        payload.to_account_id = toAccountId;
      }

      if (fromAccountId) {
        payload.from_account_id = fromAccountId;
        const fromAccount = accountById.get(fromAccountId);
        if (fromAccount) {
          payload.from_currency = fromAccount.currency;
        }
      }

      const fromAmount = toPositiveInt(config.from_amount_minor);
      if (fromAmount) {
        payload.from_amount_minor = fromAmount;
      }

      const fxRate = toPositiveNumber(config.fx_rate);
      if (fxRate) {
        payload.fx_rate = fxRate;
      }

      const netPaidMinor = toPositiveInt(entry.net_paid_minor || 0);
      if (netPaidMinor) {
        payload.to_amount_minor = netPaidMinor;
        payload.to_currency = entry.currency;
      }

      const transferFeeMinor = toPositiveInt(config.transfer_fee_amount_minor);
      if (transferFeeMinor) {
        payload.transfer_fee_amount_minor = transferFeeMinor;
        if (feeAccount) {
          payload.transfer_fee_currency = feeAccount.currency;
        }
      }

      const extraFeeMinor = toPositiveInt(config.extra_fee_amount_minor);
      if (extraFeeMinor) {
        payload.additional_fees = [
          {
            amount_minor: extraFeeMinor,
            currency: feeAccount?.currency,
            description:
              config.extra_fee_description.trim()
              || `Additional payroll payout fee (${entry.full_name || entry.employee_code || entry.id})`,
          },
        ];
      }

      return payload;
    }).filter((row): row is Record<string, unknown> => Boolean(row));

    try {
      setPaying(true);
      await apiRequest(`/finance/payroll-runs/${payrollRunId}/pay`, {
        token,
        method: 'POST',
        headers: {
          'Idempotency-Key': buildIdempotencyKey(`payroll-pay-${payrollRunId}`),
        },
        body: {
          default_from_account_id: defaultFromAccountId > 0 ? defaultFromAccountId : undefined,
          entry_payments: entryPayments.length > 0 ? entryPayments : undefined,
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

  const deleteRun = async () => {
    if (!token || !run || !payrollRunId) return;
    if (run.status === 'PAID') {
      setError('Paid payroll runs cannot be deleted.');
      return;
    }

    const confirmed = window.confirm(
      `Delete payroll run ${run.period_month}? This removes generated entries for this run.`
    );
    if (!confirmed) return;

    try {
      setDeleting(true);
      await apiRequest(`/finance/payroll-runs/${payrollRunId}`, {
        token,
        method: 'DELETE',
      });
      setError(null);
      router.push('/payroll');
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete payroll run');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="page">
      <PageHeader
        badge="PAYROLL RUN DETAIL"
        title={run ? `Payroll ${run.period_month}` : 'Payroll'}
        actions={
          <>
            <button className="ghost-button" type="button" onClick={downloadPayrollCsv} disabled={!run?.period_month}>
              Download Payroll CSV
            </button>
            <button className="ghost-button" type="button" onClick={() => runAction('generate')}>
              Generate
            </button>
            <button className="ghost-button" type="button" onClick={() => runAction('approve')}>
              Approve
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => payRun()}
              disabled={paying || run?.status !== 'APPROVED' || Boolean(payoutConfigValidationError)}
            >
              {paying ? 'Paying...' : 'Pay Run'}
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={deleteRun}
              disabled={deleting || run?.status === 'PAID'}
            >
              {deleting ? 'Deleting...' : 'Delete Run'}
            </button>
          </>
        }
      />

      {error ? <p className="error-text">{error}</p> : null}
      {payoutConfigValidationError ? <p className="error-text">{payoutConfigValidationError}</p> : null}

      <div className={`card ${styles.snapshotCard}`}>
        <div className={styles.snapshotHeader}>
          <h3>Run Snapshot</h3>
          <span className={`${styles.statusChip} ${getStatusClassName(run?.status || 'DRAFT')}`}>
            {run?.status || 'DRAFT'}
          </span>
        </div>
        <div className={styles.snapshotGrid}>
          <div className={styles.snapshotItem}>
            <p className={styles.snapshotLabel}>Payday</p>
            <p className={styles.snapshotValue}>{run?.payday_date || '-'}</p>
          </div>
          <div className={styles.snapshotItem}>
            <p className={styles.snapshotLabel}>Total Entries</p>
            <p className={styles.snapshotValue}>{run?.entries?.length || 0}</p>
          </div>
          <div className={styles.snapshotItem}>
            <p className={styles.snapshotLabel}>Payable Entries</p>
            <p className={styles.snapshotValue}>{payableCount}</p>
          </div>
          <div className={styles.snapshotItem}>
            <p className={styles.snapshotLabel}>Period</p>
            <p className={styles.snapshotValue}>{run?.period_month || '-'}</p>
          </div>
        </div>
      </div>

      <div className={`card ${styles.defaultsCard}`}>
        <h3>Payout Defaults</h3>
        <div className={`form-grid ${styles.defaultsGrid}`}>
          <label>
            Default Funding Account
            <select
              className={styles.defaultAccountSelect}
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
        <p className={styles.defaultsHint}>
          For cross-currency payroll: set a funding account, set destination employee account, and provide source amount + FX.
        </p>
        <p className={styles.defaultsHint}>
          Loan deduction is capped automatically by remaining principal and base salary for each employee.
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

      <div className={`card table-wrap ${styles.payrollTableWrap}`}>
        <table className={`table ${styles.payrollTable}`}>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Department</th>
              <th>Status</th>
              <th>Base</th>
              <th>Allowances</th>
              <th>Deductions</th>
              <th>Loan (Planned/Actual)</th>
              <th>Include Loan</th>
              <th>Loan Deduction (minor)</th>
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
              const configuredFromAccountId = Number(
                config.from_account_id || defaultFromAccountId || entry.default_funding_account_id || 0
              );
              const configuredToAccountId = Number(config.to_account_id || entry.default_payout_account_id || 0);
              const configuredFromAccount = configuredFromAccountId
                ? accountById.get(configuredFromAccountId)
                : undefined;
              const configuredToAccount = configuredToAccountId ? accountById.get(configuredToAccountId) : undefined;
              const payoutToMinor = Number(entry.net_paid_minor || 0);
              const transferFeeMinor = Number(config.transfer_fee_amount_minor || 0);
              const userProvidedFromMinor = Number(config.from_amount_minor || 0);
              const isTransfer =
                Boolean(configuredFromAccount && configuredToAccount)
                && Number(configuredFromAccount?.id) !== Number(configuredToAccount?.id);
              const isCrossCurrencyTransfer = Boolean(
                isTransfer
                  && configuredFromAccount
                  && configuredToAccount
                  && configuredFromAccount.currency !== configuredToAccount.currency
              );
              const previewSourceMinor = isTransfer
                ? isCrossCurrencyTransfer
                  ? userProvidedFromMinor
                  : userProvidedFromMinor > 0
                    ? userProvidedFromMinor
                    : payoutToMinor
                : 0;
              const previewTotalDebitMinor = previewSourceMinor + transferFeeMinor;
              const missingCrossCurrencyInputs =
                Boolean(isCrossCurrencyTransfer)
                && (!toPositiveInt(config.from_amount_minor) || !toPositiveNumber(config.fx_rate));
              const previewLabel = isTransfer
                ? `OUT ${formatMinor(previewTotalDebitMinor, configuredFromAccount?.currency || entry.currency)} from ${
                    configuredFromAccount?.name || 'source account'
                  } | IN ${formatMinor(payoutToMinor, configuredToAccount?.currency || entry.currency)} to ${
                    configuredToAccount?.name || 'destination account'
                  }`
                : `Direct payout expense from ${configuredToAccount?.name || 'destination account'} (${formatMinor(
                    payoutToMinor,
                    configuredToAccount?.currency || entry.currency
                  )})`;
              const hasActiveLoan = Boolean(
                entry.loan_id && ['ACTIVE', 'APPROVED'].includes(String(entry.loan_status || ''))
              );
              const loanControl = loanDeductionConfig[entry.id] || {
                include: Number(entry.planned_loan_deduction_minor || 0) > 0,
                amount_minor: String(
                  Number(entry.planned_loan_deduction_minor || 0) || Number(entry.auto_loan_deduction_minor || 0)
                ),
              };
              const loanControlDisabled =
                rowDisabled || !hasActiveLoan || (savingLoanEntryId !== null && savingLoanEntryId === entry.id);
              const linkedTransactions = [
                entry.salary_expense_transaction_id ? `Salary #${entry.salary_expense_transaction_id}` : null,
                entry.payout_transfer_transaction_id ? `Transfer #${entry.payout_transfer_transaction_id}` : null,
                entry.payout_transfer_fee_transaction_id ? `Xfer Fee #${entry.payout_transfer_fee_transaction_id}` : null,
                entry.loan_principal_repayment_transaction_id
                  ? `Principal #${entry.loan_principal_repayment_transaction_id}`
                  : null,
                entry.loan_interest_income_transaction_id
                  ? `Interest #${entry.loan_interest_income_transaction_id}`
                  : null,
                entry.payout_additional_fee_count ? `+${entry.payout_additional_fee_count} fee tx` : null,
              ].filter(Boolean) as string[];

              return (
                <tr key={entry.id} className={rowDisabled ? styles.rowLocked : undefined}>
                  <td className={styles.employeeCell}>
                    <span className={styles.employeeName}>{entry.full_name || `Employee #${entry.employee_id}`}</span>
                    <span className={styles.employeeMeta}>{entry.employee_code || '-'}</span>
                  </td>
                  <td className={styles.departmentCell}>{entry.department_name || 'Unassigned'}</td>
                  <td>
                    <span className={`${styles.statusChip} ${getStatusClassName(entry.status)}`}>{entry.status}</span>
                  </td>
                  <td className={styles.amountCell}>{formatMinor(entry.base_salary_minor, entry.currency)}</td>
                  <td className={styles.amountCell}>{formatMinor(entry.allowances_minor, entry.currency)}</td>
                  <td className={styles.amountCell}>{formatMinor(entry.non_loan_deductions_minor, entry.currency)}</td>
                  <td className={styles.loanCell}>
                    <span>{formatMinor(entry.planned_loan_deduction_minor, entry.currency)}</span>
                    <span className={styles.loanMeta}>{formatMinor(entry.actual_loan_deduction_minor, entry.currency)}</span>
                  </td>
                  <td className={styles.loanToggleCell}>
                    <label className={styles.loanToggleLabel}>
                      <input
                        type="checkbox"
                        checked={hasActiveLoan ? loanControl.include : false}
                        onChange={(event) => {
                          const include = event.target.checked;
                          const currentAmount = Number(loanControl.amount_minor);
                          const autoAmount = Number(entry.auto_loan_deduction_minor || 0);
                          const nextAmountMinor =
                            include
                              ? Number.isFinite(currentAmount) && currentAmount > 0
                                ? Math.round(currentAmount)
                                : autoAmount
                              : 0;
                          const nextControl: LoanDeductionControl = {
                            include,
                            amount_minor: String(nextAmountMinor),
                          };
                          setLoanDeductionInput(entry.id, nextControl);
                          void saveLoanDeduction(entry, nextControl);
                        }}
                        disabled={loanControlDisabled}
                      />
                      <span>{hasActiveLoan ? 'Include' : 'No active loan'}</span>
                    </label>
                  </td>
                  <td className={styles.loanInputCell}>
                    <input
                      className={styles.compactInput}
                      type="number"
                      min={0}
                      value={loanControl.amount_minor}
                      onChange={(event) =>
                        setLoanDeductionInput(entry.id, {
                          amount_minor: event.target.value,
                        })
                      }
                      onBlur={() => {
                        if (hasActiveLoan && loanControl.include) {
                          void saveLoanDeduction(entry);
                        }
                      }}
                      placeholder={String(Number(entry.auto_loan_deduction_minor || 0))}
                      disabled={loanControlDisabled || !loanControl.include}
                    />
                    {savingLoanEntryId === entry.id ? <span className={styles.loanSaving}>Saving...</span> : null}
                  </td>
                  <td className={styles.amountCell}>{formatMinor(entry.net_paid_minor, entry.currency)}</td>
                  <td>
                    <select
                      className={styles.accountSelect}
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
                      className={styles.accountSelect}
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
                      className={styles.compactInput}
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
                      className={styles.fxInput}
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
                      className={styles.compactInput}
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
                  <td className={styles.extraFeeCell}>
                    <input
                      className={styles.compactInput}
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
                      className={styles.noteInput}
                      value={config.extra_fee_description}
                      onChange={(event) =>
                        setEntryPayment(entry.id, {
                          extra_fee_description: event.target.value,
                        })
                      }
                      placeholder="Optional fee note"
                      disabled={rowDisabled}
                    />
                    <span className={styles.previewText}>{previewLabel}</span>
                    {missingCrossCurrencyInputs ? (
                      <span className={styles.previewError}>Source amount + FX rate required for cross-currency payout.</span>
                    ) : null}
                  </td>
                  <td className={styles.linkedCell}>
                    {linkedTransactions.length > 0 ? (
                      <div className={styles.linkedList}>
                        {linkedTransactions.map((txLabel) => (
                          <span key={txLabel} className={styles.linkedPill}>
                            {txLabel}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="muted-text">-</span>
                    )}
                  </td>
                  <td>
                    <button
                      className={`ghost-button ${styles.editButton}`}
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

      <div className={`card ${styles.infoCard}`}>
        <p className={styles.infoLabel}>Run currency preview</p>
        <p className={styles.infoValue}>{currency}</p>
      </div>
    </section>
  );
}
