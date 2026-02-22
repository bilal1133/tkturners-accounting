ALTER TABLE finance_accounts
  ADD COLUMN IF NOT EXISTS account_kind TEXT NOT NULL DEFAULT 'CASH';

ALTER TABLE finance_accounts
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE finance_accounts
  DROP CONSTRAINT IF EXISTS finance_accounts_account_kind_check;

ALTER TABLE finance_accounts
  ADD CONSTRAINT finance_accounts_account_kind_check
  CHECK (account_kind IN ('CASH', 'LOAN_RECEIVABLE_CONTROL'));

ALTER TABLE finance_counterparties
  DROP CONSTRAINT IF EXISTS finance_counterparties_kind_check;

ALTER TABLE finance_counterparties
  ADD CONSTRAINT finance_counterparties_kind_check
  CHECK (kind IN ('CLIENT', 'VENDOR', 'BOTH', 'UNKNOWN', 'EMPLOYEE'));
