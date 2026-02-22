'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/api';
import { formatMinor } from '@/lib/format';
import { validateWithSchema } from '@/lib/validation';
import type { Account, Department, Employee } from '@/lib/types';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';

type EmployeeForm = {
  full_name: string;
  email: string;
  payroll_currency: string;
  default_payout_account_id: number;
  default_funding_account_id: number;
  department_id: number;
  base_salary_minor: number;
  default_allowances_minor: number;
  default_non_loan_deductions_minor: number;
  join_date: string;
  notes: string;
};

const PAYROLL_CURRENCIES = ['USD', 'EUR', 'PKR'] as const;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.');

const employeeFormSchema = z.object({
  full_name: z.string().trim().min(1, 'Full name is required.').max(160, 'Full name is too long.'),
  email: z
    .string()
    .trim()
    .refine((value) => !value || /.+@.+\..+/.test(value), 'Email format is invalid.'),
  payroll_currency: z.enum(PAYROLL_CURRENCIES),
  default_payout_account_id: z.number().int().positive('Employee settlement account is required.'),
  default_funding_account_id: z.number().int().nonnegative(),
  department_id: z.number().int().nonnegative(),
  base_salary_minor: z.number().int().nonnegative('Base salary cannot be negative.'),
  default_allowances_minor: z.number().int().nonnegative('Allowances cannot be negative.'),
  default_non_loan_deductions_minor: z.number().int().nonnegative('Deductions cannot be negative.'),
  join_date: z.string().trim().refine((value) => !value || dateSchema.safeParse(value).success, {
    message: 'Join date must be in YYYY-MM-DD format.',
  }),
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters.'),
});

