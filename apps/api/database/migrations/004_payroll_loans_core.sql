CREATE TABLE IF NOT EXISTS finance_employees (
  id BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT NOT NULL REFERENCES finance_workspaces(id) ON DELETE CASCADE,
  employee_code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  join_date DATE,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  payroll_currency CHAR(3) NOT NULL REFERENCES finance_currencies(code),
  default_payout_account_id BIGINT NOT NULL REFERENCES finance_accounts(id) ON DELETE RESTRICT,
  linked_counterparty_id BIGINT NOT NULL REFERENCES finance_counterparties(id) ON DELETE RESTRICT,
  base_salary_minor BIGINT NOT NULL DEFAULT 0,
  default_allowances_minor BIGINT NOT NULL DEFAULT 0,
  default_non_loan_deductions_minor BIGINT NOT NULL DEFAULT 0,
  notes TEXT,
  created_by_user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, employee_code),
  CHECK (status IN ('ACTIVE', 'INACTIVE')),
  CHECK (base_salary_minor >= 0),
  CHECK (default_allowances_minor >= 0),
  CHECK (default_non_loan_deductions_minor >= 0)
);

CREATE TABLE IF NOT EXISTS finance_payroll_runs (
  id BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT NOT NULL REFERENCES finance_workspaces(id) ON DELETE CASCADE,
  period_month TEXT NOT NULL,
  cutoff_date DATE,
  payday_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  approved_by_user_id BIGINT,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_by_user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('DRAFT', 'APPROVED', 'PAID')),
  CHECK (period_month ~ '^[0-9]{4}-[0-9]{2}$')
);

