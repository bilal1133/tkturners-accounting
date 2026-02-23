const {
  AccountInputSchema,
  CategoryInputSchema,
  CounterpartyInputSchema,
  CreateTransactionInputSchema,
  SubscriptionInputSchema,
} = require('@tkturners/shared-types');

const { assert, HttpError } = require('./errors');
const { knex, getUncategorizedCategoryId } = require('./db');
const { addAuditLog, addApprovalRecord } = require('./audit');
const { addSubscriptionInterval, monthRange } = require('./utils');

function parseSchema(schema, payload, message) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new HttpError(400, message, parsed.error.flatten());
  }

  return parsed.data;
}

function normalizeNumericField(rawValue, { nullable = false } = {}) {
  if (rawValue === undefined) {
    return undefined;
  }

  if (nullable && (rawValue === null || String(rawValue).trim() === '')) {
    return null;
  }

  if (!nullable && rawValue === null) {
    return null;
  }

  if (typeof rawValue === 'number') {
    return Number.isFinite(rawValue) ? rawValue : rawValue;
  }

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return nullable ? null : rawValue;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : rawValue;
  }

  return rawValue;
}

function normalizeOptionalDateInput(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  const value = String(rawValue).trim();
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const dmy = value.match(/^(\d{1,2})[/.\\-](\d{1,2})[/.\\-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const ymd = value.match(/^(\d{4})[/.\\-](\d{1,2})[/.\\-](\d{1,2})$/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

function normalizeSubscriptionPayload(payload = {}) {
  const normalized = { ...(payload || {}) };
  normalized.vendor_counterparty_id = normalizeNumericField(normalized.vendor_counterparty_id);
  normalized.amount_minor = normalizeNumericField(normalized.amount_minor);
  normalized.account_id = normalizeNumericField(normalized.account_id);
  normalized.category_id = normalizeNumericField(normalized.category_id);
  normalized.interval_count = normalizeNumericField(normalized.interval_count);

  if (normalized.currency !== undefined && normalized.currency !== null) {
    normalized.currency = String(normalized.currency).trim().toUpperCase();
  }

  if (normalized.next_run_date !== undefined) {
    const normalizedDate = normalizeOptionalDateInput(normalized.next_run_date);
    normalized.next_run_date = normalizedDate || normalized.next_run_date;
  }

  if (normalized.description !== undefined && normalized.description !== null) {
    const trimmed = String(normalized.description).trim();
    normalized.description = trimmed || null;
  }

  return normalized;
}

function computeBaseAmount({ amountMinor, currency, workspaceBaseCurrency, fxRate }) {
  if (currency === workspaceBaseCurrency) {
    return amountMinor;
  }

  if (!fxRate) {
    return null;
  }

  return Math.round(Number(amountMinor) * Number(fxRate));
}

function normalizeMetadata(metadata) {
  if (!metadata) {
    return {};
  }

  if (typeof metadata === 'string') {
    try {
      return JSON.parse(metadata);
    } catch (_error) {
      return {};
    }
  }

  if (typeof metadata === 'object') {
    return metadata;
  }

  return {};
}

async function getWorkspaceSettings(workspaceId) {
  const workspace = await knex()('finance_workspaces').where({ id: workspaceId }).first();
  assert(workspace, 404, 'Workspace not found.');
  return workspace;
}

async function updateWorkspaceSettings(workspaceId, payload) {
  const updates = {};

  if (payload.base_currency) {
    updates.base_currency = String(payload.base_currency).toUpperCase();
  }

  if (payload.timezone) {
    updates.timezone = payload.timezone;
  }

  if (payload.web_entry_default_status) {
    assert(['PENDING', 'APPROVED'].includes(payload.web_entry_default_status), 400, 'Invalid web entry default status.');
    updates.web_entry_default_status = payload.web_entry_default_status;
  }

  if (typeof payload.allow_self_approval === 'boolean') {
    updates.allow_self_approval = payload.allow_self_approval;
  }

  assert(Object.keys(updates).length > 0, 400, 'No valid workspace settings provided.');
  updates.updated_at = new Date().toISOString();

  const [workspace] = await knex()('finance_workspaces').where({ id: workspaceId }).update(updates).returning('*');
  return workspace;
}

async function listAccounts(workspaceId) {
  const rows = await knex()
    .select(
      'a.id',
      'a.name',
      'a.currency',
      'a.owner_user_id',
      'a.opening_balance_minor',
      'a.notes',
      'a.is_active',
      'a.account_kind',
      'a.is_system',
      'a.created_at',
      'a.updated_at',
      knex().raw(
        "COALESCE(SUM(CASE WHEN t.status = 'APPROVED' AND l.direction = 'IN' THEN l.amount_minor WHEN t.status = 'APPROVED' AND l.direction = 'OUT' THEN -l.amount_minor ELSE 0 END),0) as ledger_delta_minor"
      )
    )
    .from('finance_accounts as a')
    .leftJoin('finance_transaction_lines as l', 'l.account_id', 'a.id')
    .leftJoin('finance_transactions as t', 't.id', 'l.transaction_id')
    .where('a.workspace_id', workspaceId)
    .groupBy('a.id')
    .orderBy('a.name', 'asc');

  return rows.map((row) => ({
    ...row,
    current_balance_minor: Number(row.opening_balance_minor || 0) + Number(row.ledger_delta_minor || 0),
  }));
}

async function getAccountDetail(workspaceId, accountId) {
  const account = await knex()('finance_accounts').where({ workspace_id: workspaceId, id: accountId }).first();
  assert(account, 404, 'Account not found.');

  const lines = await knex()
    .select(
      'l.id',
      'l.direction',
      'l.amount_minor',
      'l.currency',
      'l.line_role',
      't.id as transaction_id',
      't.transaction_date',
      't.type as transaction_type',
      't.status as transaction_status',
      't.description'
    )
    .from('finance_transaction_lines as l')
    .innerJoin('finance_transactions as t', 't.id', 'l.transaction_id')
    .where('l.account_id', accountId)
    .andWhere('t.workspace_id', workspaceId)
    .orderBy('t.transaction_date', 'asc')
    .orderBy('l.id', 'asc');

  let running = Number(account.opening_balance_minor || 0);
  const withRunning = lines.map((line) => {
    running += line.direction === 'IN' ? Number(line.amount_minor) : -Number(line.amount_minor);
    return {
      ...line,
      running_balance_minor: running,
    };
  });

  return {
    ...account,
    ledger: withRunning,
    current_balance_minor: running,
  };
}

async function createAccount(workspaceId, actorUserId, payload) {
  const input = parseSchema(AccountInputSchema, payload, 'Invalid account payload.');
  const now = new Date().toISOString();

  const [account] = await knex()('finance_accounts')
    .insert({
      workspace_id: workspaceId,
      name: input.name,
      owner_user_id: input.owner_user_id || null,
      currency: input.currency,
      opening_balance_minor: input.opening_balance_minor,
      notes: input.notes || null,
      is_active: typeof input.is_active === 'boolean' ? input.is_active : true,
      account_kind: input.account_kind || 'CASH',
      is_system: typeof input.is_system === 'boolean' ? input.is_system : false,
      created_by_user_id: actorUserId,
      created_at: now,
      updated_at: now,
    })
    .returning('*');

  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'ACCOUNT',
    entityId: account.id,
    action: 'CREATE',
    before: null,
    after: account,
  });

  return account;
}

async function updateAccount(workspaceId, actorUserId, accountId, payload) {
  const input = parseSchema(AccountInputSchema.partial(), payload, 'Invalid account payload.');
  const existing = await knex()('finance_accounts').where({ workspace_id: workspaceId, id: accountId }).first();
  assert(existing, 404, 'Account not found.');

  const updates = {
    ...input,
    updated_at: new Date().toISOString(),
  };

  const [account] = await knex()('finance_accounts')
    .where({ workspace_id: workspaceId, id: accountId })
    .update(updates)
    .returning('*');

  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'ACCOUNT',
    entityId: account.id,
    action: 'UPDATE',
    before: existing,
    after: account,
  });

  return account;
}

