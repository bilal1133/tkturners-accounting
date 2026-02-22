'use client';

import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { apiDownload, apiRequest } from '@/lib/api';
import { formatMinor, todayMonth } from '@/lib/format';

type MonthlySummary = {
  month: string;
  mode: 'base' | 'per_currency';
  base_currency?: string;
  totals?: {
    revenue: number;
    expense: number;
    profit_loss: number;
    cash_in: number;
    cash_out: number;
    transfer_volume: number;
    excluded_unconverted_count: number;
  };
  by_currency?: Array<{
    currency: string;
    revenue: number;
    expense: number;
    profit_loss: number;
    cash_in: number;
    cash_out: number;
    transfer_volume: number;
  }>;
};

type ExpenseBreakdownRow = {
  category_name: string;
  currency: string;
  total_minor: number;
};

type CashflowRow = {
  month: string;
  revenue: number;
  expense: number;
  profit_loss: number;
  transfer_volume: number;
};

type PayrollSummary = {
  month: string;
  totals: {
    employees_count: number;
    gross_minor: number;
    non_loan_deductions_minor: number;
    actual_loan_deductions_minor: number;
    net_paid_minor: number;
    principal_repaid_minor: number;
    interest_repaid_minor: number;
  };
};

type LoanOutstanding = {
  as_of: string;
  totals: {
    loans_count: number;
    outstanding_principal_minor: number;
    outstanding_interest_minor: number;
    outstanding_total_minor: number;
  };
  rows: Array<{
    id: number;
    employee_name: string;
    currency: string;
    status: string;
    outstanding_principal_minor: number;
    outstanding_interest_minor: number;
  }>;
};

type PayrollDepartmentSpend = {
  month: string;
  mode: 'base' | 'per_currency';
  base_currency?: string;
  totals?: {
    total_minor: number;
    excluded_unconverted_count: number;
  };
  rows: Array<{
    department_id: number | null;
    department_name: string;
    department_code: string | null;
    currency?: string;
    total_minor: number;
    employees_count: number;
    excluded_unconverted_count?: number;
    share_pct: number;
  }>;
};

const PIE_COLORS = [
  '#0f766e',
  '#1d4ed8',
  '#ea580c',
  '#16a34a',
  '#be185d',
  '#b45309',
  '#475569',
];

