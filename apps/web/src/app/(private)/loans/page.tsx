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
    disbursement_date: todayDate(),
    from_amount_minor: sameCurrency ? String(loan.principal_minor) : '',
    fx_rate: '',
    transfer_fee_amount_minor: '',
    transfer_fee_description: '',
  };
}

export default function LoansPage() {
  const { token } = useAuth();
  const [loans, setLoans] = useState<EmployeeLoan[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loanForm, setLoanForm] = useState<LoanForm>(initialLoanForm);
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

    setLoans(loanPayload);
    setEmployees(employeePayload);
    setAccounts(accountPayload);
    setLoanDisbursements((previous) => {
      const next: Record<number, LoanDisbursementForm> = { ...previous };
      for (const loan of loanPayload) {
        if (!next[loan.id]) {
          next[loan.id] = makeInitialDisbursementForm(loan);
        }
      }
      return next;
    });

    if (!loanForm.employee_id && employeePayload.length > 0) {
      const activeEmployee = employeePayload.find((employee) => employee.status === 'ACTIVE') || employeePayload[0];
      const payoutAccount = accountPayload.find((account) => account.id === activeEmployee.default_payout_account_id);

      setLoanForm((prev) => ({
        ...prev,
        employee_id: activeEmployee.id,
        currency: activeEmployee.payroll_currency,
        disbursement_account_id: payoutAccount?.id || accountPayload[0]?.id || 0,
      }));
    }

    if (!repaymentForm.cash_account_id && accountPayload.length > 0) {
      const firstCash = accountPayload.find((account) => account.account_kind !== 'LOAN_RECEIVABLE_CONTROL');
      setRepaymentForm((prev) => ({
        ...prev,
        cash_account_id: firstCash?.id || accountPayload[0].id,
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

    try {
      await apiRequest('/finance/loans', {
        token,
        method: 'POST',
        body: {
          ...loanForm,
          receivable_control_account_id: loanForm.receivable_control_account_id || undefined,
          first_due_date: loanForm.first_due_date || undefined,
        },
      });
      await load();
      setError(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create loan');
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
        </div>
        <p>
          If disbursement account currency differs from loan currency, provide source amount + FX rate during
          disbursement. Transfer fee is company expense and is not added to employee principal.
        </p>
        <button className="primary-button" type="submit">
          Create Loan
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
              const canDisburse = loan.status === 'APPROVED' || loan.status === 'DRAFT';
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
                    >
                      Disburse
                    </button>
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