async function deleteAccount(workspaceId, actorUserId, accountId) {
  const existing = await knex()('finance_accounts').where({ workspace_id: workspaceId, id: accountId }).first();
  assert(existing, 404, 'Account not found.');

  const line = await knex()('finance_transaction_lines').where({ account_id: accountId }).first();
  if (line) {
    const [account] = await knex()('finance_accounts')
      .where({ workspace_id: workspaceId, id: accountId })
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .returning('*');

    await addAuditLog({
      workspaceId,
      actorUserId,
      entityType: 'ACCOUNT',
      entityId: account.id,
      action: 'SOFT_DELETE',
      before: existing,
      after: account,
    });

    return { deleted: false, soft_deleted: true, account };
  }

  await knex()('finance_accounts').where({ workspace_id: workspaceId, id: accountId }).delete();

  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'ACCOUNT',
    entityId: accountId,
    action: 'DELETE',
    before: existing,
    after: null,
  });

  return { deleted: true, soft_deleted: false };
}

async function listCategories(workspaceId) {
  return knex()('finance_categories').where({ workspace_id: workspaceId }).orderBy('name', 'asc');
}

async function createCategory(workspaceId, actorUserId, payload) {
  const input = parseSchema(CategoryInputSchema, payload, 'Invalid category payload.');
  const now = new Date().toISOString();

  const [category] = await knex()('finance_categories')
    .insert({
      workspace_id: workspaceId,
      name: input.name,
      type: input.type,
      is_system: false,
      created_at: now,
      updated_at: now,
    })
    .returning('*');

  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'CATEGORY',
    entityId: category.id,
    action: 'CREATE',
    before: null,
    after: category,
  });

  return category;
}

