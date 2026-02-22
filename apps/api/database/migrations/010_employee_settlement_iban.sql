ALTER TABLE finance_employees
  ADD COLUMN IF NOT EXISTS settlement_iban TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'finance_employees'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'finance_employees'::regclass
      AND conname = 'finance_employees_settlement_iban_len_chk'
  ) THEN
    ALTER TABLE finance_employees
      ADD CONSTRAINT finance_employees_settlement_iban_len_chk
      CHECK (settlement_iban IS NULL OR char_length(BTRIM(settlement_iban)) BETWEEN 5 AND 64);
  END IF;
END $$;
