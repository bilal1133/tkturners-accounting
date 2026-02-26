'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { z } from 'zod';

import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/api';
import { formatMinor } from '@/lib/format';
import { validateWithSchema } from '@/lib/validation';
import type { Account, Department, Employee } from '@/lib/types';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';

const PAYROLL_CURRENCIES = ['USD', 'EUR', 'PKR'] as const;

const employeeUpdateSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
  payroll_currency: z.enum(PAYROLL_CURRENCIES),
  settlement_iban: z.string().trim().min(5, 'Employee IBAN is required.').max(64, 'Employee IBAN is too long.'),
  default_payout_account_id: z.number().int().positive('Settlement ledger account is required.'),
  default_funding_account_id: z.number().int().nonnegative(),
  department_id: z.number().int().nonnegative(),
  base_salary_minor: z.number().int().nonnegative('Base salary cannot be negative.'),
  default_allowances_minor: z.number().int().nonnegative('Allowances cannot be negative.'),
  default_non_loan_deductions_minor: z.number().int().nonnegative('Deductions cannot be negative.'),
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters.'),
});

type LoanSummary = {
  id: number;
  status: string;
  currency: string;
  principal_minor: number;
  installment_minor: number;
  outstanding_principal_minor: number;
  outstanding_interest_minor: number;
  disbursement_account_name?: string | null;
  receivable_control_account_name?: string | null;
};

type TimelineEventData = {
  status?: string | null;
  payroll_run_status?: string | null;
  source?: string | null;
  currency?: string;
  net_paid_minor?: number;
  total_paid_minor?: number;
  principal_minor?: number;
  principal_paid_minor?: number;
  interest_paid_minor?: number;
  outstanding_principal_minor?: number | null;
  outstanding_interest_minor?: number | null;
  installment_minor?: number;
  from_account_name?: string | null;
  to_account_name?: string | null;
  from_amount_minor?: number | null;
  to_amount_minor?: number | null;
  from_currency?: string | null;
  to_currency?: string | null;
  payout_fx_rate?: number | null;
  transfer_fee_amount_minor?: number | null;
  transfer_fee_currency?: string | null;
  [key: string]: unknown;
};

type TimelineEvent = {
  date: string;
  type: string;
  label: string;
  data: TimelineEventData;
};

type TimelineResponse = {
  employee: Employee & { active_loan?: LoanSummary | null };
  payroll_entries?: Array<Record<string, unknown>>;
  loans?: Array<Record<string, unknown>>;
  repayments?: Array<Record<string, unknown>>;
  transactions?: Array<Record<string, unknown>>;
  events: TimelineEvent[];
};

function formatMoneyOrDash(amountMinor: number | null | undefined, currencyCode: string | null | undefined) {
  if (typeof amountMinor !== 'number' || !currencyCode) {
    return '-';
  }

  return formatMinor(amountMinor, currencyCode);
}