async function updateCategory(workspaceId, actorUserId, categoryId, payload) {
  const input = parseSchema(CategoryInputSchema.partial(), payload, 'Invalid category payload.');

  const existing = await knex()('finance_categories').where({ workspace_id: workspaceId, id: categoryId }).first();
  assert(existing, 404, 'Category not found.');
  assert(!existing.is_system, 400, 'System categories cannot be edited.');

  const [category] = await knex()('finance_categories')
    .where({ workspace_id: workspaceId, id: categoryId })
    .update({ ...input, updated_at: new Date().toISOString() })
    .returning('*');

  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'CATEGORY',
    entityId: category.id,
    action: 'UPDATE',
    before: existing,
    after: category,
  });

  return category;
}

async function deleteCategory(workspaceId, actorUserId, categoryId) {
  const existing = await knex()('finance_categories').where({ workspace_id: workspaceId, id: categoryId }).first();
  assert(existing, 404, 'Category not found.');
  assert(!existing.is_system, 400, 'System categories cannot be deleted.');

  await knex()('finance_categories').where({ workspace_id: workspaceId, id: categoryId }).delete();
  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'CATEGORY',
    entityId: categoryId,
    action: 'DELETE',
    before: existing,
    after: null,
  });

  return { deleted: true };
}

async function listCounterparties(workspaceId) {
  return knex()('finance_counterparties').where({ workspace_id: workspaceId }).orderBy('name', 'asc');
}

async function createCounterparty(workspaceId, actorUserId, payload) {
  const input = parseSchema(CounterpartyInputSchema, payload, 'Invalid counterparty payload.');
  const now = new Date().toISOString();

  const [counterparty] = await knex()('finance_counterparties')
    .insert({
      workspace_id: workspaceId,
      name: input.name,
      kind: input.kind,
      notes: input.notes || null,
      created_at: now,
      updated_at: now,
    })
    .returning('*');

  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'COUNTERPARTY',
    entityId: counterparty.id,
    action: 'CREATE',
    before: null,
    after: counterparty,
  });

  return counterparty;
}

async function updateCounterparty(workspaceId, actorUserId, counterpartyId, payload) {
  const input = parseSchema(CounterpartyInputSchema.partial(), payload, 'Invalid counterparty payload.');
  const existing = await knex()('finance_counterparties').where({ workspace_id: workspaceId, id: counterpartyId }).first();
  assert(existing, 404, 'Counterparty not found.');

  const [counterparty] = await knex()('finance_counterparties')
    .where({ workspace_id: workspaceId, id: counterpartyId })
    .update({ ...input, updated_at: new Date().toISOString() })
    .returning('*');

  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'COUNTERPARTY',
    entityId: counterparty.id,
    action: 'UPDATE',
    before: existing,
    after: counterparty,
  });

  return counterparty;
}

async function deleteCounterparty(workspaceId, actorUserId, counterpartyId) {
  const existing = await knex()('finance_counterparties').where({ workspace_id: workspaceId, id: counterpartyId }).first();
  assert(existing, 404, 'Counterparty not found.');

  await knex()('finance_counterparties').where({ workspace_id: workspaceId, id: counterpartyId }).delete();

  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'COUNTERPARTY',
    entityId: counterpartyId,
    action: 'DELETE',
    before: existing,
    after: null,
  });

  return { deleted: true };
}

function resolveTransactionStatus(workspace, source, explicitStatus) {
  if (explicitStatus) {
    return explicitStatus;
  }

  if (source === 'SLACK') {
    return 'PENDING';
  }

  return workspace.web_entry_default_status || 'APPROVED';
}

async function resolveCategory(workspaceId, categoryId) {
  if (!categoryId) {
    return getUncategorizedCategoryId(workspaceId);
  }

  const existing = await knex()('finance_categories').where({ workspace_id: workspaceId, id: categoryId }).first();
  assert(existing, 400, 'Category does not belong to workspace.');
  return existing.id;
}

async function resolveTransferFeeCategory(workspaceId, explicitCategoryId) {
  if (explicitCategoryId) {
    return resolveCategory(workspaceId, explicitCategoryId);
  }

  const transferFees = await knex()('finance_categories')
    .where({ workspace_id: workspaceId })
    .whereRaw('LOWER(name) = LOWER(?)', ['Transfer Fees'])
    .first();

  if (transferFees) {
    return transferFees.id;
  }

  return getUncategorizedCategoryId(workspaceId);
}

async function resolveAccount(workspaceId, accountId) {
  const account = await knex()('finance_accounts')
    .where({ workspace_id: workspaceId, id: accountId, is_active: true })
    .first();
  assert(account, 400, `Account ${accountId} not found or inactive.`);
  return account;
}

