CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_payroll_runs_workspace_period
  ON finance_payroll_runs (workspace_id, period_month);

CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_employee_active_loan
  ON finance_employee_loans (workspace_id, employee_id)
  WHERE status IN ('APPROVED', 'ACTIVE');
