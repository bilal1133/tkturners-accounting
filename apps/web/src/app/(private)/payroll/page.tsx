'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/api';
import { formatMinor, lastFridayOfMonth, todayMonth } from '@/lib/format';
import { validateWithSchema } from '@/lib/validation';
import type { Employee, PayrollRun } from '@/lib/types';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';

type CreateRunForm = {
  period_month: string;
};

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be in YYYY-MM format.');
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

const createRunSchema = z.object({
  period_month: monthSchema,
});

const initialForm: CreateRunForm = {
  period_month: todayMonth(),
};

function isMonthString(value: string) {
  return monthPattern.test(String(value || ''));
}

function addMonths(month: string, delta: number) {
  if (!isMonthString(month)) {
    return todayMonth();
  }

  const [yearRaw, monthRaw] = month.split('-');
  const year = Number(yearRaw);
  const monthNumber = Number(monthRaw);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(month: string) {
  if (!isMonthString(month)) {
    return month;
  }
  const [yearRaw, monthRaw] = month.split('-');
  const date = new Date(Date.UTC(Number(yearRaw), Number(monthRaw) - 1, 1));
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function buildMonthOptions(existingMonths: string[]) {
  const takenMonths = Array.from(new Set(existingMonths.filter(isMonthString))).sort();
  const takenSet = new Set(takenMonths);
  const currentMonth = todayMonth();

  let startMonth = addMonths(currentMonth, -12);
  let endMonth = addMonths(currentMonth, 24);

  if (takenMonths.length > 0) {
    const firstTaken = takenMonths[0];
    const lastTaken = takenMonths[takenMonths.length - 1];
    if (firstTaken < startMonth) {
      startMonth = firstTaken;
    }
    const extendedLast = addMonths(lastTaken, 6);
    if (extendedLast > endMonth) {
      endMonth = extendedLast;
    }
  }

  const options: Array<{ value: string; label: string; disabled: boolean }> = [];
  let cursor = startMonth;
  while (cursor <= endMonth) {
    options.push({
      value: cursor,
      label: formatMonthLabel(cursor),
      disabled: takenSet.has(cursor),
    });
    cursor = addMonths(cursor, 1);
  }

  return options;
}

export default function PayrollRunsPage() {
  const { token, me } = useAuth();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState<CreateRunForm>(initialForm);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [deletingRunId, setDeletingRunId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const existingMonths = useMemo(() => new Set(runs.map((run) => run.period_month)), [runs]);
  const monthOptions = useMemo(() => buildMonthOptions(runs.map((run) => run.period_month)), [runs]);
  const availableMonthOptions = useMemo(() => monthOptions.filter((option) => !option.disabled), [monthOptions]);
  const noAvailableMonths = availableMonthOptions.length === 0;
  const selectedMonthTaken = existingMonths.has(form.period_month);
  const autoRunDate = form.period_month ? lastFridayOfMonth(form.period_month) : '';
  const sortedEmployees = useMemo(
    () => [...employees].sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || ''))),
    [employees]
  );
  const allEmployeesSelected = sortedEmployees.length > 0 && selectedEmployeeIds.length === sortedEmployees.length;
  const selectedEmployeeSet = useMemo(() => new Set(selectedEmployeeIds), [selectedEmployeeIds]);

  const load = async () => {
    if (!token) return;
    const [runsPayload, employeesPayload] = await Promise.all([
      apiRequest<PayrollRun[]>('/finance/payroll-runs', { token }),
      apiRequest<Employee[]>('/finance/employees', { token }),
    ]);
    setRuns(runsPayload);
    setEmployees(employeesPayload);
  };

  useEffect(() => {
    load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load payroll runs');
    });
  }, [token]);

  const openCreateModal = () => {
    const firstAvailable = availableMonthOptions[0]?.value || '';
    setForm({
      period_month: firstAvailable,
    });
    const defaultSelected = sortedEmployees
      .filter((employee) => employee.status === 'ACTIVE')
      .map((employee) => Number(employee.id));
    setSelectedEmployeeIds(defaultSelected);
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setForm(initialForm);
    setSelectedEmployeeIds([]);
  };

  const toggleSelectAllEmployees = () => {
    if (allEmployeesSelected) {
      setSelectedEmployeeIds([]);
      return;
    }
    setSelectedEmployeeIds(sortedEmployees.map((employee) => Number(employee.id)));
  };

  const toggleEmployeeSelection = (employeeId: number) => {
    setSelectedEmployeeIds((prev) => {
      if (prev.includes(employeeId)) {
        return prev.filter((id) => id !== employeeId);
      }
      return [...prev, employeeId];
    });
  };

  const createRun = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    const parsed = validateWithSchema(createRunSchema, {
      period_month: form.period_month,
    });

    if (!parsed.success) {
      setError(parsed.message);
      return;
    }

    if (existingMonths.has(parsed.data.period_month)) {
      setError('Payroll run already exists for the selected month.');
      return;
    }

    const canonicalRunDate = lastFridayOfMonth(parsed.data.period_month);
    if (!canonicalRunDate) {
      setError('Invalid month selected.');
      return;
    }

    if (selectedEmployeeIds.length === 0) {
      setError('Select at least one employee for this payroll run.');
      return;
    }

    try {
      await apiRequest('/finance/payroll-runs', {
        token,
        method: 'POST',
        body: {
          period_month: parsed.data.period_month,
          cutoff_date: canonicalRunDate,
          payday_date: canonicalRunDate,
          employee_ids: selectedEmployeeIds,
        },
      });
      closeCreateModal();
      await load();
      setError(null);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create payroll run');
    }
  };

  const runAction = async (runId: number, action: 'generate' | 'approve' | 'pay') => {
    if (!token) return;

    try {
      await apiRequest(`/finance/payroll-runs/${runId}/${action}`, {
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

  const deleteRun = async (run: PayrollRun) => {
    if (!token) return;
    if (run.status === 'PAID') {
      setError('Paid payroll runs cannot be deleted.');
      return;
    }

    const confirmed = window.confirm(
      `Delete payroll run ${run.period_month}? This removes generated entries for this run.`
    );
    if (!confirmed) return;

    try {
      setDeletingRunId(run.id);
      await apiRequest(`/finance/payroll-runs/${run.id}`, {
        token,
        method: 'DELETE',
      });
      await load();
      setError(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete payroll run');
    } finally {
      setDeletingRunId(null);
    }
  };

  return (
    <section className="page">
      <PageHeader
        badge="PAYROLL WORKFLOW"
        title="Payroll Runs"
        subtitle="Create, approve, and pay monthly payroll cycles."
        actions={
          <button className="primary-button" type="button" onClick={openCreateModal}>
            New Payroll Run
          </button>
        }
      />

      {error ? <p className="error-text">{error}</p> : null}

      <Modal open={isCreateModalOpen} onClose={closeCreateModal} title="Create Monthly Payroll Run" size="lg">
        <form className="page" onSubmit={createRun}>
          <div className="form-grid">
            <FormField label="Period Month">
              <select
                value={form.period_month}
                onChange={(event) => setForm((prev) => ({ ...prev, period_month: event.target.value }))}
                required
              >
                {!form.period_month ? <option value="">No available month</option> : null}
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                    {option.disabled ? ' (already created)' : ''}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <p className="muted-text">Cutoff date and payday are auto-calculated as the last Friday of the selected month.</p>
          {autoRunDate ? <p className="muted-text">Auto date: {autoRunDate}</p> : null}
          <div className="card table-wrap">
            <div className="section-head">
              <div>
                <p className="section-title">Employees Included</p>
                <p className="section-subtitle">Select which employees will be included in this payroll run.</p>
              </div>
              <div className="table-actions">
                <button className="ghost-button" type="button" onClick={toggleSelectAllEmployees}>
                  {allEmployeesSelected ? 'Clear All' : 'Select All'}
                </button>
              </div>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 72 }}>Select</th>
                  <th>Employee</th>
                  <th>Status</th>
                  <th>Department</th>
                  <th>Payroll Currency</th>
                </tr>
              </thead>
              <tbody>
                {sortedEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted-text">
                      No employees found.
                    </td>
                  </tr>
                ) : (
                  sortedEmployees.map((employee) => (
                    <tr key={employee.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedEmployeeSet.has(employee.id)}
                          onChange={() => toggleEmployeeSelection(employee.id)}
                        />
                      </td>
                      <td>
                        {employee.employee_code} - {employee.full_name}
                      </td>
                      <td>{employee.status}</td>
                      <td>
                        {employee.department_code ? `${employee.department_code} - ` : ''}
                        {employee.department_name || 'Unassigned'}
                      </td>
                      <td>{employee.payroll_currency}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <p className="muted-text">Selected employees: {selectedEmployeeIds.length}</p>
          </div>
          {selectedMonthTaken ? <p className="error-text">Selected month already has a payroll run.</p> : null}
          {noAvailableMonths ? <p className="error-text">All selectable months in this range are already created.</p> : null}

          <FormActions>
            <button
              className="primary-button"
              type="submit"
              disabled={
                noAvailableMonths
                || selectedMonthTaken
                || !form.period_month
                || selectedEmployeeIds.length === 0
              }
            >
              Create Run
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
              <th>Period</th>
              <th>Status</th>
              <th>Payday</th>
              <th>Entries</th>
              <th>Total Net</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>
                  <Link href={`/payroll/${run.id}`}>{run.period_month}</Link>
                </td>
                <td>{run.status}</td>
                <td>{run.payday_date}</td>
                <td>{run.entries_count || 0}</td>
                <td>{formatMinor(run.total_net_paid_minor || 0, me?.workspace.base_currency || 'USD')}</td>
                <td>
                  <div className="table-actions">
                    <button className="ghost-button" type="button" onClick={() => runAction(run.id, 'generate')}>
                      Generate
                    </button>
                    <button className="ghost-button" type="button" onClick={() => runAction(run.id, 'approve')}>
                      Approve
                    </button>
                    <button className="primary-button" type="button" onClick={() => runAction(run.id, 'pay')}>
                      Pay
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => deleteRun(run)}
                      disabled={run.status === 'PAID' || deletingRunId === run.id}
                    >
                      {deletingRunId === run.id ? 'Deleting...' : 'Delete'}
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