async function createTransaction(workspace, actorUserId, payload) {
  const input = parseSchema(CreateTransactionInputSchema, payload, 'Invalid transaction payload.');
  const now = new Date().toISOString();

  const categoryId = await resolveCategory(workspace.id, input.category_id);
  const status = resolveTransactionStatus(workspace, input.source, input.status);
  const counterpartyId = input.counterparty_id || null;

  if (input.type === 'TRANSFER') {
    assert(input.from_account_id !== input.to_account_id, 400, 'Transfer source and destination accounts must differ.');

    const fromAccount = await resolveAccount(workspace.id, input.from_account_id);
    const toAccount = await resolveAccount(workspace.id, input.to_account_id);

    assert(fromAccount.currency === input.from_currency, 400, 'from_currency must match source account currency.');
    assert(toAccount.currency === input.to_currency, 400, 'to_currency must match destination account currency.');

    if (input.from_currency === input.to_currency) {
      assert(
        Number(input.from_amount_minor) === Number(input.to_amount_minor),
        400,
        'Same-currency transfers require equal source and destination amounts.'
      );
    } else {
      assert(Boolean(input.fx_rate), 400, 'Cross-currency transfers require fx_rate.');
    }

    const feeAmountMinor = Number(input.fee_amount_minor || 0);
    const feeCurrency = feeAmountMinor > 0 ? (input.fee_currency || input.from_currency) : null;
    const feeCategoryId =
      feeAmountMinor > 0 ? await resolveTransferFeeCategory(workspace.id, input.fee_category_id) : null;

    if (feeAmountMinor > 0) {
      assert(Number.isFinite(feeAmountMinor) && feeAmountMinor > 0, 400, 'Invalid transfer fee amount.');
      assert(feeCurrency === input.from_currency, 400, 'Transfer fee currency must match source account currency.');
    }

    const baseAmount =
      input.from_currency === workspace.base_currency
        ? Number(input.from_amount_minor)
        : input.to_currency === workspace.base_currency
          ? Number(input.to_amount_minor)
          : input.fx_rate
            ? Math.round(Number(input.from_amount_minor) * Number(input.fx_rate))
            : null;

    const metadata = {
      from_account_id: input.from_account_id,
      to_account_id: input.to_account_id,
      to_amount_minor: input.to_amount_minor,
      to_currency: input.to_currency,
      fx_rate: input.fx_rate || null,
      fee_amount_minor: feeAmountMinor || null,
      fee_currency: feeCurrency,
      ...(input.metadata || {}),
    };

    const { transferTransaction, feeTransaction } = await knex().transaction(async (trx) => {
      const [transaction] = await trx('finance_transactions')
        .insert({
          workspace_id: workspace.id,
          transaction_date: input.date,
          type: 'TRANSFER',
          source: input.source,
          status,
          description: input.description,
          category_id: categoryId,
          counterparty_id: counterpartyId,
          created_by_user_id: actorUserId,
          currency: input.from_currency,
          amount_minor: input.from_amount_minor,
          fx_rate_to_base: input.fx_rate || null,
          base_amount_minor: baseAmount,
          metadata_json: metadata,
          approved_by_user_id: status === 'APPROVED' ? actorUserId : null,
          approved_at: status === 'APPROVED' ? now : null,
          created_at: now,
          updated_at: now,
        })
        .returning('*');

      await trx('finance_transaction_lines').insert([
        {
          transaction_id: transaction.id,
          account_id: input.from_account_id,
          direction: 'OUT',
          amount_minor: input.from_amount_minor,
          currency: input.from_currency,
          line_role: 'PRIMARY',
          created_at: now,
        },
        {
          transaction_id: transaction.id,
          account_id: input.to_account_id,
          direction: 'IN',
          amount_minor: input.to_amount_minor,
          currency: input.to_currency,
          line_role: 'COUNTERPART',
          created_at: now,
        },
      ]);

      let feeTx = null;
      if (feeAmountMinor > 0) {
        const feeBaseAmount = computeBaseAmount({
          amountMinor: feeAmountMinor,
          currency: feeCurrency,
          workspaceBaseCurrency: workspace.base_currency,
          fxRate: input.fee_fx_rate_to_base,
        });

        const [createdFee] = await trx('finance_transactions')
          .insert({
            workspace_id: workspace.id,
            transaction_date: input.date,
            type: 'EXPENSE',
            source: input.source,
            status,
            description: input.fee_description || `Transfer fee for: ${input.description}`,
            category_id: feeCategoryId,
            counterparty_id: null,
            created_by_user_id: actorUserId,
            currency: feeCurrency,
            amount_minor: feeAmountMinor,
            fx_rate_to_base: input.fee_fx_rate_to_base || null,
            base_amount_minor: feeBaseAmount,
            metadata_json: {
              related_transfer_id: transaction.id,
              is_transfer_fee: true,
              ...(input.metadata || {}),
            },
            approved_by_user_id: status === 'APPROVED' ? actorUserId : null,
            approved_at: status === 'APPROVED' ? now : null,
            created_at: now,
            updated_at: now,
          })
          .returning('*');

        await trx('finance_transaction_lines').insert({
          transaction_id: createdFee.id,
          account_id: input.from_account_id,
          direction: 'OUT',
          amount_minor: feeAmountMinor,
          currency: feeCurrency,
          line_role: 'PRIMARY',
          created_at: now,
        });

        const transferMetadata = {
          ...normalizeMetadata(transaction.metadata_json),
          fee_transaction_id: createdFee.id,
        };

        const [updatedTransfer] = await trx('finance_transactions')
          .where({ id: transaction.id })
          .update({
            metadata_json: transferMetadata,
            updated_at: now,
          })
          .returning('*');

        feeTx = createdFee;
        return {
          transferTransaction: updatedTransfer,
          feeTransaction: feeTx,
        };
      }

      return {
        transferTransaction: transaction,
        feeTransaction: feeTx,
      };
    });

    await addAuditLog({
      workspaceId: workspace.id,
      actorUserId,
      entityType: 'TRANSACTION',
      entityId: transferTransaction.id,
      action: 'CREATE',
      before: null,
      after: transferTransaction,
    });

    if (feeTransaction) {
      await addAuditLog({
        workspaceId: workspace.id,
        actorUserId,
        entityType: 'TRANSACTION',
        entityId: feeTransaction.id,
        action: 'CREATE',
        before: null,
        after: feeTransaction,
      });
    }

    return transferTransaction;
  }

  const account = await resolveAccount(workspace.id, input.account_id);
  assert(account.currency === input.currency, 400, 'Transaction currency must match account currency.');

  const baseAmount = computeBaseAmount({
    amountMinor: input.amount_minor,
    currency: input.currency,
    workspaceBaseCurrency: workspace.base_currency,
    fxRate: input.fx_rate_to_base,
  });

  const created = await knex().transaction(async (trx) => {
    const [transaction] = await trx('finance_transactions')
      .insert({
        workspace_id: workspace.id,
        transaction_date: input.date,
        type: input.type,
        source: input.source,
        status,
        description: input.description,
        category_id: categoryId,
        counterparty_id: counterpartyId,
        created_by_user_id: actorUserId,
        currency: input.currency,
        amount_minor: input.amount_minor,
        fx_rate_to_base: input.fx_rate_to_base || null,
        base_amount_minor: baseAmount,
        metadata_json: input.metadata || {},
        approved_by_user_id: status === 'APPROVED' ? actorUserId : null,
        approved_at: status === 'APPROVED' ? now : null,
        created_at: now,
        updated_at: now,
      })
      .returning('*');

    await trx('finance_transaction_lines').insert({
      transaction_id: transaction.id,
      account_id: input.account_id,
      direction: input.type === 'INCOME' ? 'IN' : 'OUT',
      amount_minor: input.amount_minor,
      currency: input.currency,
      line_role: 'PRIMARY',
      created_at: now,
    });

    return transaction;
  });

  await addAuditLog({
    workspaceId: workspace.id,
    actorUserId,
    entityType: 'TRANSACTION',
    entityId: created.id,
    action: 'CREATE',
    before: null,
    after: created,
  });

  return created;
}

