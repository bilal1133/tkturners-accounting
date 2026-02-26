'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

import { useAuth } from '@/lib/auth';
import { apiRequest, buildIdempotencyKey } from '@/lib/api';
import { formatMinor, lastFridayOfMonth, todayDate, todayMonth } from '@/lib/format';
import { validateWithSchema } from '@/lib/validation';
import type { Account, Employee, EmployeeLoan } from '@/lib/types';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import styles from './page.module.css';

type LoanForm = {
  employee_id: number;
  currency: string;
  principal_minor: number;
  annual_interest_bps: number;
  installment_minor: number;
  disbursement_account_id: number;
  receivable_control_account_id: number | null;
  first_due_month: string;
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

type EditLoanForm = {
  id: number;
  installment_minor: number;
  annual_interest_bps: number;
  next_due_date: string;
  status: EmployeeLoan['status'];
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
  first_due_month: todayMonth(),
};

const initialRepaymentForm: RepaymentForm = {
  loan_id: 0,
  repayment_date: todayDate(),
  amount_minor: 0,
  cash_account_id: 0,
};

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.');
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be in YYYY-MM format.');

const createLoanSchema = z.object({
  employee_id: z.number().int().positive('Employee is required.'),
  currency: z.string().trim().length(3),
  principal_minor: z.number().int().positive('Principal must be greater than 0.'),
  annual_interest_bps: z.number().int().nonnegative('Interest cannot be negative.'),
  installment_minor: z.number().int().positive('Installment must be greater than 0.'),
  disbursement_account_id: z.number().int().positive('Disbursement account is required.'),
  first_due_month: monthSchema,
});

const repaymentSchema = z.object({
  loan_id: z.number().int().positive('Select a loan first.'),
  repayment_date: dateSchema,
  amount_minor: z.number().int().positive('Repayment amount must be greater than 0.'),
  cash_account_id: z.number().int().positive('Cash account is required.'),
});

const disbursementSchema = z.object({
  disbursement_date: dateSchema,
  from_amount_minor: z.string().trim(),
  fx_rate: z.string().trim(),
  transfer_fee_amount_minor: z.string().trim(),
  transfer_fee_description: z.string().max(500, 'Fee note cannot exceed 500 characters.'),
});

const editLoanSchema = z.object({
  id: z.number().int().positive(),
  installment_minor: z.number().int().positive('Installment must be greater than 0.'),
  annual_interest_bps: z.number().int().nonnegative('Interest cannot be negative.'),
  next_due_date: dateSchema,
  status: z.enum(['DRAFT', 'APPROVED', 'ACTIVE', 'CLOSED', 'CANCELED']),
});

function makeInitialDisbursementForm(loan?: EmployeeLoan): LoanDisbursementForm {
  const sameCurrency =
    loan && loan.disbursement_account_currency && loan.disbursement_account_currency === loan.currency;
  return {
    disbursement_date: initialLoanDisbursementForm.disbursement_date,
    from_amount_minor: sameCurrency ? minorToMajorInput(loan.principal_minor) : '',
    fx_rate: '',
    transfer_fee_amount_minor: '',
    transfer_fee_description: '',
  };
}

function minorToMajorInput(amountMinor: number | null | undefined): string {
  const numeric = Number(amountMinor || 0);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return '';
  }

  const major = numeric / 100;
  return Number.isInteger(major) ? String(major) : major.toFixed(2);
}

