DO $$
DECLARE
  pk_name TEXT;
  pk_on_id BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'finance_currencies'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_currencies' AND column_name = 'id'
    ) THEN
      ALTER TABLE finance_currencies ADD COLUMN id BIGSERIAL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'finance_currencies'::regclass
        AND contype = 'u'
        AND conname = 'finance_currencies_code_key'
    ) THEN
      ALTER TABLE finance_currencies ADD CONSTRAINT finance_currencies_code_key UNIQUE (code);
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'finance_accounts'::regclass
        AND conname = 'finance_accounts_currency_fkey'
    ) THEN
      ALTER TABLE finance_accounts DROP CONSTRAINT finance_accounts_currency_fkey;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'finance_subscriptions'::regclass
        AND conname = 'finance_subscriptions_currency_fkey'
    ) THEN
      ALTER TABLE finance_subscriptions DROP CONSTRAINT finance_subscriptions_currency_fkey;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'finance_transaction_lines'::regclass
        AND conname = 'finance_transaction_lines_currency_fkey'
    ) THEN
      ALTER TABLE finance_transaction_lines DROP CONSTRAINT finance_transaction_lines_currency_fkey;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'finance_transactions'::regclass
        AND conname = 'finance_transactions_currency_fkey'
    ) THEN
      ALTER TABLE finance_transactions DROP CONSTRAINT finance_transactions_currency_fkey;
    END IF;

    SELECT c.conname
      INTO pk_name
    FROM pg_constraint c
    WHERE c.conrelid = 'finance_currencies'::regclass
      AND c.contype = 'p'
    LIMIT 1;

    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid
       AND a.attnum = c.conkey[1]
      WHERE c.conrelid = 'finance_currencies'::regclass
        AND c.contype = 'p'
        AND array_length(c.conkey, 1) = 1
        AND a.attname = 'id'
    ) INTO pk_on_id;

    IF pk_name IS NOT NULL AND NOT pk_on_id THEN
      EXECUTE format('ALTER TABLE finance_currencies DROP CONSTRAINT %I', pk_name);
      ALTER TABLE finance_currencies ADD CONSTRAINT finance_currencies_pkey PRIMARY KEY (id);
    ELSIF pk_name IS NULL THEN
      ALTER TABLE finance_currencies ADD CONSTRAINT finance_currencies_pkey PRIMARY KEY (id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'finance_accounts'::regclass
        AND conname = 'finance_accounts_currency_fkey'
    ) THEN
      ALTER TABLE finance_accounts
        ADD CONSTRAINT finance_accounts_currency_fkey
        FOREIGN KEY (currency) REFERENCES finance_currencies(code);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'finance_subscriptions'::regclass
        AND conname = 'finance_subscriptions_currency_fkey'
    ) THEN
      ALTER TABLE finance_subscriptions
        ADD CONSTRAINT finance_subscriptions_currency_fkey
        FOREIGN KEY (currency) REFERENCES finance_currencies(code);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'finance_transaction_lines'::regclass
        AND conname = 'finance_transaction_lines_currency_fkey'
    ) THEN
      ALTER TABLE finance_transaction_lines
        ADD CONSTRAINT finance_transaction_lines_currency_fkey
        FOREIGN KEY (currency) REFERENCES finance_currencies(code);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'finance_transactions'::regclass
        AND conname = 'finance_transactions_currency_fkey'
    ) THEN
      ALTER TABLE finance_transactions
        ADD CONSTRAINT finance_transactions_currency_fkey
        FOREIGN KEY (currency) REFERENCES finance_currencies(code);
    END IF;
  END IF;
END
$$;