function pickAutoSettlementAccount(accounts: Account[], payrollCurrency: string): Account | null {
  if (!accounts.length) return null;
  return accounts.find((account) => account.currency === payrollCurrency) || accounts[0];
}

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const employeeId = Number(params.id);
  const { token } = useAuth();

  const [payload, setPayload] = useState<TimelineResponse | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [form, setForm] = useState({
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    payroll_currency: 'USD',
    settlement_iban: '',
    default_payout_account_id: 0,
    default_funding_account_id: 0,
    department_id: 0,
    base_salary_minor: 0,
    default_allowances_minor: 0,
    default_non_loan_deductions_minor: 0,
    notes: '',
  });

  const employee = payload?.employee;
  const activeLoan = (employee?.active_loan as LoanSummary | null | undefined) || null;

  const currency = useMemo(() => employee?.payroll_currency || 'USD', [employee?.payroll_currency]);
  const activeLoanCurrency = activeLoan?.currency || currency;
  const accountOptions = useMemo(
    () => accounts.filter((account) => account.is_active && account.account_kind !== 'LOAN_RECEIVABLE_CONTROL'),
    [accounts]
  );
  const settlementAccountOptions = useMemo(
    () => accountOptions.filter((account) => account.currency === form.payroll_currency),
    [accountOptions, form.payroll_currency]
  );
  const autoSettlementAccount = useMemo(
    () => pickAutoSettlementAccount(settlementAccountOptions, form.payroll_currency),
    [form.payroll_currency, settlementAccountOptions]
  );
  const departmentOptions = useMemo(
    () => departments.filter((department) => department.is_active || department.id === form.department_id),
    [departments, form.department_id]
  );
  const departmentLabel = useMemo(() => {
    const directDepartmentName =
      typeof employee?.department_name === 'string' ? employee.department_name.trim() : '';
    const directDepartmentCode =
      typeof employee?.department_code === 'string' ? employee.department_code.trim() : '';

    if (directDepartmentName) {
      return `${directDepartmentCode ? `${directDepartmentCode} - ` : ''}${directDepartmentName}`;
    }

    if (!employee?.department_id) {
      return 'Unassigned';
    }

    const department = departments.find((item) => item.id === Number(employee.department_id));
    if (department) {
      return `${department.code ? `${department.code} - ` : ''}${department.name}`;
    }

    return `Department #${employee.department_id}`;
  }, [departments, employee?.department_code, employee?.department_id, employee?.department_name]);
  const traceability = useMemo(() => {
    const events = payload?.events || [];
    const payrollEvents = events.filter((event) => event.type === 'PAYROLL');
    const loanEvents = events.filter((event) => event.type === 'LOAN');
    const repaymentEvents = events.filter((event) => event.type === 'LOAN_REPAYMENT');

    const totalSalaryPaidMinor = payrollEvents.reduce((sum, event) => {
      const paidMinor =
        typeof event.data.salary_amount_minor === 'number'
          ? event.data.salary_amount_minor
          : typeof event.data.net_paid_minor === 'number'
            ? event.data.net_paid_minor
            : 0;
      return sum + paidMinor;
    }, 0);

    const totalLoanDisbursedMinor = loanEvents.reduce((sum, event) => {
      return sum + (typeof event.data.principal_minor === 'number' ? event.data.principal_minor : 0);
    }, 0);

    const totalLoanRepaidMinor = repaymentEvents.reduce((sum, event) => {
      return sum + (typeof event.data.total_paid_minor === 'number' ? event.data.total_paid_minor : 0);
    }, 0);

    const latestPayrollEvent =
      payrollEvents.sort((left, right) => String(right.date).localeCompare(String(left.date)))[0] || null;
    const latestLoanEvent =
      loanEvents.sort((left, right) => String(right.date).localeCompare(String(left.date)))[0] || null;

    return {
      payroll_events_count: payrollEvents.length,
      loan_events_count: loanEvents.length,
      repayment_events_count: repaymentEvents.length,
      total_salary_paid_minor: totalSalaryPaidMinor,
      total_loan_disbursed_minor: totalLoanDisbursedMinor,
      total_loan_repaid_minor: totalLoanRepaidMinor,
      latest_payroll_event: latestPayrollEvent,
      latest_loan_event: latestLoanEvent,
    };
  }, [payload?.events]);

  const load = async () => {
    if (!token || !employeeId) return;

    const [timelinePayload, accountsPayload, departmentsPayload] = await Promise.all([
      apiRequest<TimelineResponse>(`/finance/employees/${employeeId}/timeline`, {
        token,
      }),
      apiRequest<Account[]>('/finance/accounts', { token }),
      apiRequest<Department[]>('/finance/departments', { token }),
    ]);

    setAccounts(accountsPayload);
    setDepartments(departmentsPayload);
    setPayload(timelinePayload);
    setForm({
      status: timelinePayload.employee.status,
      payroll_currency: timelinePayload.employee.payroll_currency,
      settlement_iban: timelinePayload.employee.settlement_iban || '',
      default_payout_account_id: Number(timelinePayload.employee.default_payout_account_id),
      default_funding_account_id: Number(timelinePayload.employee.default_funding_account_id || 0),
      department_id: Number(timelinePayload.employee.department_id || 0),
      base_salary_minor: timelinePayload.employee.base_salary_minor,
      default_allowances_minor: timelinePayload.employee.default_allowances_minor,
      default_non_loan_deductions_minor: timelinePayload.employee.default_non_loan_deductions_minor,
      notes: timelinePayload.employee.notes || '',
    });
  };

  useEffect(() => {
    load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load employee timeline');
    });
  }, [token, employeeId]);

  useEffect(() => {
    const selectedExists = settlementAccountOptions.some((account) => account.id === form.default_payout_account_id);
    if (selectedExists) {
      return;
    }
    const autoSelected = settlementAccountOptions[0]?.id || 0;
    if (autoSelected === form.default_payout_account_id) {
      return;
    }
    setForm((prev) => ({ ...prev, default_payout_account_id: autoSelected }));
  }, [form.default_payout_account_id, settlementAccountOptions]);

  const closeModal = () => {
    setIsEditModalOpen(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !employeeId) return;

    const parsed = validateWithSchema(employeeUpdateSchema, {
      ...form,
      default_payout_account_id: Number(form.default_payout_account_id),
      default_funding_account_id: Number(form.default_funding_account_id || 0),
      department_id: Number(form.department_id || 0),
      base_salary_minor: Number(form.base_salary_minor || 0),
      default_allowances_minor: Number(form.default_allowances_minor || 0),
      default_non_loan_deductions_minor: Number(form.default_non_loan_deductions_minor || 0),
      settlement_iban: form.settlement_iban || '',
      notes: form.notes || '',
    });

    if (!parsed.success) {
      setError(parsed.message);
      return;
    }

    if (!parsed.data.default_payout_account_id) {
      setError('Select a settlement account before saving.');
      return;
    }

    try {
      setSaving(true);
      await apiRequest(`/finance/employees/${employeeId}`, {
        token,
        method: 'PATCH',
        body: {
          ...parsed.data,
          default_funding_account_id: parsed.data.default_funding_account_id || null,
          department_id: parsed.data.department_id || null,
          notes: parsed.data.notes || null,
        },
      });
      await load();
      closeModal();
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update employee');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page">
      <PageHeader
        badge="EMPLOYEE TIMELINE"
        title={employee ? `${employee.employee_code} - ${employee.full_name}` : 'Employee'}
        actions={
          employee ? (
            <button className="primary-button" type="button" onClick={() => setIsEditModalOpen(true)}>
              Edit Employee
            </button>
          ) : null
        }
      />

      {error ? <p className="error-text">{error}</p> : null}

      {employee ? (
        <div className="card">
          <div className="section-head">
            <div>
              <p className="section-title">Employee Snapshot</p>
              <p className="section-subtitle">Profile, payroll setup, and current loan position.</p>
            </div>
          </div>
          <div className="grid-cards">
            <article className="stat-card">
              <p>Status</p>
              <h3>{employee.status}</h3>
            </article>
            <article className="stat-card">
              <p>Department</p>
              <h3>{departmentLabel}</h3>
            </article>
            <article className="stat-card">
              <p>Payroll Currency</p>
              <h3>{employee.payroll_currency}</h3>
            </article>
            <article className="stat-card">
              <p>Employee IBAN</p>
              <h3>{employee.settlement_iban || '-'}</h3>
            </article>
            <article className="stat-card">
              <p>Settlement Ledger Account</p>
              <h3>{employee.payout_account_name || 'Not set'}</h3>
            </article>
            <article className="stat-card">
              <p>Funding Account</p>
              <h3>{employee.funding_account_name || 'Not set'}</h3>
            </article>
            <article className="stat-card">
              <p>Base Salary</p>
              <h3>{formatMinor(employee.base_salary_minor, currency)}</h3>
            </article>
            <article className="stat-card">
              <p>Default Allowances</p>
              <h3>{formatMinor(employee.default_allowances_minor, currency)}</h3>
            </article>
            <article className="stat-card">
              <p>Default Deductions</p>
              <h3>{formatMinor(employee.default_non_loan_deductions_minor, currency)}</h3>
            </article>
            <article className="stat-card">
              <p>Active Loan Principal</p>
              <h3>
                {activeLoan ? formatMinor(activeLoan.principal_minor, activeLoanCurrency) : 'No active loan'}
              </h3>
              {activeLoan ? (
                <p>
                  Outstanding {formatMinor(activeLoan.outstanding_principal_minor, activeLoanCurrency)} | Installment{' '}
                  {formatMinor(activeLoan.installment_minor, activeLoanCurrency)}
                </p>
              ) : null}
            </article>
            <article className="stat-card">
              <p>Total Salary Paid</p>
              <h3>{formatMinor(traceability.total_salary_paid_minor, currency)}</h3>
              <p>{traceability.payroll_events_count} payroll events</p>
            </article>
            <article className="stat-card">
              <p>Total Loan Disbursed</p>
              <h3>{formatMinor(traceability.total_loan_disbursed_minor, activeLoanCurrency)}</h3>
              <p>{traceability.loan_events_count} loan events</p>
            </article>
            <article className="stat-card">
              <p>Total Loan Repaid</p>
              <h3>{formatMinor(traceability.total_loan_repaid_minor, activeLoanCurrency)}</h3>
              <p>{traceability.repayment_events_count} repayment events</p>
            </article>
            <article className="stat-card">
              <p>Latest Salary Route</p>
              <h3>{traceability.latest_payroll_event?.data.from_account_name || 'Not paid yet'}</h3>
              <p>
                {traceability.latest_payroll_event?.data.to_account_name
                  ? `to ${traceability.latest_payroll_event?.data.to_account_name}`
                  : '-'}
              </p>
            </article>
          </div>
          {employee.notes ? <p className="muted-text">{employee.notes}</p> : null}
        </div>
      ) : null}

      {Array.isArray(payload?.loans) && payload.loans.length > 0 ? (
        <div className="card table-wrap">
          <h3>Loan Portfolio</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Loan</th>
                <th>Status</th>
                <th>Principal</th>
                <th>Outstanding</th>
                <th>Installment</th>
                <th>Disbursement</th>
              </tr>
            </thead>
            <tbody>
              {payload.loans.map((loan, index) => {
                const loanCurrency = typeof loan.currency === 'string' ? loan.currency : currency;
                const outstandingMinor =
                  Number(loan.outstanding_principal_minor || 0) + Number(loan.outstanding_interest_minor || 0);
                return (
                  <tr key={`${loan.id || index}`}>
                    <td>#{Number(loan.id || 0)}</td>
                    <td>{String(loan.status || '-')}</td>
                    <td>{formatMinor(Number(loan.principal_minor || 0), loanCurrency)}</td>
                    <td>{formatMinor(outstandingMinor, loanCurrency)}</td>
                    <td>{formatMinor(Number(loan.installment_minor || 0), loanCurrency)}</td>
                    <td>
                      {String(loan.disbursement_date || '-')}
                      <br />
                      <span className="muted-text">
                        {String(loan.disbursement_account_name || '-')} {'->'}{' '}
                        {String(loan.receivable_control_account_name || '-')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <Modal open={isEditModalOpen} onClose={closeModal} title="Edit Employee" size="lg">
        <form className="page" onSubmit={submit}>
          <div className="form-grid">
            <FormField label="Status">
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, status: event.target.value as 'ACTIVE' | 'INACTIVE' }))
                }
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </FormField>

            <FormField label="Payroll Currency">
              <select
                value={form.payroll_currency}
                onChange={(event) => {
                  const payrollCurrency = event.target.value;
                  const firstMatch = accountOptions.find((account) => account.currency === payrollCurrency) || null;
                  setForm((prev) => ({
                    ...prev,
                    payroll_currency: payrollCurrency,
                    default_payout_account_id: firstMatch?.id || 0,
                  }));
                }}
              >
                {PAYROLL_CURRENCIES.map((currencyCode) => (
                  <option key={currencyCode} value={currencyCode}>
                    {currencyCode}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Settlement Ledger Account (Auto)">
              <input
                value={
                  autoSettlementAccount
                    ? `${autoSettlementAccount.name} (${autoSettlementAccount.currency})`
                    : `No active ${form.payroll_currency} cash account found`
                }
                disabled
              />
            </FormField>

            <FormField label="Employee IBAN">
              <input
                value={form.settlement_iban}
                onChange={(event) => setForm((prev) => ({ ...prev, settlement_iban: event.target.value.toUpperCase() }))}
                placeholder="PK36SCBL0000001123456702"
                required
              />
            </FormField>

            <FormField label="Department">
              <select
                value={form.department_id}
                onChange={(event) => setForm((prev) => ({ ...prev, department_id: Number(event.target.value || 0) }))}
              >
                <option value={0}>Unassigned</option>
                {departmentOptions.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.code ? `${department.code} - ` : ''}
                    {department.name}
                    {!department.is_active ? ' (inactive)' : ''}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Funding Account (Default, Optional)">
              <select
                value={form.default_funding_account_id}
                onChange={(event) => setForm((prev) => ({ ...prev, default_funding_account_id: Number(event.target.value || 0) }))}
              >
                <option value={0}>No default</option>
                {accountOptions.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Base Salary (minor)">
              <input
                type="number"
                min={0}
                value={form.base_salary_minor}
                onChange={(event) => setForm((prev) => ({ ...prev, base_salary_minor: Number(event.target.value || 0) }))}
              />
            </FormField>

            <FormField label="Default Allowances (minor)">
              <input
                type="number"
                min={0}
                value={form.default_allowances_minor}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, default_allowances_minor: Number(event.target.value || 0) }))
                }
              />
            </FormField>

            <FormField label="Default Deductions (minor)">
              <input
                type="number"
                min={0}
                value={form.default_non_loan_deductions_minor}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    default_non_loan_deductions_minor: Number(event.target.value || 0),
                  }))
                }
              />
            </FormField>
          </div>

          {settlementAccountOptions.length === 0 ? (
            <p className="error-text">
              No active cash account found for {form.payroll_currency}. Create one in Accounts first.
            </p>
          ) : null}

          <FormField label="Notes">
            <textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
          </FormField>

          <FormActions>
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button className="ghost-button" type="button" onClick={closeModal} disabled={saving}>
              Cancel
            </button>
          </FormActions>
        </form>
      </Modal>

      <div className="card table-wrap">
        <h3>Linked Timeline</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Label</th>
              <th>From Account</th>
              <th>To Account</th>
              <th>Amount</th>
              <th>Loan Details</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {payload?.events?.map((event, index) => {
              const eventCurrency =
                typeof event.data.currency === 'string' && event.data.currency ? event.data.currency : currency;
              const fromCurrency =
                typeof event.data.from_currency === 'string' && event.data.from_currency
                  ? event.data.from_currency
                  : eventCurrency;
              const toCurrency =
                typeof event.data.to_currency === 'string' && event.data.to_currency ? event.data.to_currency : eventCurrency;
              const fromAccount = event.data.from_account_name || '-';
              const toAccount = event.data.to_account_name || '-';
              const amountLabel =
                typeof event.data.net_paid_minor === 'number'
                  ? formatMinor(event.data.net_paid_minor, eventCurrency)
                  : typeof event.data.total_paid_minor === 'number'
                    ? formatMinor(event.data.total_paid_minor, eventCurrency)
                    : typeof event.data.principal_minor === 'number'
                      ? formatMinor(event.data.principal_minor, eventCurrency)
                      : '-';
              const loanDetailParts = [];
              if (typeof event.data.principal_minor === 'number') {
                loanDetailParts.push(`Principal ${formatMinor(event.data.principal_minor, eventCurrency)}`);
              }
              if (typeof event.data.principal_paid_minor === 'number') {
                loanDetailParts.push(`Principal paid ${formatMinor(event.data.principal_paid_minor, eventCurrency)}`);
              }
              if (typeof event.data.interest_paid_minor === 'number') {
                loanDetailParts.push(`Interest paid ${formatMinor(event.data.interest_paid_minor, eventCurrency)}`);
              }
              if (typeof event.data.outstanding_principal_minor === 'number') {
                loanDetailParts.push(
                  `Outstanding ${formatMinor(event.data.outstanding_principal_minor, eventCurrency)}`
                );
              }
              if (typeof event.data.installment_minor === 'number') {
                loanDetailParts.push(`Installment ${formatMinor(event.data.installment_minor, eventCurrency)}`);
              }

              return (
                <tr key={`${event.type}-${event.date}-${index}`}>
                  <td>{event.date}</td>
                  <td>{event.type}</td>
                  <td>{event.label}</td>
                  <td>
                    <div className="cell-stack">
                      <span>{fromAccount}</span>
                      <span className="muted-text">
                        {formatMoneyOrDash(
                          typeof event.data.from_amount_minor === 'number' ? event.data.from_amount_minor : null,
                          fromCurrency
                        )}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="cell-stack">
                      <span>{toAccount}</span>
                      <span className="muted-text">
                        {formatMoneyOrDash(
                          typeof event.data.to_amount_minor === 'number' ? event.data.to_amount_minor : null,
                          toCurrency
                        )}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="cell-stack">
                      <span>{amountLabel}</span>
                      {event.data.payout_fx_rate ? (
                        <span className="muted-text">FX {Number(event.data.payout_fx_rate).toFixed(6)}</span>
                      ) : null}
                      {typeof event.data.transfer_fee_amount_minor === 'number' ? (
                        <span className="muted-text">
                          Fee {formatMoneyOrDash(event.data.transfer_fee_amount_minor, event.data.transfer_fee_currency || fromCurrency)}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td>{loanDetailParts.length ? loanDetailParts.join(' | ') : '-'}</td>
                  <td>{event.data.status || event.data.payroll_run_status || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