function majorInputToMinor(rawValue: string): number {
  const normalized = String(rawValue || '').replace(/,/g, '').trim();
  if (!normalized) {
    return 0;
  }

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.round(numeric * 100);
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
  const [repaymentAmountTouched, setRepaymentAmountTouched] = useState(false);
  const [loanDisbursements, setLoanDisbursements] = useState<Record<number, LoanDisbursementForm>>({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRepaymentModalOpen, setIsRepaymentModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<EditLoanForm | null>(null);
  const [savingLoanEdit, setSavingLoanEdit] = useState(false);
  const [deletingLoanId, setDeletingLoanId] = useState<number | null>(null);
  const [activeDisbursementLoanId, setActiveDisbursementLoanId] = useState<number | null>(null);
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

  const selectedRepaymentLoan = loans.find((loan) => loan.id === Number(repaymentForm.loan_id));
  const selectedRepaymentAccount = cashAccounts.find((account) => account.id === Number(repaymentForm.cash_account_id));
  const repaymentOutstandingMinor = selectedRepaymentLoan
    ? Number(selectedRepaymentLoan.outstanding_principal_minor || 0) + Number(selectedRepaymentLoan.outstanding_interest_minor || 0)
    : 0;
  const repaymentSuggestedMinor = selectedRepaymentLoan
    ? Math.min(
        repaymentOutstandingMinor,
        Number(selectedRepaymentLoan.installment_minor || repaymentOutstandingMinor || 0)
      )
    : 0;
  const repaymentAmountMinor = Number(repaymentForm.amount_minor || 0);
  const repaymentRemainingMinor = Math.max(repaymentOutstandingMinor - repaymentAmountMinor, 0);
  const repaymentAccountCurrencyMismatch =
    Boolean(selectedRepaymentLoan) &&
    Boolean(selectedRepaymentAccount) &&
    selectedRepaymentAccount?.currency !== selectedRepaymentLoan?.currency;

  useEffect(() => {
    if (!selectedRepaymentLoan) {
      return;
    }

    const preferredCashAccount =
      cashAccounts.find((account) => account.currency === selectedRepaymentLoan.currency)
      || cashAccounts.find((account) => account.account_kind !== 'LOAN_RECEIVABLE_CONTROL')
      || null;

    setRepaymentForm((previous) => {
      let changed = false;
      const next: RepaymentForm = { ...previous };

      if (preferredCashAccount && Number(previous.cash_account_id) !== Number(preferredCashAccount.id)) {
        next.cash_account_id = Number(preferredCashAccount.id);
        changed = true;
      }

      if (!repaymentAmountTouched) {
        const suggestedAmount = Math.max(0, Number(repaymentSuggestedMinor || 0));
        if (Number(previous.amount_minor) !== suggestedAmount) {
          next.amount_minor = suggestedAmount;
          changed = true;
        }
      } else {
        const clampedAmount = Math.max(0, Math.min(Number(previous.amount_minor || 0), repaymentOutstandingMinor));
        if (Number(previous.amount_minor) !== clampedAmount) {
          next.amount_minor = clampedAmount;
          changed = true;
        }
      }

      return changed ? next : previous;
    });
  }, [
    selectedRepaymentLoan?.id,
    selectedRepaymentLoan?.currency,
    repaymentSuggestedMinor,
    repaymentOutstandingMinor,
    repaymentAmountTouched,
    cashAccounts,
  ]);

  const openCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setCreateAndDisburse(false);
    setCreateDisbursementForm(initialLoanDisbursementForm);
  };

  const openRepaymentModal = () => {
    setIsRepaymentModalOpen(true);
  };

  const closeRepaymentModal = () => {
    setIsRepaymentModalOpen(false);
  };

  const openLoanEditModal = (loan: EmployeeLoan) => {
    setEditingLoan({
      id: loan.id,
      installment_minor: Number(loan.installment_minor || 0),
      annual_interest_bps: Number(loan.annual_interest_bps || 0),
      next_due_date: loan.next_due_date || todayDate(),
      status: loan.status,
    });
  };

  const closeLoanEditModal = () => {
    setEditingLoan(null);
  };

  const openDisbursementModal = (loan: EmployeeLoan) => {
    setActiveDisbursementLoanId(loan.id);
    setLoanDisbursements((previous) => ({
      ...previous,
      [loan.id]: previous[loan.id] || makeInitialDisbursementForm(loan),
    }));
  };

  const closeDisbursementModal = () => {
    setActiveDisbursementLoanId(null);
  };

  const submitLoan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    const parsedLoan = validateWithSchema(createLoanSchema, {
      employee_id: Number(loanForm.employee_id),
      currency: (selectedEmployee?.payroll_currency || loanForm.currency || 'USD').toUpperCase(),
      principal_minor: Number(loanForm.principal_minor || 0),
      annual_interest_bps: Number(loanForm.annual_interest_bps || 0),
      installment_minor: Number(loanForm.installment_minor || 0),
      disbursement_account_id: Number(loanForm.disbursement_account_id),
      first_due_month: loanForm.first_due_month || todayMonth(),
    });

    if (!parsedLoan.success) {
      setError(parsedLoan.message);
      return;
    }

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
          first_due_date: lastFridayOfMonth(loanForm.first_due_month || todayMonth()) || undefined,
        },
      });
      createdLoanId = createdLoan.id;

      if (createAndDisburse) {
        const transferFeeAmount = createDisbursementForm.transfer_fee_amount_minor.trim();
        const sourceAmountMinor =
          createDisbursementIsCrossCurrency && createDisbursementForm.from_amount_minor.trim()
            ? majorInputToMinor(createDisbursementForm.from_amount_minor)
            : undefined;
        const fxRate =
          createDisbursementIsCrossCurrency && createDisbursementForm.fx_rate.trim()
            ? Number(createDisbursementForm.fx_rate)
            : undefined;

        await apiRequest(`/finance/loans/${createdLoan.id}/disburse`, {
          token,
          method: 'POST',
          headers: {
            'Idempotency-Key': buildIdempotencyKey(`loan-disburse-${createdLoan.id}`),
          },
          body: {
            disbursement_date: createDisbursementForm.disbursement_date || undefined,
            from_amount_minor: sourceAmountMinor,
            fx_rate: fxRate,
            transfer_fee_amount_minor: transferFeeAmount ? majorInputToMinor(transferFeeAmount) : undefined,
            transfer_fee_currency: transferFeeAmount ? createDisbursementSourceCurrency : undefined,
            transfer_fee_description: createDisbursementForm.transfer_fee_description.trim() || undefined,
          },
        });
      }

      await load();
      closeCreateModal();
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
    const parsedDisbursement = validateWithSchema(disbursementSchema, {
      disbursement_date: disbursementConfig.disbursement_date || todayDate(),
      from_amount_minor: disbursementConfig.from_amount_minor || '',
      fx_rate: disbursementConfig.fx_rate || '',
      transfer_fee_amount_minor: disbursementConfig.transfer_fee_amount_minor || '',
      transfer_fee_description: disbursementConfig.transfer_fee_description || '',
    });

    if (!parsedDisbursement.success) {
      setError(parsedDisbursement.message);
      return;
    }

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
        headers: {
          'Idempotency-Key': buildIdempotencyKey(`loan-disburse-${loan.id}`),
        },
        body: {
          disbursement_date: disbursementConfig.disbursement_date || undefined,
          from_amount_minor: disbursementConfig.from_amount_minor.trim()
            ? majorInputToMinor(disbursementConfig.from_amount_minor)
            : undefined,
          fx_rate: disbursementConfig.fx_rate.trim() ? Number(disbursementConfig.fx_rate) : undefined,
          transfer_fee_amount_minor: disbursementConfig.transfer_fee_amount_minor.trim()
            ? majorInputToMinor(disbursementConfig.transfer_fee_amount_minor)
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

  const submitLoanEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !editingLoan) return;

    const parsed = validateWithSchema(editLoanSchema, {
      id: Number(editingLoan.id),
      installment_minor: Number(editingLoan.installment_minor || 0),
      annual_interest_bps: Number(editingLoan.annual_interest_bps || 0),
      next_due_date: editingLoan.next_due_date || todayDate(),
      status: editingLoan.status,
    });

    if (!parsed.success) {
      setError(parsed.message);
      return;
    }

    try {
      setSavingLoanEdit(true);
      await apiRequest(`/finance/loans/${editingLoan.id}`, {
        token,
        method: 'PATCH',
        body: {
          installment_minor: parsed.data.installment_minor,
          annual_interest_bps: parsed.data.annual_interest_bps,
          next_due_date: parsed.data.next_due_date,
          status: parsed.data.status,
        },
      });
      await load();
      closeLoanEditModal();
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update loan');
    } finally {
      setSavingLoanEdit(false);
    }
  };

  const removeLoan = async (loan: EmployeeLoan) => {
    if (!token) return;
    const confirmed = window.confirm(
      `Delete loan #${loan.id}? Loans with linked history will be kept but marked as CANCELED.`
    );
    if (!confirmed) return;

    try {
      setDeletingLoanId(loan.id);
      await apiRequest(`/finance/loans/${loan.id}`, {
        token,
        method: 'DELETE',
      });
      await load();
      setError(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete loan');
    } finally {
      setDeletingLoanId(null);
    }
  };

  const submitRepayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    const parsedRepayment = validateWithSchema(repaymentSchema, {
      loan_id: Number(repaymentForm.loan_id),
      repayment_date: repaymentForm.repayment_date || todayDate(),
      amount_minor: Number(repaymentForm.amount_minor || 0),
      cash_account_id: Number(repaymentForm.cash_account_id),
    });

    if (!parsedRepayment.success) {
      setError(parsedRepayment.message);
      return;
    }

    try {
      await apiRequest(`/finance/loans/${parsedRepayment.data.loan_id}/repay`, {
        token,
        method: 'POST',
        headers: {
          'Idempotency-Key': buildIdempotencyKey(`loan-repay-${parsedRepayment.data.loan_id}`),
        },
        body: {
          repayment_date: parsedRepayment.data.repayment_date,
          amount_minor: parsedRepayment.data.amount_minor,
          cash_account_id: parsedRepayment.data.cash_account_id,
        },
      });
      setRepaymentAmountTouched(false);
      await load();
      closeRepaymentModal();
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
    majorInputToMinor(createDisbursementForm.from_amount_minor) > 0
      ? Number(loanForm.principal_minor) / majorInputToMinor(createDisbursementForm.from_amount_minor)
      : null;
  const createSourceAmountMinor = createDisbursementIsCrossCurrency
    ? majorInputToMinor(createDisbursementForm.from_amount_minor)
    : asNumber(loanForm.principal_minor);
  const createTransferFeeMinor = majorInputToMinor(createDisbursementForm.transfer_fee_amount_minor);
  const createTotalSourceDebitMinor = createSourceAmountMinor + createTransferFeeMinor;
  const activeDisbursementLoan = loans.find((loan) => loan.id === Number(activeDisbursementLoanId)) || null;
  const activeDisbursementForm = activeDisbursementLoan
    ? loanDisbursements[activeDisbursementLoan.id] || makeInitialDisbursementForm(activeDisbursementLoan)
    : initialLoanDisbursementForm;
  const activeDisbursementSourceCurrency =
    activeDisbursementLoan?.disbursement_account_currency || activeDisbursementLoan?.currency || 'USD';
  const activeDisbursementIsCrossCurrency = activeDisbursementLoan
    ? activeDisbursementSourceCurrency !== activeDisbursementLoan.currency
    : false;
  const activeDisbursementAction = activeDisbursementLoan
    ? getLoanDisbursementAction(activeDisbursementLoan)
    : null;
  const activeDisbursementSourceMinor = activeDisbursementIsCrossCurrency
    ? majorInputToMinor(activeDisbursementForm.from_amount_minor)
    : Number(activeDisbursementLoan?.principal_minor || 0);
  const activeDisbursementFeeMinor = majorInputToMinor(activeDisbursementForm.transfer_fee_amount_minor);
  const activeDisbursementTotalDebitMinor = activeDisbursementSourceMinor + activeDisbursementFeeMinor;
  const activeDisbursementMissingCrossFields = Boolean(
    activeDisbursementLoan
      && activeDisbursementIsCrossCurrency
      && (!activeDisbursementForm.from_amount_minor.trim() || !activeDisbursementForm.fx_rate.trim())
  );

  return (
    <section className="page">
      <PageHeader
        badge="LOAN SUBLEDGER"
        title="Employee Loans"
        subtitle="Manage disbursements, FX, fees, and repayments with linked ledger events."
        actions={
          <>
            <button className="ghost-button" type="button" onClick={openRepaymentModal}>
              Manual Repayment
            </button>
            <button className="primary-button" type="button" onClick={openCreateModal}>
              Create Loan
            </button>
          </>
        }
      />

      {error ? <p className="error-text">{error}</p> : null}

      <Modal open={isCreateModalOpen} onClose={closeCreateModal} title="Create Loan" size="lg">
        <form className="page" onSubmit={submitLoan}>
          <div className="form-grid">
            <FormField label="Employee">
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
            </FormField>

            <FormField label="Currency">
              <input value={selectedEmployee?.payroll_currency || loanForm.currency} disabled />
            </FormField>

            <FormField label="Disbursement Account">
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
            </FormField>

            <FormField label={`Principal (${loanCurrency})`}>
              <input
                type="number"
                min={0}
                step="0.01"
                value={minorToMajorInput(loanForm.principal_minor)}
                onChange={(event) =>
                  setLoanForm((prev) => ({
                    ...prev,
                    principal_minor: majorInputToMinor(event.target.value),
                  }))
                }
                placeholder="0.00"
                required
              />
            </FormField>

            <FormField label={`Installment (${loanCurrency})`}>
              <input
                type="number"
                min={0}
                step="0.01"
                value={minorToMajorInput(loanForm.installment_minor)}
                onChange={(event) =>
                  setLoanForm((prev) => ({
                    ...prev,
                    installment_minor: majorInputToMinor(event.target.value),
                  }))
                }
                placeholder="0.00"
                required
              />
            </FormField>

            <FormField label="Annual Interest (bps)">
              <input
                type="number"
                min={0}
                value={loanForm.annual_interest_bps || ''}
                onChange={(event) =>
                  setLoanForm((prev) => ({ ...prev, annual_interest_bps: Number(event.target.value || 0) }))
                }
                placeholder="0"
              />
            </FormField>

            <FormField label="First Due Month">
              <input
                type="month"
                value={loanForm.first_due_month}
                onChange={(event) => setLoanForm((prev) => ({ ...prev, first_due_month: event.target.value }))}
              />
            </FormField>

            <div className={styles.disbursementPanel}>
              <label className={styles.disbursementToggle}>
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
                          ? minorToMajorInput(loanForm.principal_minor)
                          : prev.from_amount_minor,
                      fx_rate: !createDisbursementIsCrossCurrency ? '' : prev.fx_rate,
                    }));
                  }}
                />
                Disburse immediately after loan creation
              </label>
              <p className={styles.mutedNote}>
                Conversion path: {createDisbursementSourceCurrency} funding account {'->'} {loanCurrency} loan
                receivable account.
              </p>
              {createAndDisburse ? (
                <div className="form-grid">
                  <FormField label="Disbursement Date">
                    <input
                      type="date"
                      value={createDisbursementForm.disbursement_date}
                      onChange={(event) =>
                        setCreateDisbursementForm((prev) => ({ ...prev, disbursement_date: event.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label={`Source Amount Debited (${createDisbursementSourceCurrency})`}>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={createDisbursementForm.from_amount_minor}
                      placeholder={
                        !createDisbursementIsCrossCurrency && Number(loanForm.principal_minor) > 0
                          ? minorToMajorInput(loanForm.principal_minor)
                          : ''
                      }
                      onChange={(event) =>
                        setCreateDisbursementForm((prev) => ({ ...prev, from_amount_minor: event.target.value }))
                      }
                    />
                  </FormField>
                  {createDisbursementIsCrossCurrency ? (
                    <FormField label={`Conversion Rate (${createDisbursementSourceCurrency} -> ${loanCurrency})`}>
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
                    </FormField>
                  ) : (
                    <FormField label="FX Rate">
                      <input value="1 (same currency)" disabled />
                    </FormField>
                  )}
                  <FormField label={`Transaction Fee (${createDisbursementSourceCurrency}, deducted from source)`}>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={createDisbursementForm.transfer_fee_amount_minor}
                      onChange={(event) =>
                        setCreateDisbursementForm((prev) => ({
                          ...prev,
                          transfer_fee_amount_minor: event.target.value,
                        }))
                      }
                    />
                  </FormField>
                  <FormField label="Fee Description (optional)">
                    <input
                      value={createDisbursementForm.transfer_fee_description}
                      onChange={(event) =>
                        setCreateDisbursementForm((prev) => ({
                          ...prev,
                          transfer_fee_description: event.target.value,
                        }))
                      }
                    />
                  </FormField>
                  {createDisbursementPreviewRate ? (
                    <p className={styles.mutedNote}>
                      Implied FX from amounts: {createDisbursementPreviewRate.toFixed(6)} {loanCurrency}/
                      {createDisbursementSourceCurrency}
                    </p>
                  ) : null}
                  <p className={styles.mutedNote}>
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
          <FormActions>
            <button className="primary-button" type="submit">
              {createAndDisburse ? 'Create Loan + Disburse' : 'Create Loan'}
            </button>
            <button className="ghost-button" type="button" onClick={closeCreateModal}>
              Cancel
            </button>
          </FormActions>
        </form>
      </Modal>

      <Modal open={isRepaymentModalOpen} onClose={closeRepaymentModal} title="Manual Repayment" size="lg">
        <form className="page" onSubmit={submitRepayment}>
          <div className="form-grid">
            <FormField label="Loan">
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
            </FormField>

            <FormField label="Repayment Date">
              <input
                type="date"
                value={repaymentForm.repayment_date}
                onChange={(event) => setRepaymentForm((prev) => ({ ...prev, repayment_date: event.target.value }))}
              />
            </FormField>

            <FormField label="Cash Account">
              <select
                value={repaymentForm.cash_account_id}
                onChange={(event) => setRepaymentForm((prev) => ({ ...prev, cash_account_id: Number(event.target.value) }))}
              >
                {cashAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label={`Amount (${selectedRepaymentLoan?.currency || selectedRepaymentAccount?.currency || 'Currency'})`}>
              <input
                type="number"
                min={0}
                step="0.01"
                value={minorToMajorInput(repaymentForm.amount_minor)}
                onChange={(event) => {
                  const enteredMinor = majorInputToMinor(event.target.value);
                  const cappedAmount = selectedRepaymentLoan
                    ? Math.max(0, Math.min(enteredMinor, repaymentOutstandingMinor))
                    : Math.max(0, enteredMinor);
                  setRepaymentAmountTouched(true);
                  setRepaymentForm((prev) => ({ ...prev, amount_minor: cappedAmount }));
                }}
                placeholder="0.00"
                required
              />
            </FormField>
          </div>
          {selectedRepaymentLoan ? (
            <div className={styles.repaymentMeta}>
              <small className="muted-text">
                Outstanding: {formatMinor(repaymentOutstandingMinor, selectedRepaymentLoan.currency)} | Suggested now:{' '}
                {formatMinor(repaymentSuggestedMinor, selectedRepaymentLoan.currency)} | Remaining after this payment:{' '}
                {formatMinor(repaymentRemainingMinor, selectedRepaymentLoan.currency)}
              </small>
              {repaymentAccountCurrencyMismatch ? (
                <small className="error-text">
                  Selected cash account currency ({selectedRepaymentAccount?.currency}) must match loan currency (
                  {selectedRepaymentLoan.currency}).
                </small>
              ) : null}
              <div className={styles.actionRow}>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setRepaymentAmountTouched(false);
                    setRepaymentForm((prev) => ({ ...prev, amount_minor: repaymentSuggestedMinor }));
                  }}
                >
                  Use Suggested Amount
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setRepaymentAmountTouched(true);
                    setRepaymentForm((prev) => ({ ...prev, amount_minor: repaymentOutstandingMinor }));
                  }}
                >
                  Pay Full Outstanding
                </button>
              </div>
            </div>
          ) : (
            <small className="muted-text">
              Select an active loan to auto-fill repayment amount and show remaining balance.
            </small>
          )}
          <FormActions>
            <button
              className="primary-button"
              type="submit"
              disabled={
                !repaymentForm.loan_id
                || Number(repaymentForm.amount_minor || 0) <= 0
                || repaymentAccountCurrencyMismatch
              }
            >
              Post Repayment
            </button>
            <button className="ghost-button" type="button" onClick={closeRepaymentModal}>
              Cancel
            </button>
          </FormActions>
        </form>
      </Modal>

      <Modal
        open={Boolean(activeDisbursementLoan)}
        onClose={closeDisbursementModal}
        title={
          activeDisbursementLoan
            ? `Disbursement Setup - Loan #${activeDisbursementLoan.id}`
            : 'Disbursement Setup'
        }
        size="md"
      >
        {activeDisbursementLoan ? (
          <div className="page">
            <div className="form-grid">
              <FormField label="Disbursement Date">
                <input
                  type="date"
                  value={activeDisbursementForm.disbursement_date}
                  onChange={(event) =>
                    setDisbursementInput(activeDisbursementLoan.id, { disbursement_date: event.target.value })
                  }
                  disabled={!activeDisbursementAction?.canDisburse}
                />
              </FormField>

              {activeDisbursementIsCrossCurrency ? (
                <>
                  <FormField label={`Source Amount (${activeDisbursementSourceCurrency})`}>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={activeDisbursementForm.from_amount_minor}
                      onChange={(event) =>
                        setDisbursementInput(activeDisbursementLoan.id, { from_amount_minor: event.target.value })
                      }
                      disabled={!activeDisbursementAction?.canDisburse}
                    />
                  </FormField>
                  <FormField label={`FX Rate (${activeDisbursementSourceCurrency} -> ${activeDisbursementLoan.currency})`}>
                    <input
                      type="number"
                      min={0}
                      step="0.000001"
                      value={activeDisbursementForm.fx_rate}
                      onChange={(event) =>
                        setDisbursementInput(activeDisbursementLoan.id, { fx_rate: event.target.value })
                      }
                      disabled={!activeDisbursementAction?.canDisburse}
                    />
                  </FormField>
                </>
              ) : (
                <FormField label="FX Rate">
                  <input value="1 (same currency)" disabled />
                </FormField>
              )}

              <FormField label={`Transfer Fee (${activeDisbursementSourceCurrency})`}>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={activeDisbursementForm.transfer_fee_amount_minor}
                  onChange={(event) =>
                    setDisbursementInput(activeDisbursementLoan.id, { transfer_fee_amount_minor: event.target.value })
                  }
                  disabled={!activeDisbursementAction?.canDisburse}
                />
              </FormField>

              <FormField label="Fee Note (optional)">
                <input
                  value={activeDisbursementForm.transfer_fee_description}
                  onChange={(event) =>
                    setDisbursementInput(activeDisbursementLoan.id, { transfer_fee_description: event.target.value })
                  }
                  disabled={!activeDisbursementAction?.canDisburse}
                />
              </FormField>
            </div>

            <small className="muted-text">
              Ledger preview: OUT {formatMinor(activeDisbursementTotalDebitMinor, activeDisbursementSourceCurrency)} from{' '}
              {activeDisbursementLoan.disbursement_account_name || 'source account'} (includes fee), IN{' '}
              {formatMinor(activeDisbursementLoan.principal_minor, activeDisbursementLoan.currency)} to{' '}
              {activeDisbursementLoan.receivable_control_account_name || 'loan receivable account'}.
            </small>
            {activeDisbursementMissingCrossFields ? (
              <small className="error-text">Cross-currency disbursement requires source amount and FX rate.</small>
            ) : null}

            {activeDisbursementAction?.hint ? <small className="muted-text">{activeDisbursementAction.hint}</small> : null}

            <FormActions>
              <button
                className="primary-button"
                type="button"
                onClick={() => disburse(activeDisbursementLoan)}
                disabled={!activeDisbursementAction?.canDisburse || activeDisbursementMissingCrossFields}
              >
                {activeDisbursementAction?.label || 'Disburse'}
              </button>
              <button className="ghost-button" type="button" onClick={closeDisbursementModal}>
                Close
              </button>
            </FormActions>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(editingLoan)}
        onClose={closeLoanEditModal}
        title={editingLoan ? `Edit Loan #${editingLoan.id}` : 'Edit Loan'}
        size="md"
      >
        {editingLoan ? (
          <form className="page" onSubmit={submitLoanEdit}>
            <div className="form-grid">
              <FormField label="Installment (minor)">
                <input
                  type="number"
                  min={1}
                  value={editingLoan.installment_minor}
                  onChange={(event) =>
                    setEditingLoan((previous) =>
                      previous
                        ? {
                            ...previous,
                            installment_minor: Number(event.target.value || 0),
                          }
                        : previous
                    )
                  }
                />
              </FormField>
              <FormField label="Annual Interest (bps)">
                <input
                  type="number"
                  min={0}
                  value={editingLoan.annual_interest_bps}
                  onChange={(event) =>
                    setEditingLoan((previous) =>
                      previous
                        ? {
                            ...previous,
                            annual_interest_bps: Number(event.target.value || 0),
                          }
                        : previous
                    )
                  }
                />
              </FormField>
              <FormField label="Next Due Date">
                <input
                  type="date"
                  value={editingLoan.next_due_date}
                  onChange={(event) =>
                    setEditingLoan((previous) =>
                      previous
                        ? {
                            ...previous,
                            next_due_date: event.target.value,
                          }
                        : previous
                    )
                  }
                />
              </FormField>
              <FormField label="Status">
                <select
                  value={editingLoan.status}
                  onChange={(event) =>
                    setEditingLoan((previous) =>
                      previous
                        ? {
                            ...previous,
                            status: event.target.value as EmployeeLoan['status'],
                          }
                        : previous
                    )
                  }
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="CLOSED">CLOSED</option>
                  <option value="CANCELED">CANCELED</option>
                </select>
              </FormField>
            </div>
            <FormActions>
              <button className="primary-button" type="submit" disabled={savingLoanEdit}>
                {savingLoanEdit ? 'Saving...' : 'Save Loan'}
              </button>
              <button className="ghost-button" type="button" onClick={closeLoanEditModal} disabled={savingLoanEdit}>
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
                  <td>
                    <div className={styles.setupStack}>
                      <small className="muted-text">Date: {disbursement.disbursement_date || '-'}</small>
                      <small className="muted-text">
                        Source: {disbursement.from_amount_minor || '-'} {sourceCurrency}
                      </small>
                      <small className="muted-text">
                        FX: {isCrossCurrency ? disbursement.fx_rate || '-' : '1 (same currency)'}
                      </small>
                      <small className="muted-text">
                        Fee: {disbursement.transfer_fee_amount_minor || '-'} {sourceCurrency}
                      </small>
                    </div>
                  </td>
                  <td>{loan.disbursement_date || '-'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="ghost-button" type="button" onClick={() => openLoanEditModal(loan)}>
                        Edit
                      </button>
                      <button className="ghost-button" type="button" onClick={() => openDisbursementModal(loan)}>
                        Configure
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => disburse(loan)}
                        disabled={!canDisburse}
                        title={disbursementAction.hint || undefined}
                      >
                        {disbursementAction.label}
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => removeLoan(loan)}
                        disabled={deletingLoanId === loan.id}
                      >
                        {deletingLoanId === loan.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                    {disbursementAction.hint ? (
                      <small className={styles.hintBlock}>
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