async function listTransactions(workspaceId, filters = {}) {
  const query = knex()
    .select(
      't.*',
      'c.name as category_name',
      'cp.name as counterparty_name',
      'creator.email as created_by_email',
      'approver.email as approved_by_email',
      knex().raw(
        "COALESCE(MAX(CASE WHEN l.direction = 'IN' THEN a.name END), '') as to_account_name"
      ),
      knex().raw(
        "COALESCE(MAX(CASE WHEN l.direction = 'OUT' THEN a.name END), '') as from_account_name"
      )
    )
    .from('finance_transactions as t')
    .leftJoin('finance_categories as c', 'c.id', 't.category_id')
    .leftJoin('finance_counterparties as cp', 'cp.id', 't.counterparty_id')
    .leftJoin('up_users as creator', 'creator.id', 't.created_by_user_id')
    .leftJoin('up_users as approver', 'approver.id', 't.approved_by_user_id')
    .leftJoin('finance_transaction_lines as l', 'l.transaction_id', 't.id')
    .leftJoin('finance_accounts as a', 'a.id', 'l.account_id')
    .where('t.workspace_id', workspaceId)
    .groupBy('t.id', 'c.name', 'cp.name', 'creator.email', 'approver.email')
    .orderBy('t.transaction_date', 'desc')
    .orderBy('t.id', 'desc');

  if (filters.month) {
    const { start, end } = monthRange(filters.month);
    query.andWhereBetween('t.transaction_date', [start, end]);
  }

  if (filters.account_id) {
    query.andWhere('l.account_id', Number(filters.account_id));
  }

  if (filters.category_id) {
    query.andWhere('t.category_id', Number(filters.category_id));
  }

  if (filters.type) {
    query.andWhere('t.type', filters.type);
  }

  if (filters.counterparty_id) {
    query.andWhere('t.counterparty_id', Number(filters.counterparty_id));
  }

  if (filters.created_by) {
    query.andWhere('t.created_by_user_id', Number(filters.created_by));
  }

  if (filters.status) {
    query.andWhere('t.status', filters.status);
  }

  if (filters.source) {
    query.andWhere('t.source', filters.source);
  }

  if (filters.search) {
    query.andWhere((builder) => {
      builder
        .whereILike('t.description', `%${filters.search}%`)
        .orWhereILike('cp.name', `%${filters.search}%`)
        .orWhereILike('c.name', `%${filters.search}%`);
    });
  }

  if (filters.employee_id) {
    query.andWhereRaw("(t.metadata_json ->> 'employee_id')::bigint = ?", [Number(filters.employee_id)]);
  }

  if (filters.link_type) {
    query.andWhereRaw("LOWER(t.metadata_json ->> 'link_type') = LOWER(?)", [String(filters.link_type)]);
  }

  if (filters.loan_id) {
    query.andWhereRaw("(t.metadata_json ->> 'loan_id')::bigint = ?", [Number(filters.loan_id)]);
  }

  if (filters.payroll_run_id) {
    query.andWhereRaw("(t.metadata_json ->> 'payroll_run_id')::bigint = ?", [Number(filters.payroll_run_id)]);
  }

  return query;
}

