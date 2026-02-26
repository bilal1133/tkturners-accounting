CREATE TABLE IF NOT EXISTS finance_payroll_run_employees (
  payroll_run_id BIGINT NOT NULL REFERENCES finance_payroll_runs(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES finance_employees(id) ON DELETE RESTRICT,
  workspace_id BIGINT NOT NULL REFERENCES finance_workspaces(id) ON DELETE CASCADE,
  created_by_user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (payroll_run_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_payroll_run_employees_workspace_run
  ON finance_payroll_run_employees (workspace_id, payroll_run_id);

CREATE INDEX IF NOT EXISTS idx_finance_payroll_run_employees_workspace_employee
  ON finance_payroll_run_employees (workspace_id, employee_id);