export default function ReportsPage() {
  const { token, me } = useAuth();
  const [month, setMonth] = useState(todayMonth());
  const [mode, setMode] = useState<'base' | 'per_currency'>('base');
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [breakdown, setBreakdown] = useState<ExpenseBreakdownRow[]>([]);
  const [cashflow, setCashflow] = useState<CashflowRow[]>([]);
  const [payrollSummary, setPayrollSummary] = useState<PayrollSummary | null>(null);
  const [departmentSpend, setDepartmentSpend] = useState<PayrollDepartmentSpend | null>(null);
  const [loanOutstanding, setLoanOutstanding] = useState<LoanOutstanding | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;

    const [
      summaryPayload,
      breakdownPayload,
      cashflowPayload,
      payrollSummaryPayload,
      departmentSpendPayload,
      loanOutstandingPayload,
    ] =
      await Promise.all([
      apiRequest<MonthlySummary>(`/finance/reports/monthly-summary?month=${month}&mode=${mode}`, { token }),
      apiRequest<ExpenseBreakdownRow[]>(`/finance/reports/expense-breakdown?month=${month}`, { token }),
      apiRequest<CashflowRow[]>(`/finance/reports/cashflow?from=${month}&to=${month}`, { token }),
      apiRequest<PayrollSummary>(`/finance/reports/payroll-summary?month=${month}`, { token }),
      apiRequest<PayrollDepartmentSpend>(`/finance/reports/payroll-by-department?month=${month}&mode=${mode}`, {
        token,
      }),
      apiRequest<LoanOutstanding>('/finance/reports/loan-outstanding', { token }),
    ]);

    setSummary(summaryPayload);
    setBreakdown(breakdownPayload);
    setCashflow(cashflowPayload);
    setPayrollSummary(payrollSummaryPayload);
    setDepartmentSpend(departmentSpendPayload);
    setLoanOutstanding(loanOutstandingPayload);
  };

  useEffect(() => {
    load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load reports');
    });
  }, [token, month, mode]);

  const baseCurrency = me?.workspace.base_currency || 'USD';
  const departmentSpendMode = departmentSpend?.mode || mode;
  const departmentPie = useMemo(() => {
    if (!departmentSpend || departmentSpend.mode !== 'base' || !departmentSpend.rows.length) {
      return null;
    }

    let start = 0;
    const stops = departmentSpend.rows
      .filter((row) => row.share_pct > 0)
      .map((row, index) => {
        const end = Math.min(100, start + row.share_pct);
        const stop = `${PIE_COLORS[index % PIE_COLORS.length]} ${start}% ${end}%`;
        start = end;
        return stop;
      });

    if (start < 100) {
      stops.push(`#e5e7eb ${start}% 100%`);
    }

    return `conic-gradient(${stops.join(', ')})`;
  }, [departmentSpend]);

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="badge">MONTHLY ANALYTICS</p>
          <h2>Reports</h2>
        </div>
        <button
          className="ghost-button"
          onClick={() => {
            if (!token) return;
            apiDownload(`/finance/exports/monthly-summary.csv?month=${month}&mode=${mode}`, token).catch(
              (downloadError) => {
                setError(downloadError instanceof Error ? downloadError.message : 'Download failed');
              }
            );
          }}
        >
          Export Summary CSV
        </button>
      </header>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="card">
        <div className="form-grid">
          <label>
            Month
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
          <label>
            Mode
            <select value={mode} onChange={(event) => setMode(event.target.value as 'base' | 'per_currency')}>
              <option value="base">Base Currency</option>
              <option value="per_currency">Per Currency</option>
            </select>
          </label>
        </div>
      </div>

      <div className="card">
        <h3>Monthly Summary</h3>
        {summary?.mode === 'base' && summary.totals ? (
          <div className="grid-cards">
            <div className="stat-card">
              <p>Revenue</p>
              <h3>{formatMinor(summary.totals.revenue, baseCurrency)}</h3>
            </div>
            <div className="stat-card">
              <p>Expense</p>
              <h3>{formatMinor(summary.totals.expense, baseCurrency)}</h3>
            </div>
            <div className="stat-card">
              <p>P/L</p>
              <h3>{formatMinor(summary.totals.profit_loss, baseCurrency)}</h3>
            </div>
            <div className="stat-card">
              <p>Cashflow (In / Out)</p>
              <h3>
                {formatMinor(summary.totals.cash_in, baseCurrency)} / {formatMinor(summary.totals.cash_out, baseCurrency)}
              </h3>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Currency</th>
                  <th>Revenue</th>
                  <th>Expense</th>
                  <th>P/L</th>
                </tr>
              </thead>
              <tbody>
                {summary?.by_currency?.map((entry) => (
                  <tr key={entry.currency}>
                    <td>{entry.currency}</td>
                    <td>{formatMinor(entry.revenue, entry.currency)}</td>
                    <td>{formatMinor(entry.expense, entry.currency)}</td>
                    <td>{formatMinor(entry.profit_loss, entry.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card table-wrap">
        <h3>Expense Breakdown</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((entry, index) => (
              <tr key={`${entry.category_name}-${index}`}>
                <td>{entry.category_name || 'Uncategorized'}</td>
                <td>{formatMinor(entry.total_minor, entry.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card table-wrap">
        <h3>Cashflow</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Revenue</th>
              <th>Expense</th>
              <th>Profit/Loss</th>
              <th>Transfer Volume</th>
            </tr>
          </thead>
          <tbody>
            {cashflow.map((entry) => (
              <tr key={entry.month}>
                <td>{entry.month}</td>
                <td>{formatMinor(entry.revenue, baseCurrency)}</td>
                <td>{formatMinor(entry.expense, baseCurrency)}</td>
                <td>{formatMinor(entry.profit_loss, baseCurrency)}</td>
                <td>{formatMinor(entry.transfer_volume, baseCurrency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Payroll Summary ({month})</h3>
        <button
          className="ghost-button"
          onClick={() => {
            if (!token) return;
            apiDownload(`/finance/exports/payroll.csv?month=${month}`, token).catch((downloadError) => {
              setError(downloadError instanceof Error ? downloadError.message : 'Download failed');
            });
          }}
        >
          Export Payroll CSV
        </button>
        {payrollSummary ? (
          <div className="grid-cards">
            <div className="stat-card">
              <p>Employees</p>
              <h3>{payrollSummary.totals.employees_count}</h3>
            </div>
            <div className="stat-card">
              <p>Gross Payroll</p>
              <h3>{formatMinor(payrollSummary.totals.gross_minor, baseCurrency)}</h3>
            </div>
            <div className="stat-card">
              <p>Loan Deductions</p>
              <h3>{formatMinor(payrollSummary.totals.actual_loan_deductions_minor, baseCurrency)}</h3>
            </div>
            <div className="stat-card">
              <p>Net Paid</p>
              <h3>{formatMinor(payrollSummary.totals.net_paid_minor, baseCurrency)}</h3>
            </div>
          </div>
        ) : (
          <p>No payroll rows for this month yet.</p>
        )}
      </div>

      <div className="card table-wrap">
        <h3>Payroll Spend by Department ({month})</h3>
        {!departmentSpend ? (
          <p>Loading department spend...</p>
        ) : departmentSpend.mode === 'base' ? (
          <p>
            Total: {formatMinor(departmentSpend.totals?.total_minor || 0, departmentSpend.base_currency || baseCurrency)}
            {' | '}
            Unconverted rows: {departmentSpend.totals?.excluded_unconverted_count || 0}
          </p>
        ) : (
          <p>Per-currency department spend distribution.</p>
        )}
        {departmentPie ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
            <div
              style={{
                width: 180,
                height: 180,
                borderRadius: '50%',
                background: departmentPie,
                border: '1px solid rgba(0,0,0,0.08)',
              }}
            />
          </div>
        ) : null}
        <table className="table">
          <thead>
            <tr>
              <th>Department</th>
              <th>Currency</th>
              <th>Employees</th>
              <th>Spend</th>
              <th>Share</th>
              <th>Visual</th>
            </tr>
          </thead>
          <tbody>
            {departmentSpend?.rows.map((row, index) => {
              const rowCurrency =
                departmentSpendMode === 'base'
                  ? departmentSpend?.base_currency || baseCurrency
                  : row.currency || baseCurrency;
              return (
                <tr key={`${row.department_name}-${row.currency || 'base'}-${index}`}>
                  <td>
                    {row.department_name}
                    {row.department_code ? ` (${row.department_code})` : ''}
                  </td>
                  <td>{rowCurrency}</td>
                  <td>{row.employees_count}</td>
                  <td>{formatMinor(row.total_minor, rowCurrency)}</td>
                  <td>{row.share_pct.toFixed(2)}%</td>
                  <td style={{ minWidth: 180 }}>
                    <div
                      style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.08)',
                        borderRadius: 999,
                        height: 10,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(0, Math.min(100, row.share_pct))}%`,
                          height: '100%',
                          background: 'var(--accent)',
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card table-wrap">
        <h3>Loan Outstanding</h3>
        <button
          className="ghost-button"
          onClick={() => {
            if (!token) return;
            apiDownload('/finance/exports/loan-ledger.csv', token).catch((downloadError) => {
              setError(downloadError instanceof Error ? downloadError.message : 'Download failed');
            });
          }}
        >
          Export Loan Ledger CSV
        </button>
        <p>
          Total Outstanding: {formatMinor(loanOutstanding?.totals.outstanding_total_minor || 0, baseCurrency)}
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Loan</th>
              <th>Employee</th>
              <th>Status</th>
              <th>Principal Outstanding</th>
              <th>Interest Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {loanOutstanding?.rows.map((row) => (
              <tr key={row.id}>
                <td>#{row.id}</td>
                <td>{row.employee_name}</td>
                <td>{row.status}</td>
                <td>{formatMinor(row.outstanding_principal_minor, row.currency)}</td>
                <td>{formatMinor(row.outstanding_interest_minor, row.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