async function getTransaction(workspaceId, transactionId) {
  const transaction = await knex()('finance_transactions').where({ workspace_id: workspaceId, id: transactionId }).first();
  assert(transaction, 404, 'Transaction not found.');
  const transactionMetadata = normalizeMetadata(transaction.metadata_json);

  const lines = await knex()
    .select('l.*', 'a.name as account_name')
    .from('finance_transaction_lines as l')
    .innerJoin('finance_accounts as a', 'a.id', 'l.account_id')
    .where('l.transaction_id', transactionId)
    .orderBy('l.id', 'asc');

  const approvals = await knex()('finance_approval_records')
    .where({ workspace_id: workspaceId, transaction_id: transactionId })
    .orderBy('created_at', 'desc');

  const audit = await knex()('finance_audit_logs')
    .where({ workspace_id: workspaceId, entity_type: 'TRANSACTION', entity_id: String(transactionId) })
    .orderBy('created_at', 'desc');

  let relatedFeeTransaction = null;
  const feeTransactionId = transactionMetadata.fee_transaction_id;
  if (transaction.type === 'TRANSFER' && feeTransactionId) {
    relatedFeeTransaction = await knex()('finance_transactions')
      .where({ workspace_id: workspaceId, id: Number(feeTransactionId) })
      .first();
  }

  return {
    ...transaction,
    metadata_json: transactionMetadata,
    lines,
    approvals,
    audit,
    related_fee_transaction: relatedFeeTransaction,
  };
}

async function updateTransaction(workspace, actorUserId, transactionId, payload) {
  const existing = await knex()('finance_transactions').where({ workspace_id: workspace.id, id: transactionId }).first();
  assert(existing, 404, 'Transaction not found.');
  assert(existing.status === 'PENDING', 409, 'Only pending transactions can be updated.');

  const updates = {};
  if (payload.description !== undefined) updates.description = String(payload.description).trim();
  if (payload.date !== undefined) updates.transaction_date = payload.date;
  if (payload.counterparty_id !== undefined) updates.counterparty_id = payload.counterparty_id;
  if (payload.category_id !== undefined) {
    updates.category_id = await resolveCategory(workspace.id, payload.category_id);
  }
  if (payload.fx_rate_to_base !== undefined) {
    updates.fx_rate_to_base = payload.fx_rate_to_base;
    updates.base_amount_minor = computeBaseAmount({
      amountMinor: existing.amount_minor,
      currency: existing.currency,
      workspaceBaseCurrency: workspace.base_currency,
      fxRate: payload.fx_rate_to_base,
    });
  }

  assert(Object.keys(updates).length > 0, 400, 'No valid transaction fields to update.');

  updates.updated_at = new Date().toISOString();

  const [updated] = await knex()('finance_transactions')
    .where({ workspace_id: workspace.id, id: transactionId })
    .update(updates)
    .returning('*');

  await addAuditLog({
    workspaceId: workspace.id,
    actorUserId,
    entityType: 'TRANSACTION',
    entityId: updated.id,
    action: 'UPDATE',
    before: existing,
    after: updated,
  });

  return updated;
}

