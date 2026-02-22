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
  default_payout_account_id: z.number().int().positive('Settlement account is required.'),
  default_funding_account_id: z.number().int().nonnegative(),
  department_id: z.number().int().nonnegative(),
  base_salary_minor: z.number().int().nonnegative('Base salary cannot be negative.'),
  default_allowances_minor: z.number().int().nonnegative('Allowances cannot be negative.'),
  default_non_loan_deductions_minor: z.number().int().nonnegative('Deductions cannot be negative.'),
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters.'),
});

type TimelineResponse = {
  employee: Employee & { active_loan?: unknown };
  events: Array<{
    date: string;
    type: string;
    label: string;
    data: {
      net_paid_minor?: number;
      principal_minor?: number;
      total_paid_minor?: number;
      status?: string;
      payroll_run_status?: string;
      currency?: string;
      [key: string]: unknown;
    };
  }>;
};

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
    default_payout_account_id: 0,
    default_funding_account_id: 0,
    department_id: 0,
    base_salary_minor: 0,
    default_allowances_minor: 0,
    default_non_loan_deductions_minor: 0,
    notes: '',
  });

  const employee = payload?.employee;

  const currency = useMemo(() => employee?.payroll_currency || 'USD', [employee?.payroll_currency]);
  const accountOptions = useMemo(
    () => accounts.filter((account) => account.is_active && account.account_kind !== 'LOAN_RECEIVABLE_CONTROL'),
    [accounts]
  );
  const settlementAccountOptions = useMemo(
    () => accountOptions.filter((account) => account.currency === form.payroll_currency),
    [accountOptions, form.payroll_currency]
  );
  const departmentOptions = useMemo(
    () => departments.filter((department) => department.is_active || department.id === form.department_id),
    [departments, form.department_id]
  );

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
                  const firstMatch = accountOptions.find((account) => account.currency === payrollCurrency);
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

            <FormField label="Employee Settlement Account">
              <select
                value={form.default_payout_account_id}
                onChange={(event) => {
                  const id = Number(event.target.value);
                  const account = settlementAccountOptions.find((entry) => entry.id === id);
                  setForm((prev) => ({
                    ...prev,
                    default_payout_account_id: id,
                    payroll_currency: account?.currency || prev.payroll_currency,
                  }));
                }}
              >
                <option value={0} disabled>
                  {settlementAccountOptions.length ? 'Select account' : 'No account for selected currency'}
                </option>
                {settlementAccountOptions.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Funding Account (Default)">
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
              <th>Amount/Status</th>
            </tr>
          </thead>
          <tbody>
            {payload?.events?.map((event, index) => {
              const amount =
                typeof event.data.net_paid_minor === 'number'
                  ? formatMinor(event.data.net_paid_minor, currency)
                  : typeof event.data.total_paid_minor === 'number'
                    ? formatMinor(event.data.total_paid_minor, currency)
                    : typeof event.data.principal_minor === 'number'
                      ? formatMinor(event.data.principal_minor, currency)
                      : event.data.status || event.data.payroll_run_status || '-';

              return (
                <tr key={`${event.type}-${event.date}-${index}`}>
                  <td>{event.date}</td>
                  <td>{event.type}</td>
                  <td>{event.label}</td>
                  <td>{amount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
