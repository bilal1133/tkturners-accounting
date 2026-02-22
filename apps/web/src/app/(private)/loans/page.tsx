'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/api';
import { formatMinor, todayDate } from '@/lib/format';
import type { Account, Employee, EmployeeLoan } from '@/lib/types';

type LoanForm = {
  employee_id: number;
  currency: string;
  principal_minor: number;
  annual_interest_bps: number;
  installment_minor: number;
  disbursement_account_id: number;
  receivable_control_account_id: number | null;
  first_due_date: string;
};

type RepaymentForm = {
  loan_id: number;
  repayment_date: string;
  amount_minor: number;
  cash_account_id: number;
};

type LoanDisbursementForm = {
  disbursement_date: string;
  from_amount_minor: string;
  fx_rate: string;
  transfer_fee_amount_minor: string;
  transfer_fee_description: string;
};

const initialLoanDisbursementForm: LoanDisbursementForm = {
  disbursement_date: todayDate(),
  from_amount_minor: '',
  fx_rate: '',
  transfer_fee_amount_minor: '',
  transfer_fee_description: '',
};

const initialLoanForm: LoanForm = {
  employee_id: 0,
  currency: 'USD',
  principal_minor: 0,
  annual_interest_bps: 0,
  installment_minor: 0,
  disbursement_account_id: 0,
  receivable_control_account_id: null,
  first_due_date: todayDate(),
};

const initialRepaymentForm: RepaymentForm = {
  loan_id: 0,
  repayment_date: todayDate(),
  amount_minor: 0,
  cash_account_id: 0,
};