CREATE TABLE IF NOT EXISTS finance_payroll_entries (
  id BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT NOT NULL REFERENCES finance_workspaces(id) ON DELETE CASCADE,
  payroll_run_id BIGINT NOT NULL REFERENCES finance_payroll_runs(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES finance_employees(id) ON DELETE RESTRICT,
  loan_id BIGINT,
  currency CHAR(3) NOT NULL REFERENCES finance_currencies(code),
  base_salary_minor BIGINT NOT NULL DEFAULT 0,
  allowances_minor BIGINT NOT NULL DEFAULT 0,
  non_loan_deductions_minor BIGINT NOT NULL DEFAULT 0,
  planned_loan_deduction_minor BIGINT NOT NULL DEFAULT 0,
  actual_loan_deduction_minor BIGINT NOT NULL DEFAULT 0,
  net_paid_minor BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  salary_expense_transaction_id BIGINT REFERENCES finance_transactions(id) ON DELETE SET NULL,
  loan_principal_repayment_transaction_id BIGINT REFERENCES finance_transactions(id) ON DELETE SET NULL,
  loan_interest_income_transaction_id BIGINT REFERENCES finance_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (payroll_run_id, employee_id),
  CHECK (status IN ('DRAFT', 'APPROVED', 'PAID')),
  CHECK (base_salary_minor >= 0),
  CHECK (allowances_minor >= 0),
  CHECK (non_loan_deductions_minor >= 0),
  CHECK (planned_loan_deduction_minor >= 0),
  CHECK (actual_loan_deduction_minor >= 0),
  CHECK (net_paid_minor >= 0)
);

CREATE TABLE IF NOT EXISTS finance_payroll_components (
  id BIGSERIAL PRIMARY KEY,
  payroll_entry_id BIGINT NOT NULL REFERENCES finance_payroll_entries(id) ON DELETE CASCADE,
  component_type TEXT NOT NULL,
  component_code TEXT NOT NULL,
  label TEXT NOT NULL,
  amount_minor BIGINT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (component_type IN ('EARNING', 'DEDUCTION', 'INFO'))
);

CREATE TABLE IF NOT EXISTS finance_employee_loans (
  id BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT NOT NULL REFERENCES finance_workspaces(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES finance_employees(id) ON DELETE RESTRICT,
  currency CHAR(3) NOT NULL REFERENCES finance_currencies(code),
  principal_minor BIGINT NOT NULL,
  annual_interest_bps INT NOT NULL DEFAULT 0,
  installment_minor BIGINT NOT NULL,
  disbursement_date DATE,
  next_due_date DATE,
  outstanding_principal_minor BIGINT NOT NULL,
  outstanding_interest_minor BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'APPROVED',
  disbursement_account_id BIGINT NOT NULL REFERENCES finance_accounts(id) ON DELETE RESTRICT,
  receivable_control_account_id BIGINT NOT NULL REFERENCES finance_accounts(id) ON DELETE RESTRICT,
  disbursement_transaction_id BIGINT REFERENCES finance_transactions(id) ON DELETE SET NULL,
  approved_by_user_id BIGINT,
  approved_at TIMESTAMPTZ,
  created_by_user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (principal_minor > 0),
  CHECK (installment_minor > 0),
  CHECK (annual_interest_bps >= 0),
  CHECK (outstanding_principal_minor >= 0),
  CHECK (outstanding_interest_minor >= 0),
  CHECK (status IN ('DRAFT', 'APPROVED', 'ACTIVE', 'CLOSED', 'CANCELED'))
);

CREATE TABLE IF NOT EXISTS finance_loan_schedules (
  id BIGSERIAL PRIMARY KEY,
  loan_id BIGINT NOT NULL REFERENCES finance_employee_loans(id) ON DELETE CASCADE,
  installment_no INT NOT NULL,
  due_date DATE NOT NULL,
  principal_due_minor BIGINT NOT NULL DEFAULT 0,
  interest_due_minor BIGINT NOT NULL DEFAULT 0,
  principal_paid_minor BIGINT NOT NULL DEFAULT 0,
  interest_paid_minor BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DUE',
  linked_payroll_entry_id BIGINT REFERENCES finance_payroll_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (loan_id, installment_no),
  CHECK (status IN ('DUE', 'PARTIAL', 'PAID')),
  CHECK (principal_due_minor >= 0),
  CHECK (interest_due_minor >= 0),
  CHECK (principal_paid_minor >= 0),
  CHECK (interest_paid_minor >= 0)
);

CREATE TABLE IF NOT EXISTS finance_loan_repayments (
  id BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT NOT NULL REFERENCES finance_workspaces(id) ON DELETE CASCADE,
  loan_id BIGINT NOT NULL REFERENCES finance_employee_loans(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES finance_employees(id) ON DELETE RESTRICT,
  repayment_date DATE NOT NULL,
  source TEXT NOT NULL,
  principal_paid_minor BIGINT NOT NULL DEFAULT 0,
  interest_paid_minor BIGINT NOT NULL DEFAULT 0,
  total_paid_minor BIGINT NOT NULL,
  principal_transfer_transaction_id BIGINT REFERENCES finance_transactions(id) ON DELETE SET NULL,
  interest_income_transaction_id BIGINT REFERENCES finance_transactions(id) ON DELETE SET NULL,
  linked_payroll_entry_id BIGINT REFERENCES finance_payroll_entries(id) ON DELETE SET NULL,
  created_by_user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source IN ('PAYROLL', 'MANUAL')),
  CHECK (principal_paid_minor >= 0),
  CHECK (interest_paid_minor >= 0),
  CHECK (total_paid_minor >= 0)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'finance_payroll_entries'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'finance_payroll_entries'::regclass
      AND conname = 'finance_payroll_entries_loan_id_fkey'
  ) THEN
    ALTER TABLE finance_payroll_entries
      ADD CONSTRAINT finance_payroll_entries_loan_id_fkey
      FOREIGN KEY (loan_id) REFERENCES finance_employee_loans(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_finance_employees_workspace_status
  ON finance_employees (workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_finance_payroll_runs_workspace_period
  ON finance_payroll_runs (workspace_id, period_month);

CREATE INDEX IF NOT EXISTS idx_finance_payroll_entries_employee
  ON finance_payroll_entries (employee_id);

CREATE INDEX IF NOT EXISTS idx_finance_employee_loans_workspace_employee
  ON finance_employee_loans (workspace_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_finance_loan_schedules_due
  ON finance_loan_schedules (loan_id, due_date, status);

CREATE INDEX IF NOT EXISTS idx_finance_loan_repayments_employee_date
  ON finance_loan_repayments (employee_id, repayment_date DESC);