async function changeTransactionStatus(workspaceId, actorUserId, transactionId, status, comment = null) {
  const existing = await knex()('finance_transactions').where({ workspace_id: workspaceId, id: transactionId }).first();
  assert(existing, 404, 'Transaction not found.');
  assert(existing.status === 'PENDING', 409, 'Only pending transactions can be approved or rejected.');

  const updates = {
    status,
    approved_by_user_id: status === 'APPROVED' ? actorUserId : null,
    approved_at: status === 'APPROVED' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const [updated] = await knex()('finance_transactions')
    .where({ workspace_id: workspaceId, id: transactionId })
    .update(updates)
    .returning('*');

  await addApprovalRecord({
    workspaceId,
    transactionId,
    action: status === 'APPROVED' ? 'APPROVE' : 'REJECT',
    actorUserId,
    comment,
  });

  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'TRANSACTION',
    entityId: transactionId,
    action: status,
    before: existing,
    after: updated,
  });

  const existingMetadata = normalizeMetadata(existing.metadata_json);
  const linkedFeeId = existing.type === 'TRANSFER' ? existingMetadata.fee_transaction_id : null;
  if (linkedFeeId) {
    const feeExisting = await knex()('finance_transactions')
      .where({ workspace_id: workspaceId, id: Number(linkedFeeId) })
      .first();

    if (feeExisting && feeExisting.status === 'PENDING') {
      const [feeUpdated] = await knex()('finance_transactions')
        .where({ workspace_id: workspaceId, id: Number(linkedFeeId) })
        .update(updates)
        .returning('*');

      await addApprovalRecord({
        workspaceId,
        transactionId: feeExisting.id,
        action: status === 'APPROVED' ? 'APPROVE' : 'REJECT',
        actorUserId,
        comment,
      });

      await addAuditLog({
        workspaceId,
        actorUserId,
        entityType: 'TRANSACTION',
        entityId: feeExisting.id,
        action: `${status}_LINKED_FEE`,
        before: feeExisting,
        after: feeUpdated,
      });
    }
  }

  return updated;
}

async function deleteTransaction(workspaceId, actorUserId, transactionId) {
  const existing = await knex()('finance_transactions').where({ workspace_id: workspaceId, id: transactionId }).first();
  assert(existing, 404, 'Transaction not found.');

  const existingMetadata = normalizeMetadata(existing.metadata_json);
  const linkedFeeId = existing.type === 'TRANSFER' ? existingMetadata.fee_transaction_id : null;

  await knex().transaction(async (trx) => {
    await trx('finance_transaction_lines').where({ transaction_id: transactionId }).delete();
    await trx('finance_transactions').where({ workspace_id: workspaceId, id: transactionId }).delete();

    if (linkedFeeId) {
      await trx('finance_transaction_lines').where({ transaction_id: Number(linkedFeeId) }).delete();
      await trx('finance_transactions')
        .where({ workspace_id: workspaceId, id: Number(linkedFeeId) })
        .delete();
    }
  });

  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'TRANSACTION',
    entityId: transactionId,
    action: 'DELETE',
    before: existing,
    after: null,
  });

  if (linkedFeeId) {
    await addAuditLog({
      workspaceId,
      actorUserId,
      entityType: 'TRANSACTION',
      entityId: linkedFeeId,
      action: 'DELETE_LINKED_FEE',
      before: { id: linkedFeeId },
      after: null,
    });
  }

  return { deleted: true };
}

async function listSubscriptions(workspaceId) {
  return knex()
    .select('s.*', 'cp.name as vendor_name', 'a.name as account_name', 'c.name as category_name')
    .from('finance_subscriptions as s')
    .leftJoin('finance_counterparties as cp', 'cp.id', 's.vendor_counterparty_id')
    .leftJoin('finance_accounts as a', 'a.id', 's.account_id')
    .leftJoin('finance_categories as c', 'c.id', 's.category_id')
    .where('s.workspace_id', workspaceId)
    .orderBy('s.next_run_date', 'asc');
}

async function createSubscription(workspaceId, actorUserId, payload) {
  const input = parseSchema(
    SubscriptionInputSchema,
    normalizeSubscriptionPayload(payload),
    'Invalid subscription payload.'
  );
  const now = new Date().toISOString();

  const [subscription] = await knex()('finance_subscriptions')
    .insert({
      workspace_id: workspaceId,
      vendor_counterparty_id: input.vendor_counterparty_id,
      amount_minor: input.amount_minor,
      currency: input.currency,
      account_id: input.account_id,
      category_id: input.category_id,
      frequency: input.frequency,
      interval_count: input.interval_count,
      next_run_date: input.next_run_date,
      is_active: input.is_active,
      description: input.description || null,
      created_by_user_id: actorUserId,
      created_at: now,
      updated_at: now,
    })
    .returning('*');

  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'SUBSCRIPTION',
    entityId: subscription.id,
    action: 'CREATE',
    before: null,
    after: subscription,
  });

  return subscription;
}