function normalizeDateInput(rawValue: string): string | null {
  const value = rawValue.trim();
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const dmy = value.match(/^(\d{1,2})[/.\\-](\d{1,2})[/.\\-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const ymd = value.match(/^(\d{4})[/.\\-](\d{1,2})[/.\\-](\d{1,2})$/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

const initialForm: EmployeeForm = {
  full_name: '',
  email: '',
  payroll_currency: 'USD',
  default_payout_account_id: 0,
  default_funding_account_id: 0,
  department_id: 0,
  base_salary_minor: 0,
  default_allowances_minor: 0,
  default_non_loan_deductions_minor: 0,
  join_date: '',
  notes: '',
};

export default function EmployeesPage() {
  const { token } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState<EmployeeForm>(initialForm);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [busyEmployeeId, setBusyEmployeeId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const syncDefaultAccounts = (accountsPayload: Account[]) => {
    const firstCash = accountsPayload.find((account) => account.account_kind !== 'LOAN_RECEIVABLE_CONTROL');
    if (!firstCash) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      default_payout_account_id: prev.default_payout_account_id || firstCash.id,
      default_funding_account_id: prev.default_funding_account_id || firstCash.id,
      payroll_currency: prev.payroll_currency || firstCash.currency || PAYROLL_CURRENCIES[0],
    }));
  };

  const resetForm = (accountsPayload: Account[] = accountOptions) => {
    const firstCash = accountsPayload.find((account) => account.account_kind !== 'LOAN_RECEIVABLE_CONTROL');
    setForm({
      ...initialForm,
      default_payout_account_id: firstCash?.id || 0,
      default_funding_account_id: firstCash?.id || 0,
      payroll_currency: firstCash?.currency || 'USD',
    });
  };

  const load = async () => {
    if (!token) return;

    const [employeesPayload, accountsPayload, departmentsPayload] = await Promise.all([
      apiRequest<Employee[]>('/finance/employees', { token }),
      apiRequest<Account[]>('/finance/accounts', { token }),
      apiRequest<Department[]>('/finance/departments', { token }),
    ]);

    setEmployees(employeesPayload);
    setAccounts(accountsPayload);
    setDepartments(departmentsPayload);
    syncDefaultAccounts(accountsPayload);
  };

  useEffect(() => {
    load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load employees');
    });
  }, [token]);

  const openCreateModal = () => {
    resetForm(accountOptions);
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    resetForm(accountOptions);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    const parsed = validateWithSchema(employeeFormSchema, {
      ...form,
      full_name: form.full_name || '',
      email: form.email || '',
      payroll_currency: form.payroll_currency,
      default_payout_account_id: Number(form.default_payout_account_id),
      default_funding_account_id: Number(form.default_funding_account_id || 0),
      department_id: Number(form.department_id || 0),
      base_salary_minor: Number(form.base_salary_minor || 0),
      default_allowances_minor: Number(form.default_allowances_minor || 0),
      default_non_loan_deductions_minor: Number(form.default_non_loan_deductions_minor || 0),
      join_date: form.join_date || '',
      notes: form.notes || '',
    });

    if (!parsed.success) {
      setError(parsed.message);
      return;
    }

    const normalizedJoinDate = normalizeDateInput(parsed.data.join_date);
    if (parsed.data.join_date.trim() && !normalizedJoinDate) {
      setError('Join Date is invalid. Use YYYY-MM-DD or pick from the date control.');
      return;
    }

    if (!parsed.data.default_payout_account_id) {
      setError('Select a settlement account for this employee.');
      return;
    }

    try {
      await apiRequest('/finance/employees', {
        token,
        method: 'POST',
        body: {
          ...parsed.data,
          email: parsed.data.email || null,
          default_funding_account_id: parsed.data.default_funding_account_id || null,
          department_id: parsed.data.department_id || null,
          join_date: normalizedJoinDate,
          notes: parsed.data.notes || null,
        },
      });
      closeCreateModal();
      await load();
      setError(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create employee');
    }
  };

  const setEmployeeStatus = async (employeeId: number, status: 'ACTIVE' | 'INACTIVE') => {
    if (!token) return;

    try {
      setBusyEmployeeId(employeeId);
      if (status === 'INACTIVE') {
        await apiRequest(`/finance/employees/${employeeId}`, {
          token,
          method: 'DELETE',
        });
      } else {
        await apiRequest(`/finance/employees/${employeeId}`, {
          token,
          method: 'PATCH',
          body: { status: 'ACTIVE' },
        });
      }
      await load();
      setError(null);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update employee status');
    } finally {
      setBusyEmployeeId(null);
    }
  };

  return (
    <section className="page">
      <PageHeader
        badge="PAYROLL MASTER"
        title="Employees"
        subtitle="Manage employee payroll profiles, departments, and settlement defaults."
        actions={
          <button className="primary-button" type="button" onClick={openCreateModal}>
            New Employee
          </button>
        }
      />

      {error ? <p className="error-text">{error}</p> : null}

      <Modal open={isCreateModalOpen} onClose={closeCreateModal} title="Add Employee" size="lg">
        <form className="page" onSubmit={submit}>
          <div className="form-grid">
            <FormField label="Full Name">
              <input
                value={form.full_name}
                onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
                required
              />
            </FormField>

            <FormField label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </FormField>

            <FormField label="Join Date">
              <input
                type="date"
                value={form.join_date}
                onChange={(event) => setForm((prev) => ({ ...prev, join_date: event.target.value }))}
              />
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
                {PAYROLL_CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
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
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    default_funding_account_id: Number(event.target.value || 0),
                  }))
                }
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
            <button className="primary-button" type="submit">
              Save Employee
            </button>
            <button className="ghost-button" type="button" onClick={closeCreateModal}>
              Cancel
            </button>
          </FormActions>
        </form>
      </Modal>

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Status</th>
              <th>Department</th>
              <th>Settlement Account</th>
              <th>Funding Default</th>
              <th>Base Salary</th>
              <th>Active Loan</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id}>
                <td>
                  <Link href={`/employees/${employee.id}`}>
                    {employee.employee_code} - {employee.full_name}
                  </Link>
                </td>
                <td>{employee.status}</td>
                <td>{employee.department_name || 'Unassigned'}</td>
                <td>{employee.payout_account_name || '-'}</td>
                <td>{employee.funding_account_name || '-'}</td>
                <td>{formatMinor(employee.base_salary_minor, employee.payroll_currency)}</td>
                <td>{employee.active_loan_count ? 'Yes' : 'No'}</td>
                <td>
                  <div className="table-actions">
                    {employee.status === 'ACTIVE' ? (
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => setEmployeeStatus(employee.id, 'INACTIVE')}
                        disabled={busyEmployeeId === employee.id}
                      >
                        {busyEmployeeId === employee.id ? 'Updating...' : 'Deactivate'}
                      </button>
                    ) : (
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => setEmployeeStatus(employee.id, 'ACTIVE')}
                        disabled={busyEmployeeId === employee.id}
                      >
                        {busyEmployeeId === employee.id ? 'Updating...' : 'Activate'}
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
