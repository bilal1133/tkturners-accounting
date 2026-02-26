CREATE TABLE IF NOT EXISTS finance_idempotency_keys (
  id BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT NOT NULL REFERENCES finance_workspaces(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  idempotency_key VARCHAR(120) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS'
    CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED')),
  status_code INTEGER,
  response_json JSONB,
  error_message TEXT,
  created_by_user_id BIGINT REFERENCES up_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_finance_idempotency_workspace_scope_key
  ON finance_idempotency_keys (workspace_id, scope, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_finance_idempotency_workspace_scope_created
  ON finance_idempotency_keys (workspace_id, scope, created_at DESC);