async function updateSubscription(workspaceId, actorUserId, subscriptionId, payload) {
  const input = parseSchema(
    SubscriptionInputSchema.partial(),
    normalizeSubscriptionPayload(payload),
    'Invalid subscription payload.'
  );
  const existing = await knex()('finance_subscriptions').where({ workspace_id: workspaceId, id: subscriptionId }).first();
  assert(existing, 404, 'Subscription not found.');

  const [subscription] = await knex()('finance_subscriptions')
    .where({ workspace_id: workspaceId, id: subscriptionId })
    .update({ ...input, updated_at: new Date().toISOString() })
    .returning('*');

  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'SUBSCRIPTION',
    entityId: subscription.id,
    action: 'UPDATE',
    before: existing,
    after: subscription,
  });

  return subscription;
}

async function deleteSubscription(workspaceId, actorUserId, subscriptionId) {
  const existing = await knex()('finance_subscriptions').where({ workspace_id: workspaceId, id: subscriptionId }).first();
  assert(existing, 404, 'Subscription not found.');

  await knex()('finance_subscriptions').where({ workspace_id: workspaceId, id: subscriptionId }).delete();

  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'SUBSCRIPTION',
    entityId: subscriptionId,
    action: 'DELETE',
    before: existing,
    after: null,
  });

  return { deleted: true };
}

async function generateSubscriptionRun(workspace, actorUserId, subscriptionId) {
  const subscription = await knex()('finance_subscriptions').where({ workspace_id: workspace.id, id: subscriptionId }).first();
  assert(subscription, 404, 'Subscription not found.');
  assert(subscription.is_active, 400, 'Subscription is inactive.');

  const existingRun = await knex()('finance_subscription_runs')
    .where({ subscription_id: subscriptionId, run_date: subscription.next_run_date })
    .first();
  assert(!existingRun, 409, 'Subscription run already generated for next_run_date.');

  const created = await createTransaction(workspace, actorUserId, {
    type: 'EXPENSE',
    date: subscription.next_run_date,
    amount_minor: Number(subscription.amount_minor),
    currency: subscription.currency,
    account_id: subscription.account_id,
    description: subscription.description || 'Subscription payment',
    category_id: subscription.category_id,
    counterparty_id: subscription.vendor_counterparty_id,
    source: 'SYSTEM',
    status: workspace.web_entry_default_status,
  });

  const nextRunDate = addSubscriptionInterval(
    subscription.next_run_date,
    subscription.frequency,
    subscription.interval_count
  );

  await knex().transaction(async (trx) => {
    const now = new Date().toISOString();
    await trx('finance_subscription_runs').insert({
      subscription_id: subscriptionId,
      run_date: subscription.next_run_date,
      generated_transaction_id: created.id,
      status: 'GENERATED',
      initiated_by_user_id: actorUserId,
      created_at: now,
    });

    await trx('finance_subscriptions')
      .where({ id: subscriptionId })
      .update({ next_run_date: nextRunDate, updated_at: now });
  });

  return {
    generated_transaction: created,
    next_run_date: nextRunDate,
  };
}

async function runSubscriptionCron(workspaceId, autoGenerate, actorUserId) {
  const today = new Date().toISOString().slice(0, 10);
  const due = await knex()('finance_subscriptions')
    .where({ workspace_id: workspaceId, is_active: true })
    .andWhere('next_run_date', '<=', today)
    .orderBy('next_run_date', 'asc');

  if (!autoGenerate) {
    return {
      checked_at: new Date().toISOString(),
      due_count: due.length,
      generated_count: 0,
    };
  }

  const workspace = await getWorkspaceSettings(workspaceId);
  let generatedCount = 0;

  for (const subscription of due) {
    try {
      await generateSubscriptionRun(workspace, actorUserId, subscription.id);
      generatedCount += 1;
    } catch (error) {
      strapi.log.warn(`Failed subscription cron generation for subscription ${subscription.id}: ${error.message}`);
    }
  }

  return {
    checked_at: new Date().toISOString(),
    due_count: due.length,
    generated_count: generatedCount,
  };
}

module.exports = {
  getWorkspaceSettings,
  updateWorkspaceSettings,
  listAccounts,
  getAccountDetail,
  createAccount,
  updateAccount,
  deleteAccount,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listCounterparties,
  createCounterparty,
  updateCounterparty,
  deleteCounterparty,
  listTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  changeTransactionStatus,
  deleteTransaction,
  listSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  generateSubscriptionRun,
  runSubscriptionCron,
};
