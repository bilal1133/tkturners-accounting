CREATE TABLE IF NOT EXISTS finance_schema_migrations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_workspaces (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  base_currency CHAR(3) NOT NULL DEFAULT 'USD',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  web_entry_default_status TEXT NOT NULL DEFAULT 'APPROVED',
  allow_self_approval BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (web_entry_default_status IN ('PENDING', 'APPROVED'))
);

CREATE TABLE IF NOT EXISTS finance_workspace_members (
  id BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT NOT NULL REFERENCES finance_workspaces(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, user_id),
  CHECK (role IN ('ADMIN', 'ACCOUNTANT', 'VIEWER'))
);

CREATE TABLE IF NOT EXISTS finance_currencies (
  code CHAR(3) PRIMARY KEY,
  name TEXT NOT NULL,
  decimals INT NOT NULL DEFAULT 2,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_accounts (
  id BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT NOT NULL REFERENCES finance_workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  owner_user_id BIGINT,
  currency CHAR(3) NOT NULL REFERENCES finance_currencies(code),
  opening_balance_minor BIGINT NOT NULL DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS finance_categories (
  id BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT NOT NULL REFERENCES finance_workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'EXPENSE',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, name),
  CHECK (type IN ('INCOME', 'EXPENSE', 'BOTH'))
);

CREATE TABLE IF NOT EXISTS finance_counterparties (
  id BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT NOT NULL REFERENCES finance_workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'UNKNOWN',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, name),
  CHECK (kind IN ('CLIENT', 'VENDOR', 'BOTH', 'UNKNOWN'))
);

CREATE TABLE IF NOT EXISTS finance_transactions (
  id BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT NOT NULL REFERENCES finance_workspaces(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  description TEXT NOT NULL,
  category_id BIGINT REFERENCES finance_categories(id) ON DELETE SET NULL,
  counterparty_id BIGINT REFERENCES finance_counterparties(id) ON DELETE SET NULL,
  created_by_user_id BIGINT NOT NULL,
  approved_by_user_id BIGINT,
  approved_at TIMESTAMPTZ,
  currency CHAR(3) NOT NULL REFERENCES finance_currencies(code),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  fx_rate_to_base NUMERIC(18,8),
  base_amount_minor BIGINT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (type IN ('INCOME', 'EXPENSE', 'TRANSFER')),
  CHECK (source IN ('WEB', 'SLACK', 'SYSTEM')),
  CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE TABLE IF NOT EXISTS finance_transaction_lines (
  id BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL REFERENCES finance_transactions(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES finance_accounts(id) ON DELETE RESTRICT,
  direction TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL REFERENCES finance_currencies(code),
  line_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (direction IN ('IN', 'OUT')),
  CHECK (line_role IN ('PRIMARY', 'COUNTERPART'))
);

CREATE TABLE IF NOT EXISTS finance_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT NOT NULL REFERENCES finance_workspaces(id) ON DELETE CASCADE,
  vendor_counterparty_id BIGINT NOT NULL REFERENCES finance_counterparties(id) ON DELETE RESTRICT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL REFERENCES finance_currencies(code),
  account_id BIGINT NOT NULL REFERENCES finance_accounts(id) ON DELETE RESTRICT,
  category_id BIGINT NOT NULL REFERENCES finance_categories(id) ON DELETE RESTRICT,
  frequency TEXT NOT NULL,
  interval_count INT NOT NULL DEFAULT 1,
  next_run_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  created_by_user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (frequency IN ('MONTHLY', 'ANNUAL', 'CUSTOM')),
  CHECK (interval_count > 0)
);

CREATE TABLE IF NOT EXISTS finance_subscription_runs (
  id BIGSERIAL PRIMARY KEY,
  subscription_id BIGINT NOT NULL REFERENCES finance_subscriptions(id) ON DELETE CASCADE,
  run_date DATE NOT NULL,
  generated_transaction_id BIGINT REFERENCES finance_transactions(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  initiated_by_user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subscription_id, run_date),
  CHECK (status IN ('GENERATED', 'SKIPPED', 'FAILED'))
);

CREATE TABLE IF NOT EXISTS finance_approval_records (
  id BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT NOT NULL REFERENCES finance_workspaces(id) ON DELETE CASCADE,
  transaction_id BIGINT NOT NULL REFERENCES finance_transactions(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_user_id BIGINT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (action IN ('APPROVE', 'REJECT'))
);

CREATE TABLE IF NOT EXISTS finance_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT NOT NULL REFERENCES finance_workspaces(id) ON DELETE CASCADE,
  actor_user_id BIGINT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_json JSONB,
  after_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_slack_drafts (
  id TEXT PRIMARY KEY,
  workspace_id BIGINT NOT NULL REFERENCES finance_workspaces(id) ON DELETE CASCADE,
  slack_team_id TEXT,
  slack_channel_id TEXT,
  slack_user_id TEXT,
  raw_text TEXT NOT NULL,
  parsed_payload_json JSONB NOT NULL,
  confidence NUMERIC(5,2) NOT NULL DEFAULT 0,
  missing_fields_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  state TEXT NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ NOT NULL,
  created_transaction_id BIGINT REFERENCES finance_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (state IN ('PENDING', 'CONFIRMED', 'CANCELED', 'EXPIRED'))
);

CREATE TABLE IF NOT EXISTS finance_tags (
  id BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT NOT NULL REFERENCES finance_workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS finance_transaction_tags (
  transaction_id BIGINT NOT NULL REFERENCES finance_transactions(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES finance_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (transaction_id, tag_id)
);

CREATE TABLE IF NOT EXISTS finance_notes (
  id BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT NOT NULL REFERENCES finance_workspaces(id) ON DELETE CASCADE,
  transaction_id BIGINT NOT NULL REFERENCES finance_transactions(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_by_user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_attachments (
  id BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT NOT NULL REFERENCES finance_workspaces(id) ON DELETE CASCADE,
  transaction_id BIGINT NOT NULL REFERENCES finance_transactions(id) ON DELETE CASCADE,
  file_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_transactions_workspace_date
  ON finance_transactions (workspace_id, transaction_date);

CREATE INDEX IF NOT EXISTS idx_finance_transactions_workspace_status_source
  ON finance_transactions (workspace_id, status, source);

CREATE INDEX IF NOT EXISTS idx_finance_lines_account
  ON finance_transaction_lines (account_id);

CREATE INDEX IF NOT EXISTS idx_finance_audit_workspace_created
  ON finance_audit_logs (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_finance_drafts_workspace_state
  ON finance_slack_drafts (workspace_id, state);
