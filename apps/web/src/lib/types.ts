export type MeResponse = {
  user: { id: number; email: string; username: string };
  membership: { workspace_id: number; role: 'ADMIN' | 'ACCOUNTANT' | 'VIEWER' };
  workspace: {
    id: number;
    name: string;
    base_currency: string;
    timezone: string;
    web_entry_default_status: 'APPROVED' | 'PENDING';
    allow_self_approval: boolean;
  };
};

export type Account = {
  id: number;
  name: string;
  currency: string;
  owner_user_id: number | null;
  opening_balance_minor: number;
  current_balance_minor: number;
  notes: string | null;
  is_active: boolean;
  account_kind?: 'CASH' | 'LOAN_RECEIVABLE_CONTROL';
  is_system?: boolean;
};

export type AccountBalanceSnapshot = {
  id: number;
  name: string;
  currency: string;
  opening_balance_minor: number;
  ledger_delta_minor: number;
  current_balance_minor: number;
};

export type Category = {
  id: number;
  name: string;
  type: 'INCOME' | 'EXPENSE' | 'BOTH';
  is_system: boolean;
};

export type Counterparty = {
  id: number;
  name: string;
  kind: 'CLIENT' | 'VENDOR' | 'BOTH' | 'UNKNOWN' | 'EMPLOYEE';
};

export type Department = {
  id: number;
  workspace_id: number;
  name: string;
  code: string | null;
  notes: string | null;
  is_active: boolean;
};

export type Employee = {
  id: number;
  workspace_id: number;
  employee_code: string;
  full_name: string;
  email: string | null;
  join_date: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  payroll_currency: string;
  settlement_iban: string | null;
  default_payout_account_id: number;
  default_funding_account_id: number | null;
  department_id: number | null;
  department_name?: string | null;
  department_code?: string | null;
  payout_account_name?: string;
  funding_account_name?: string | null;
  linked_counterparty_id: number;
  counterparty_name?: string;
  base_salary_minor: number;
  default_allowances_minor: number;
  default_non_loan_deductions_minor: number;
  notes: string | null;
  active_loan_count?: number;
};

export type EmployeeLoan = {
  id: number;
  workspace_id: number;
  employee_id: number;
  employee_code?: string;
  full_name?: string;
  currency: string;
  principal_minor: number;
  annual_interest_bps: number;
  installment_minor: number;
  disbursement_date: string | null;
  next_due_date: string | null;
  outstanding_principal_minor: number;
  outstanding_interest_minor: number;
  status: 'DRAFT' | 'APPROVED' | 'ACTIVE' | 'CLOSED' | 'CANCELED';
  disbursement_account_id: number;
  disbursement_account_name?: string;
  disbursement_account_currency?: string;
  receivable_control_account_id: number;
  receivable_control_account_name?: string;
  receivable_control_account_currency?: string;
  disbursement_transaction_id: number | null;
};

export type PayrollComponent = {
  id: number;
  payroll_entry_id: number;
  component_type: 'EARNING' | 'DEDUCTION' | 'INFO';
  component_code: string;
  label: string;
  amount_minor: number;
  is_system: boolean;
  sort_order: number;
};

export type PayrollEntry = {
  id: number;
  workspace_id: number;
  payroll_run_id: number;
  employee_id: number;
  employee_code?: string;
  full_name?: string;
  department_id?: number | null;
  department_name?: string | null;
  department_code?: string | null;
  payout_account_name?: string;
  funding_account_name?: string | null;
  default_payout_account_id?: number;
  default_funding_account_id?: number | null;
  loan_status?: string | null;
  loan_id: number | null;
  currency: string;
  base_salary_minor: number;
  allowances_minor: number;
  non_loan_deductions_minor: number;
  planned_loan_deduction_minor: number;
  auto_loan_deduction_minor?: number;
  actual_loan_deduction_minor: number;
  net_paid_minor: number;
  status: 'DRAFT' | 'APPROVED' | 'PAID';
  salary_expense_transaction_id: number | null;
  payout_from_account_id?: number | null;
  payout_to_account_id?: number | null;
  payout_from_account_name?: string | null;
  payout_to_account_name?: string | null;
  payout_from_amount_minor?: number | null;
  payout_from_currency?: string | null;
  payout_to_amount_minor?: number | null;
  payout_to_currency?: string | null;
  payout_fx_rate?: number | null;
  payout_transfer_transaction_id?: number | null;
  payout_transfer_fee_transaction_id?: number | null;
  payout_additional_fee_total_minor?: number;
  payout_additional_fee_count?: number;
  loan_principal_repayment_transaction_id: number | null;
  loan_interest_income_transaction_id: number | null;
  components?: PayrollComponent[];
};

export type PayrollRun = {
  id: number;
  workspace_id: number;
  period_month: string;
  cutoff_date: string | null;
  payday_date: string;
  status: 'DRAFT' | 'APPROVED' | 'PAID';
  approved_by_user_id: number | null;
  approved_at: string | null;
  paid_at: string | null;
  selected_employee_ids?: number[];
  selected_employees_count?: number;
  entries_count?: number;
  total_net_paid_minor?: number;
  total_loan_deduction_minor?: number;
  entries?: PayrollEntry[];
};

export type FinanceTransaction = {
  id: number;
  transaction_date: string;
  category_id?: number | null;
  counterparty_id?: number | null;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  source: 'WEB' | 'SLACK' | 'SYSTEM';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  description: string;
  category_name: string | null;
  counterparty_name: string | null;
  amount_minor: number;
  currency: string;
  fx_rate_to_base?: number | null;
  from_account_name?: string;
  to_account_name?: string;
};

export type Subscription = {
  id: number;
  vendor_counterparty_id?: number;
  amount_minor: number;
  currency: string;
  account_id?: number;
  category_id?: number;
  next_run_date: string;
  is_active: boolean;
  frequency: 'MONTHLY' | 'ANNUAL' | 'CUSTOM';
  interval_count: number;
  description: string | null;
  vendor_name: string;
  account_name: string;
  category_name: string;
};
