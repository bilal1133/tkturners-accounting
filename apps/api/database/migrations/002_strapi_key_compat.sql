DO $$
DECLARE
  pk_name TEXT;
  pk_on_id BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'finance_transaction_tags'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_transaction_tags' AND column_name = 'id'
    ) THEN
      ALTER TABLE finance_transaction_tags ADD COLUMN id BIGSERIAL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'finance_transaction_tags'::regclass
        AND contype = 'u'
        AND conname = 'finance_transaction_tags_transaction_id_tag_id_key'
    ) THEN
      ALTER TABLE finance_transaction_tags
        ADD CONSTRAINT finance_transaction_tags_transaction_id_tag_id_key UNIQUE (transaction_id, tag_id);
    END IF;

    SELECT c.conname
      INTO pk_name
    FROM pg_constraint c
    WHERE c.conrelid = 'finance_transaction_tags'::regclass
      AND c.contype = 'p'
    LIMIT 1;

    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid
       AND a.attnum = c.conkey[1]
      WHERE c.conrelid = 'finance_transaction_tags'::regclass
        AND c.contype = 'p'
        AND array_length(c.conkey, 1) = 1
        AND a.attname = 'id'
    ) INTO pk_on_id;

    IF pk_name IS NOT NULL AND NOT pk_on_id THEN
      EXECUTE format('ALTER TABLE finance_transaction_tags DROP CONSTRAINT %I', pk_name);
      ALTER TABLE finance_transaction_tags ADD CONSTRAINT finance_transaction_tags_pkey PRIMARY KEY (id);
    ELSIF pk_name IS NULL THEN
      ALTER TABLE finance_transaction_tags ADD CONSTRAINT finance_transaction_tags_pkey PRIMARY KEY (id);
    END IF;
  END IF;
END
$$;

DO $$
DECLARE
  pk_name TEXT;
  pk_on_id BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'finance_slack_drafts'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_slack_drafts' AND column_name = 'id' AND data_type = 'text'
    )
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_slack_drafts' AND column_name = 'draft_token'
    ) THEN
      ALTER TABLE finance_slack_drafts RENAME COLUMN id TO draft_token;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_slack_drafts' AND column_name = 'id'
    ) THEN
      ALTER TABLE finance_slack_drafts ADD COLUMN id BIGSERIAL;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_slack_drafts' AND column_name = 'draft_token'
    ) THEN
      UPDATE finance_slack_drafts SET draft_token = id::text WHERE draft_token IS NULL;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'finance_slack_drafts'::regclass
          AND contype = 'u'
          AND conname = 'finance_slack_drafts_draft_token_key'
      ) THEN
        ALTER TABLE finance_slack_drafts ADD CONSTRAINT finance_slack_drafts_draft_token_key UNIQUE (draft_token);
      END IF;

      ALTER TABLE finance_slack_drafts ALTER COLUMN draft_token SET NOT NULL;
    END IF;

    SELECT c.conname
      INTO pk_name
    FROM pg_constraint c
    WHERE c.conrelid = 'finance_slack_drafts'::regclass
      AND c.contype = 'p'
    LIMIT 1;

    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid
       AND a.attnum = c.conkey[1]
      WHERE c.conrelid = 'finance_slack_drafts'::regclass
        AND c.contype = 'p'
        AND array_length(c.conkey, 1) = 1
        AND a.attname = 'id'
    ) INTO pk_on_id;

    IF pk_name IS NOT NULL AND NOT pk_on_id THEN
      EXECUTE format('ALTER TABLE finance_slack_drafts DROP CONSTRAINT %I', pk_name);
      ALTER TABLE finance_slack_drafts ADD CONSTRAINT finance_slack_drafts_pkey PRIMARY KEY (id);
    ELSIF pk_name IS NULL THEN
      ALTER TABLE finance_slack_drafts ADD CONSTRAINT finance_slack_drafts_pkey PRIMARY KEY (id);
    END IF;
  END IF;
END
$$;
