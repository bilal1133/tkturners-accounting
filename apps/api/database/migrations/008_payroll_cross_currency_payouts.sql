ALTER TABLE finance_employees
  ADD COLUMN IF NOT EXISTS default_funding_account_id BIGINT REFERENCES finance_accounts(id) ON DELETE SET NULL;

UPDATE finance_employees
SET default_funding_account_id = default_payout_account_id
WHERE default_funding_account_id IS NULL;

ALTER TABLE finance_payroll_entries
  ADD COLUMN IF NOT EXISTS payout_from_account_id BIGINT REFERENCES finance_accounts(id) ON DELETE SET NULL;

ALTER TABLE finance_payroll_entries
  ADD COLUMN IF NOT EXISTS payout_to_account_id BIGINT REFERENCES finance_accounts(id) ON DELETE SET NULL;

ALTER TABLE finance_payroll_entries
  ADD COLUMN IF NOT EXISTS payout_from_amount_minor BIGINT;

ALTER TABLE finance_payroll_entries
  ADD COLUMN IF NOT EXISTS payout_from_currency CHAR(3) REFERENCES finance_currencies(code);

ALTER TABLE finance_payroll_entries
  ADD COLUMN IF NOT EXISTS payout_to_amount_minor BIGINT;

ALTER TABLE finance_payroll_entries
  ADD COLUMN IF NOT EXISTS payout_to_currency CHAR(3) REFERENCES finance_currencies(code);

ALTER TABLE finance_payroll_entries
  ADD COLUMN IF NOT EXISTS payout_fx_rate NUMERIC(20, 8);

ALTER TABLE finance_payroll_entries
  ADD COLUMN IF NOT EXISTS payout_transfer_transaction_id BIGINT REFERENCES finance_transactions(id) ON DELETE SET NULL;

ALTER TABLE finance_payroll_entries
  ADD COLUMN IF NOT EXISTS payout_transfer_fee_transaction_id BIGINT REFERENCES finance_transactions(id) ON DELETE SET NULL;

ALTER TABLE finance_payroll_entries
  ADD COLUMN IF NOT EXISTS payout_additional_fee_total_minor BIGINT NOT NULL DEFAULT 0;

ALTER TABLE finance_payroll_entries
  ADD COLUMN IF NOT EXISTS payout_additional_fee_count INT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'finance_payroll_entries'::regclass
      AND conname = 'finance_payroll_entries_payout_additional_fee_total_minor_check'
  ) THEN
    ALTER TABLE finance_payroll_entries
      ADD CONSTRAINT finance_payroll_entries_payout_additional_fee_total_minor_check
      CHECK (payout_additional_fee_total_minor >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'finance_payroll_entries'::regclass
      AND conname = 'finance_payroll_entries_payout_additional_fee_count_check'
  ) THEN
    ALTER TABLE finance_payroll_entries
      ADD CONSTRAINT finance_payroll_entries_payout_additional_fee_count_check
      CHECK (payout_additional_fee_count >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_finance_employees_default_funding_account
  ON finance_employees (default_funding_account_id);

CREATE INDEX IF NOT EXISTS idx_finance_payroll_entries_payout_from_account
  ON finance_payroll_entries (payout_from_account_id);

CREATE INDEX IF NOT EXISTS idx_finance_payroll_entries_payout_to_account
  ON finance_payroll_entries (payout_to_account_id);

CREATE INDEX IF NOT EXISTS idx_finance_payroll_entries_payout_transfer_transaction
  ON finance_payroll_entries (payout_transfer_transaction_id);
