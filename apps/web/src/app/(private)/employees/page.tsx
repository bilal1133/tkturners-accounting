'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/api';
import { formatMinor } from '@/lib/format';
import type { Account, Department, Employee } from '@/lib/types';

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

    if (!form.default_payout_account_id && accountsPayload.length > 0) {
      const firstCash = accountsPayload.find((account) => account.account_kind !== 'LOAN_RECEIVABLE_CONTROL');
      setForm((prev) => ({
        ...prev,
        default_payout_account_id: firstCash?.id || accountsPayload[0].id,
        default_funding_account_id: firstCash?.id || accountsPayload[0].id,
        payroll_currency: firstCash?.currency || accountsPayload[0].currency || PAYROLL_CURRENCIES[0],
      }));
    }
  };

  useEffect(() => {
    load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load employees');
    });
  }, [token]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    if (!form.default_payout_account_id) {
      setError('Select a settlement account for this employee.');
      return;
    }

    const normalizedJoinDate = normalizeDateInput(form.join_date);
    if (form.join_date.trim() && !normalizedJoinDate) {
      setError('Join Date is invalid. Use YYYY-MM-DD or pick from the date control.');
      return;
    }

    try {
      await apiRequest('/finance/employees', {
        token,
        method: 'POST',
        body: {
          ...form,
          email: form.email || null,
          default_funding_account_id: form.default_funding_account_id || null,
          department_id: form.department_id || null,
          join_date: normalizedJoinDate,
          notes: form.notes || null,
        },
      });
      setForm((prev) => ({
        ...initialForm,
        default_payout_account_id: prev.default_payout_account_id,
        default_funding_account_id: prev.default_funding_account_id,
      }));
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
      <header className="page-head">
        <div>
          <p className="badge">PAYROLL MASTER</p>
          <h2>Employees</h2>
        </div>
      </header>

      {error ? <p className="error-text">{error}</p> : null}

      <form className="card" onSubmit={submit}>
        <h3>Add Employee</h3>
        <div className="form-grid">
          <label>
            Full Name
            <input
              value={form.full_name}
              onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </label>
          <label>
            Join Date
            <input
              type="date"
              value={form.join_date}
              onChange={(event) => setForm((prev) => ({ ...prev, join_date: event.target.value }))}
            />
          </label>
          <label>
            Payroll Currency
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
          </label>
          <label>
            Department
            <select
              value={form.department_id}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  department_id: Number(event.target.value || 0),
                }))
              }
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
          </label>
          <label>
            Employee Settlement Account
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
          </label>
          <label>
            Funding Account (Default)
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
          </label>
          <label>
            Base Salary (minor)
            <input
              type="number"
              min={0}
              value={form.base_salary_minor}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, base_salary_minor: Number(event.target.value || 0) }))
              }
            />
          </label>
          <label>
            Default Allowances (minor)
            <input
              type="number"
              min={0}
              value={form.default_allowances_minor}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, default_allowances_minor: Number(event.target.value || 0) }))
              }
            />
          </label>
          <label>
            Default Deductions (minor)
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
          </label>
        </div>
        {settlementAccountOptions.length === 0 ? (
          <p className="error-text">
            No active cash account found for {form.payroll_currency}. Create one in Accounts first.
          </p>
        ) : null}
        <label>
          Notes
          <textarea
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          />
        </label>
        <button className="primary-button" type="submit">
          Save Employee
        </button>
      </form>

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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
