const crypto = require('crypto');

const { knex } = require('./db');
const { assert, HttpError } = require('./errors');

function normalizeStoredJson(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return null;
    }
  }

  return null;
}

function stableSerialize(value) {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const pairs = keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`);
    return `{${pairs.join(',')}}`;
  }

  return JSON.stringify(value);
}

function computeRequestHash(payload) {
  return crypto.createHash('sha256').update(stableSerialize(payload)).digest('hex');
}

function getIdempotencyKey(ctx) {
  const raw = ctx.get('Idempotency-Key') || ctx.get('X-Idempotency-Key') || '';
  const key = String(raw || '').trim();
  if (!key) {
    return null;
  }

  assert(key.length <= 120, 400, 'Idempotency-Key must be at most 120 characters.');
  return key;
}

async function loadIdempotencyRow(workspaceId, scope, idempotencyKey) {
  return knex()('finance_idempotency_keys')
    .where({
      workspace_id: workspaceId,
      scope,
      idempotency_key: idempotencyKey,
    })
    .first();
}

function parseCompletedRow(existing, requestHash) {
  if (existing.request_hash !== requestHash) {
    throw new HttpError(409, 'Idempotency-Key already used with a different payload.');
  }

  if (existing.status === 'IN_PROGRESS') {
    throw new HttpError(409, 'A request with this Idempotency-Key is already in progress.');
  }

  if (existing.status === 'COMPLETED') {
    return {
      status: Number(existing.status_code || 200),
      body: normalizeStoredJson(existing.response_json),
      replayed: true,
    };
  }

  return null;
}

async function executeIdempotentFinanceAction({
  workspaceId,
  actorUserId,
  scope,
  idempotencyKey,
  payload,
  execute,
}) {
  if (!idempotencyKey) {
    const result = await execute();
    return { ...result, replayed: false };
  }

  const requestHash = computeRequestHash(payload || {});
  const now = new Date().toISOString();
  const rowSelector = {
    workspace_id: workspaceId,
    scope,
    idempotency_key: idempotencyKey,
  };

  let existing = await loadIdempotencyRow(workspaceId, scope, idempotencyKey);
  if (existing) {
    const replay = parseCompletedRow(existing, requestHash);
    if (replay) {
      return replay;
    }

    await knex()('finance_idempotency_keys')
      .where({ id: existing.id })
      .update({
        status: 'IN_PROGRESS',
        error_message: null,
        updated_at: now,
        created_by_user_id: actorUserId,
      });
  } else {
    try {
      await knex()('finance_idempotency_keys').insert({
        ...rowSelector,
        request_hash: requestHash,
        status: 'IN_PROGRESS',
        status_code: null,
        response_json: null,
        error_message: null,
        created_by_user_id: actorUserId,
        created_at: now,
        updated_at: now,
      });
    } catch (error) {
      if (error?.code !== '23505') {
        throw error;
      }

      existing = await loadIdempotencyRow(workspaceId, scope, idempotencyKey);
      assert(existing, 409, 'Duplicate idempotency key detected.');
      const replay = parseCompletedRow(existing, requestHash);
      if (replay) {
        return replay;
      }

      await knex()('finance_idempotency_keys')
        .where({ id: existing.id })
        .update({
          status: 'IN_PROGRESS',
          error_message: null,
          updated_at: now,
          created_by_user_id: actorUserId,
        });
    }
  }

  try {
    const result = await execute();

    await knex()('finance_idempotency_keys')
      .where(rowSelector)
      .update({
        status: 'COMPLETED',
        status_code: Number(result?.status || 200),
        response_json: result?.body ?? null,
        error_message: null,
        updated_at: new Date().toISOString(),
      });

    return { ...(result || { status: 200, body: null }), replayed: false };
  } catch (error) {
    await knex()('finance_idempotency_keys')
      .where(rowSelector)
      .update({
        status: 'FAILED',
        error_message: error instanceof Error ? error.message.slice(0, 1000) : 'Request failed.',
        updated_at: new Date().toISOString(),
      });
    throw error;
  }
}

module.exports = {
  getIdempotencyKey,
  executeIdempotentFinanceAction,
};
