CREATE TABLE IF NOT EXISTS finance_departments (
  id BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT NOT NULL REFERENCES finance_workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, name),
  UNIQUE (workspace_id, code)
);

ALTER TABLE finance_employees
  ADD COLUMN IF NOT EXISTS department_id BIGINT REFERENCES finance_departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finance_departments_workspace_active
  ON finance_departments (workspace_id, is_active, name);

CREATE INDEX IF NOT EXISTS idx_finance_employees_department
  ON finance_employees (department_id);
