ALTER TABLE finance_payroll_runs
  DROP CONSTRAINT IF EXISTS finance_payroll_runs_period_month_check;

ALTER TABLE finance_payroll_runs
  ADD CONSTRAINT finance_payroll_runs_period_month_check
  CHECK (period_month ~ '^[0-9]{4}-[0-9]{2}$');