function makeInitialDisbursementForm(loan?: EmployeeLoan): LoanDisbursementForm {
  const sameCurrency =
    loan && loan.disbursement_account_currency && loan.disbursement_account_currency === loan.currency;
  return {
    disbursement_date: initialLoanDisbursementForm.disbursement_date,
    from_amount_minor: sameCurrency ? String(loan.principal_minor) : '',
    fx_rate: '',
    transfer_fee_amount_minor: '',
    transfer_fee_description: '',
  };
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeAccount(account: Account): Account {
  return {
    ...account,
    id: asNumber(account.id),
    owner_user_id: asNullableNumber(account.owner_user_id),
    opening_balance_minor: asNumber(account.opening_balance_minor),
    current_balance_minor: asNumber(account.current_balance_minor),
  };
}

function normalizeEmployee(employee: Employee): Employee {
  return {
    ...employee,
    id: asNumber(employee.id),
    default_payout_account_id: asNumber(employee.default_payout_account_id),
    default_funding_account_id: asNullableNumber(employee.default_funding_account_id),
    department_id: asNullableNumber(employee.department_id),
    linked_counterparty_id: asNumber(employee.linked_counterparty_id),
    base_salary_minor: asNumber(employee.base_salary_minor),
    default_allowances_minor: asNumber(employee.default_allowances_minor),
    default_non_loan_deductions_minor: asNumber(employee.default_non_loan_deductions_minor),
  };
}

function normalizeLoan(loan: EmployeeLoan): EmployeeLoan {
  return {
    ...loan,
    id: asNumber(loan.id),
    workspace_id: asNumber(loan.workspace_id),
    employee_id: asNumber(loan.employee_id),
    principal_minor: asNumber(loan.principal_minor),
    annual_interest_bps: asNumber(loan.annual_interest_bps),
    installment_minor: asNumber(loan.installment_minor),
    outstanding_principal_minor: asNumber(loan.outstanding_principal_minor),
    outstanding_interest_minor: asNumber(loan.outstanding_interest_minor),
    disbursement_account_id: asNumber(loan.disbursement_account_id),
    receivable_control_account_id: asNumber(loan.receivable_control_account_id),
    disbursement_transaction_id: asNullableNumber(loan.disbursement_transaction_id),
  };
}

function getLoanDisbursementAction(loan: EmployeeLoan): {
  canDisburse: boolean;
  label: string;
  hint: string | null;
} {
  const isReady = loan.status === 'APPROVED' || loan.status === 'DRAFT';
  if (isReady) {
    return {
      canDisburse: true,
      label: 'Disburse',
      hint: null,
    };
  }

  const alreadyDisbursed =
    loan.status === 'ACTIVE' || Boolean(loan.disbursement_date) || Boolean(loan.disbursement_transaction_id);

  if (alreadyDisbursed) {
    const parts: string[] = ['Already disbursed'];
    if (loan.disbursement_date) {
      parts.push(`on ${loan.disbursement_date}`);
    }
    if (loan.disbursement_transaction_id) {
      parts.push(`(Txn #${loan.disbursement_transaction_id})`);
    }

    return {
      canDisburse: false,
      label: 'Disbursed',
      hint: parts.join(' '),
    };
  }

  return {
    canDisburse: false,
    label: 'Locked',
    hint: `Loan status ${loan.status} cannot be disbursed.`,
  };
}

export default function LoansPage() {
  const { token } = useAuth();
  const [loans, setLoans] = useState<EmployeeLoan[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loanForm, setLoanForm] = useState<LoanForm>(initialLoanForm);
  const [createAndDisburse, setCreateAndDisburse] = useState(false);
  const [createDisbursementForm, setCreateDisbursementForm] = useState<LoanDisbursementForm>(
    initialLoanDisbursementForm
  );
  const [repaymentForm, setRepaymentForm] = useState<RepaymentForm>(initialRepaymentForm);
  const [loanDisbursements, setLoanDisbursements] = useState<Record<number, LoanDisbursementForm>>({});
  const [error, setError] = useState<string | null>(null);

  const cashAccounts = useMemo(
    () => accounts.filter((account) => account.is_active && account.account_kind !== 'LOAN_RECEIVABLE_CONTROL'),
    [accounts]
  );

  const load = async () => {
    if (!token) return;

    const [loanPayload, employeePayload, accountPayload] = await Promise.all([
      apiRequest<EmployeeLoan[]>('/finance/loans', { token }),
      apiRequest<Employee[]>('/finance/employees', { token }),
      apiRequest<Account[]>('/finance/accounts', { token }),
    ]);

    const normalizedLoans = loanPayload.map(normalizeLoan);
    const normalizedEmployees = employeePayload.map(normalizeEmployee);
    const normalizedAccounts = accountPayload.map(normalizeAccount);

    setLoans(normalizedLoans);
    setEmployees(normalizedEmployees);
    setAccounts(normalizedAccounts);
    setLoanDisbursements((previous) => {
      const next: Record<number, LoanDisbursementForm> = { ...previous };
      for (const loan of normalizedLoans) {
        if (!next[loan.id]) {
          next[loan.id] = makeInitialDisbursementForm(loan);
        }
      }
      return next;
    });

    if (!loanForm.employee_id && normalizedEmployees.length > 0) {
      const activeEmployee =
        normalizedEmployees.find((employee) => employee.status === 'ACTIVE') || normalizedEmployees[0];
      const payoutAccount = normalizedAccounts.find(
        (account) => account.id === activeEmployee.default_payout_account_id
      );

      setLoanForm((prev) => ({
        ...prev,
        employee_id: activeEmployee.id,
        currency: activeEmployee.payroll_currency,
        disbursement_account_id: payoutAccount?.id || normalizedAccounts[0]?.id || 0,
      }));
    }

    if (!repaymentForm.cash_account_id && normalizedAccounts.length > 0) {
      const firstCash = normalizedAccounts.find((account) => account.account_kind !== 'LOAN_RECEIVABLE_CONTROL');
      setRepaymentForm((prev) => ({
        ...prev,
        cash_account_id: firstCash?.id || normalizedAccounts[0].id,
      }));
    }
  };

  useEffect(() => {
    load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load loans');
    });
  }, [token]);

  const submitLoan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    if (
      createAndDisburse &&
      createDisbursementIsCrossCurrency &&
      (!createDisbursementForm.from_amount_minor.trim() || !createDisbursementForm.fx_rate.trim())
    ) {
      setError('To disburse cross-currency during create, provide source amount and FX rate.');
      return;
    }

    let createdLoanId: number | null = null;

    try {
      const createdLoan = await apiRequest<EmployeeLoan>('/finance/loans', {
        token,
        method: 'POST',
        body: {
          ...loanForm,
          receivable_control_account_id: loanForm.receivable_control_account_id || undefined,
          first_due_date: loanForm.first_due_date || undefined,
        },
      });
      createdLoanId = createdLoan.id;

      if (createAndDisburse) {
        const transferFeeAmount = createDisbursementForm.transfer_fee_amount_minor.trim();
        const sourceAmountMinor =
          createDisbursementIsCrossCurrency && createDisbursementForm.from_amount_minor.trim()
            ? Number(createDisbursementForm.from_amount_minor)
            : undefined;
        const fxRate =
          createDisbursementIsCrossCurrency && createDisbursementForm.fx_rate.trim()
            ? Number(createDisbursementForm.fx_rate)
            : undefined;

        await apiRequest(`/finance/loans/${createdLoan.id}/disburse`, {
          token,
          method: 'POST',
          body: {
            disbursement_date: createDisbursementForm.disbursement_date || undefined,
            from_amount_minor: sourceAmountMinor,
            fx_rate: fxRate,
            transfer_fee_amount_minor: transferFeeAmount ? Number(transferFeeAmount) : undefined,
            transfer_fee_currency: transferFeeAmount ? createDisbursementSourceCurrency : undefined,
            transfer_fee_description: createDisbursementForm.transfer_fee_description.trim() || undefined,
          },
        });
      }

      await load();
      setCreateAndDisburse(false);
      setCreateDisbursementForm(initialLoanDisbursementForm);
      setError(null);
    } catch (submitError) {
      await load().catch(() => undefined);
      const message = submitError instanceof Error ? submitError.message : 'Failed to create loan';
      if (createdLoanId && createAndDisburse) {
        setError(`Loan #${createdLoanId} was created, but disbursement failed: ${message}`);
      } else {
        setError(message);
      }
    }
  };

  const setDisbursementInput = (loanId: number, updates: Partial<LoanDisbursementForm>) => {
    setLoanDisbursements((previous) => ({
      ...previous,
      [loanId]: {
        ...(previous[loanId] || makeInitialDisbursementForm()),
        ...updates,
      },
    }));
  };

  const disburse = async (loan: EmployeeLoan) => {
    if (!token) return;

    const disbursementConfig = loanDisbursements[loan.id] || makeInitialDisbursementForm(loan);
    const sourceCurrency = loan.disbursement_account_currency || loan.currency;
    const isCrossCurrency = sourceCurrency !== loan.currency;

    if (isCrossCurrency) {
      if (!disbursementConfig.from_amount_minor.trim() || !disbursementConfig.fx_rate.trim()) {
        setError('Cross-currency loan disbursement requires source amount and FX rate.');
        return;
      }
    }

    try {
      await apiRequest(`/finance/loans/${loan.id}/disburse`, {
        token,
        method: 'POST',
        body: {
          disbursement_date: disbursementConfig.disbursement_date || undefined,
          from_amount_minor: disbursementConfig.from_amount_minor.trim()
            ? Number(disbursementConfig.from_amount_minor)
            : undefined,
          fx_rate: disbursementConfig.fx_rate.trim() ? Number(disbursementConfig.fx_rate) : undefined,
          transfer_fee_amount_minor: disbursementConfig.transfer_fee_amount_minor.trim()
            ? Number(disbursementConfig.transfer_fee_amount_minor)
            : undefined,
          transfer_fee_currency: disbursementConfig.transfer_fee_amount_minor.trim()
            ? sourceCurrency
            : undefined,
          transfer_fee_description: disbursementConfig.transfer_fee_description.trim() || undefined,
        },
      });
      await load();
      setError(null);
    } catch (disburseError) {
      setError(disburseError instanceof Error ? disburseError.message : 'Failed to disburse loan');
    }
  };

  const submitRepayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    try {
      await apiRequest(`/finance/loans/${repaymentForm.loan_id}/repay`, {
        token,
        method: 'POST',
        body: {
          repayment_date: repaymentForm.repayment_date,
          amount_minor: repaymentForm.amount_minor,
          cash_account_id: repaymentForm.cash_account_id,
        },
      });
      setRepaymentForm((prev) => ({ ...prev, amount_minor: 0 }));
      await load();
      setError(null);
    } catch (repayError) {
      setError(repayError instanceof Error ? repayError.message : 'Failed to post repayment');
    }
  };

  const selectedEmployee = employees.find((employee) => employee.id === Number(loanForm.employee_id));
  const selectedDisbursementAccount = cashAccounts.find(
    (account) => account.id === Number(loanForm.disbursement_account_id)
  );
  const loanCurrency = selectedEmployee?.payroll_currency || loanForm.currency;
  const createDisbursementSourceCurrency = selectedDisbursementAccount?.currency || loanCurrency;
  const createDisbursementIsCrossCurrency = createDisbursementSourceCurrency !== loanCurrency;
  const createDisbursementPreviewRate =
    createDisbursementIsCrossCurrency &&
    Number(loanForm.principal_minor) > 0 &&
    Number(createDisbursementForm.from_amount_minor) > 0
      ? Number(loanForm.principal_minor) / Number(createDisbursementForm.from_amount_minor)
      : null;
  const createSourceAmountMinor = createDisbursementIsCrossCurrency
    ? asNumber(createDisbursementForm.from_amount_minor)
    : asNumber(loanForm.principal_minor);
  const createTransferFeeMinor = asNumber(createDisbursementForm.transfer_fee_amount_minor);
  const createTotalSourceDebitMinor = createSourceAmountMinor + createTransferFeeMinor;

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="badge">LOAN SUBLEDGER</p>
          <h2>Employee Loans</h2>
        </div>
      </header>

      {error ? <p className="error-text">{error}</p> : null}

      <form className="card" onSubmit={submitLoan}>
        <h3>Create Loan</h3>
        <div className="form-grid">
          <label>
            Employee
            <select
              value={loanForm.employee_id}
              onChange={(event) => {
                const employeeId = Number(event.target.value);
                const employee = employees.find((entry) => entry.id === employeeId);
                const payout = accounts.find((entry) => entry.id === employee?.default_payout_account_id);
                setLoanForm((prev) => ({
                  ...prev,
                  employee_id: employeeId,
                  currency: employee?.payroll_currency || prev.currency,
                  disbursement_account_id: payout?.id || prev.disbursement_account_id,
                }));
              }}
            >
              {employees
                .filter((employee) => employee.status === 'ACTIVE')
                .map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.employee_code} - {employee.full_name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Currency
            <input value={selectedEmployee?.payroll_currency || loanForm.currency} disabled />
          </label>
          <label>
            Disbursement Account
            <select
              value={loanForm.disbursement_account_id}
              onChange={(event) =>
                setLoanForm((prev) => ({ ...prev, disbursement_account_id: Number(event.target.value) }))
              }
            >
              {cashAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.currency})
                </option>
              ))}
            </select>
          </label>
          <label>
            Principal (minor)
            <input
              type="number"
              min={1}
              value={loanForm.principal_minor}
              onChange={(event) =>
                setLoanForm((prev) => ({ ...prev, principal_minor: Number(event.target.value || 0) }))
              }
              required
            />
          </label>
          <label>
            Installment (minor)
            <input
              type="number"
              min={1}
              value={loanForm.installment_minor}
              onChange={(event) =>
                setLoanForm((prev) => ({ ...prev, installment_minor: Number(event.target.value || 0) }))
              }
              required
            />
          </label>
          <label>
            Annual Interest (bps)
            <input
              type="number"
              min={0}
              value={loanForm.annual_interest_bps}
              onChange={(event) =>
                setLoanForm((prev) => ({ ...prev, annual_interest_bps: Number(event.target.value || 0) }))
              }
            />
          </label>
          <label>
            First Due Date
            <input
              type="date"
              value={loanForm.first_due_date}
              onChange={(event) => setLoanForm((prev) => ({ ...prev, first_due_date: event.target.value }))}
            />
          </label>
          <div
            style={{
              gridColumn: '1 / -1',
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: '0.75rem',
              display: 'grid',
              gap: '0.55rem',
            }}
          >
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', color: 'var(--text)' }}>
              <input
                type="checkbox"
                checked={createAndDisburse}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setCreateAndDisburse(checked);
                  if (!checked) return;
                  setCreateDisbursementForm((prev) => ({
                    ...prev,
                    disbursement_date: prev.disbursement_date || todayDate(),
                    from_amount_minor:
                      !createDisbursementIsCrossCurrency && Number(loanForm.principal_minor) > 0
                        ? String(loanForm.principal_minor)
                        : prev.from_amount_minor,
                    fx_rate: !createDisbursementIsCrossCurrency ? '' : prev.fx_rate,
                  }));
                }}
              />
              Disburse immediately after loan creation
            </label>
            <p style={{ margin: 0, color: 'var(--muted)' }}>
              Conversion path: {createDisbursementSourceCurrency} funding account {'->'} {loanCurrency} loan
              receivable account.
            </p>
            {createAndDisburse ? (
              <div className="form-grid">
                <label>
                  Disbursement Date
                  <input
                    type="date"
                    value={createDisbursementForm.disbursement_date}
                    onChange={(event) =>
                      setCreateDisbursementForm((prev) => ({ ...prev, disbursement_date: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Source Amount Debited (minor, {createDisbursementSourceCurrency})
                  <input
                    type="number"
                    min={1}
                    value={createDisbursementForm.from_amount_minor}
                    placeholder={
                      !createDisbursementIsCrossCurrency && Number(loanForm.principal_minor) > 0
                        ? String(loanForm.principal_minor)
                        : ''
                    }
                    onChange={(event) =>
                      setCreateDisbursementForm((prev) => ({ ...prev, from_amount_minor: event.target.value }))
                    }
                  />
                </label>
                {createDisbursementIsCrossCurrency ? (
                  <label>
                    Conversion Rate ({createDisbursementSourceCurrency} {'->'} {loanCurrency})
                    <input
                      type="number"
                      min={0}
                      step="0.000001"
                      value={createDisbursementForm.fx_rate}
                      onChange={(event) =>
                        setCreateDisbursementForm((prev) => ({ ...prev, fx_rate: event.target.value }))
                      }
                      required
                    />
                  </label>
                ) : (
                  <label>
                    FX Rate
                    <input value="1 (same currency)" disabled />
                  </label>
                )}
                <label>
                  Transaction Fee (minor, {createDisbursementSourceCurrency}, deducted from source)
                  <input
                    type="number"
                    min={0}
                    value={createDisbursementForm.transfer_fee_amount_minor}
                    onChange={(event) =>
                      setCreateDisbursementForm((prev) => ({
                        ...prev,
                        transfer_fee_amount_minor: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Fee Description (optional)
                  <input
                    value={createDisbursementForm.transfer_fee_description}
                    onChange={(event) =>
                      setCreateDisbursementForm((prev) => ({
                        ...prev,
                        transfer_fee_description: event.target.value,
                      }))
                    }
                  />
                </label>
                {createDisbursementPreviewRate ? (
                  <p style={{ margin: 0, color: 'var(--muted)' }}>
                    Implied FX from amounts: {createDisbursementPreviewRate.toFixed(6)} {loanCurrency}/
                    {createDisbursementSourceCurrency}
                  </p>
                ) : null}
                <p style={{ margin: 0, color: 'var(--muted)' }}>
                  Ledger preview: OUT {formatMinor(createTotalSourceDebitMinor, createDisbursementSourceCurrency)} from{' '}
                  {selectedDisbursementAccount?.name || 'source account'} (includes fee), IN{' '}
                  {formatMinor(asNumber(loanForm.principal_minor), loanCurrency)} to loan receivable account.
                </p>
              </div>
            ) : null}
          </div>
        </div>
        <p>
          Cross-currency loans require source amount + FX rate on disbursement. Transfer fee is company expense and
          is not added to employee principal.
        </p>
        <button className="primary-button" type="submit">
          {createAndDisburse ? 'Create Loan + Disburse' : 'Create Loan'}
        </button>
      </form>

      <form className="card" onSubmit={submitRepayment}>
        <h3>Manual Repayment</h3>
        <div className="form-grid">
          <label>
            Loan
            <select
              value={repaymentForm.loan_id}
              onChange={(event) => setRepaymentForm((prev) => ({ ...prev, loan_id: Number(event.target.value) }))}
            >
              <option value={0}>Select Loan</option>
              {loans
                .filter((loan) => loan.status === 'ACTIVE')
                .map((loan) => (
                  <option key={loan.id} value={loan.id}>
                    #{loan.id} - {loan.full_name || `Employee ${loan.employee_id}`}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Repayment Date
            <input
              type="date"
              value={repaymentForm.repayment_date}
              onChange={(event) =>
                setRepaymentForm((prev) => ({ ...prev, repayment_date: event.target.value }))
              }
            />
          </label>
          <label>
            Cash Account
            <select
              value={repaymentForm.cash_account_id}
              onChange={(event) =>
                setRepaymentForm((prev) => ({ ...prev, cash_account_id: Number(event.target.value) }))
              }
            >
              {cashAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.currency})
                </option>
              ))}
            </select>
          </label>
          <label>
            Amount (minor)
            <input
              type="number"
              min={1}
              value={repaymentForm.amount_minor}
              onChange={(event) =>
                setRepaymentForm((prev) => ({ ...prev, amount_minor: Number(event.target.value || 0) }))
              }
              required
            />
          </label>
        </div>
        <button className="primary-button" type="submit" disabled={!repaymentForm.loan_id}>
          Post Repayment
        </button>
      </form>

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Loan</th>
              <th>Employee</th>
              <th>Status</th>
              <th>Principal</th>
              <th>Outstanding</th>
              <th>Installment</th>
              <th>Disbursement Account</th>
              <th>Disbursement Setup</th>
              <th>Disbursed</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((loan) => {
              const disbursement = loanDisbursements[loan.id] || makeInitialDisbursementForm(loan);
              const sourceCurrency = loan.disbursement_account_currency || loan.currency;
              const isCrossCurrency = sourceCurrency !== loan.currency;
              const disbursementAction = getLoanDisbursementAction(loan);
              const canDisburse = disbursementAction.canDisburse;
              const rowDisabled = !canDisburse;

              return (
                <tr key={loan.id}>
                  <td>#{loan.id}</td>
                  <td>{loan.full_name || loan.employee_id}</td>
                  <td>{loan.status}</td>
                  <td>{formatMinor(loan.principal_minor, loan.currency)}</td>
                  <td>
                    {formatMinor(loan.outstanding_principal_minor + loan.outstanding_interest_minor, loan.currency)}
                  </td>
                  <td>{formatMinor(loan.installment_minor, loan.currency)}</td>
                  <td>
                    {loan.disbursement_account_name || '-'} ({sourceCurrency})
                    <br />
                    Receivable: {loan.receivable_control_account_name || '-'} ({loan.currency})
                  </td>
                  <td style={{ minWidth: 320 }}>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <input
                        type="date"
                        value={disbursement.disbursement_date}
                        onChange={(event) =>
                          setDisbursementInput(loan.id, { disbursement_date: event.target.value })
                        }
                        disabled={rowDisabled}
                      />
                      {isCrossCurrency ? (
                        <>
                          <input
                            type="number"
                            min={1}
                            placeholder={`Source amount (${sourceCurrency} minor)`}
                            value={disbursement.from_amount_minor}
                            onChange={(event) =>
                              setDisbursementInput(loan.id, { from_amount_minor: event.target.value })
                            }
                            disabled={rowDisabled}
                          />
                          <input
                            type="number"
                            min={0}
                            step="0.000001"
                            placeholder="FX rate"
                            value={disbursement.fx_rate}
                            onChange={(event) =>
                              setDisbursementInput(loan.id, { fx_rate: event.target.value })
                            }
                            disabled={rowDisabled}
                          />
                        </>
                      ) : (
                        <span>Same currency disbursement</span>
                      )}
                      <input
                        type="number"
                        min={0}
                        placeholder={`Transfer fee (${sourceCurrency} minor)`}
                        value={disbursement.transfer_fee_amount_minor}
                        onChange={(event) =>
                          setDisbursementInput(loan.id, { transfer_fee_amount_minor: event.target.value })
                        }
                        disabled={rowDisabled}
                      />
                      <input
                        placeholder="Fee note (optional)"
                        value={disbursement.transfer_fee_description}
                        onChange={(event) =>
                          setDisbursementInput(loan.id, { transfer_fee_description: event.target.value })
                        }
                        disabled={rowDisabled}
                      />
                    </div>
                  </td>
                  <td>{loan.disbursement_date || '-'}</td>
                  <td>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => disburse(loan)}
                      disabled={!canDisburse}
                      title={disbursementAction.hint || undefined}
                    >
                      {disbursementAction.label}
                    </button>
                    {disbursementAction.hint ? (
                      <small style={{ display: 'block', marginTop: 6, color: 'var(--muted)' }}>
                        {disbursementAction.hint}
                      </small>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
