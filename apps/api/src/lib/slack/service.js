const crypto = require('crypto');

const { parseFinanceMessage } = require('@tkturners/parser');

const { assert } = require('../finance/errors');
const { knex, getUncategorizedCategoryId } = require('../finance/db');
const { addAuditLog } = require('../finance/audit');
const {
  createTransaction,
  getWorkspaceSettings,
} = require('../finance/transactions');

function getRawBody(ctx) {
  const symbol = Symbol.for('unparsedBody');
  const maybeUnparsed = ctx.request?.body?.[symbol];

  if (Buffer.isBuffer(maybeUnparsed)) {
    return maybeUnparsed.toString('utf8');
  }

  if (typeof maybeUnparsed === 'string') {
    return maybeUnparsed;
  }

  if (typeof ctx.request?.rawBody === 'string') {
    return ctx.request.rawBody;
  }

  return '';
}

function verifySlackSignature(ctx) {
  const enforce = (process.env.SLACK_SIGNING_ENFORCED || 'true').toLowerCase() === 'true';
  if (!enforce) {
    return true;
  }

  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  assert(signingSecret, 500, 'SLACK_SIGNING_SECRET is missing.');

  const timestamp = ctx.request.headers['x-slack-request-timestamp'];
  const signature = ctx.request.headers['x-slack-signature'];
  assert(timestamp && signature, 401, 'Missing Slack signature headers.');

  const ageSeconds = Math.floor(Date.now() / 1000) - Number(timestamp);
  assert(Math.abs(ageSeconds) < 300, 401, 'Slack signature timestamp is too old.');

  const rawBody = getRawBody(ctx);
  const baseString = `v0:${timestamp}:${rawBody}`;
  const digest = crypto.createHmac('sha256', signingSecret).update(baseString).digest('hex');
  const expected = `v0=${digest}`;
  if (expected.length !== String(signature).length) {
    assert(false, 401, 'Invalid Slack signature.');
  }

  const valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
  assert(valid, 401, 'Invalid Slack signature.');

  return true;
}

async function resolveAccountByName(workspaceId, name) {
  if (!name) {
    return { account: null, ambiguous: false };
  }

  const trimmed = String(name).trim();
  const exact = await knex()('finance_accounts')
    .where({ workspace_id: workspaceId, is_active: true })
    .whereRaw('LOWER(name) = LOWER(?)', [trimmed]);

  if (exact.length === 1) {
    return { account: exact[0], ambiguous: false };
  }

  const fuzzy = await knex()('finance_accounts')
    .where({ workspace_id: workspaceId, is_active: true })
    .whereILike('name', `%${trimmed}%`);

  if (fuzzy.length === 1) {
    return { account: fuzzy[0], ambiguous: false };
  }

  if (fuzzy.length > 1 || exact.length > 1) {
    return { account: null, ambiguous: true };
  }

  return { account: null, ambiguous: false };
}

async function resolveCategoryByName(workspaceId, categoryName) {
  if (!categoryName || categoryName === 'Uncategorized') {
    return getUncategorizedCategoryId(workspaceId);
  }

  const exact = await knex()('finance_categories')
    .where({ workspace_id: workspaceId })
    .whereRaw('LOWER(name) = LOWER(?)', [categoryName])
    .first();

  if (exact) {
    return exact.id;
  }

  return getUncategorizedCategoryId(workspaceId);
}

async function resolveOrCreateCounterparty(workspaceId, name, type) {
  if (!name) {
    return null;
  }

  const existing = await knex()('finance_counterparties')
    .where({ workspace_id: workspaceId })
    .whereRaw('LOWER(name) = LOWER(?)', [name.trim()])
    .first();

  if (existing) {
    return existing.id;
  }

  const inferredKind = type === 'INCOME' ? 'CLIENT' : 'VENDOR';
  const now = new Date().toISOString();

  const [created] = await knex()('finance_counterparties')
    .insert({
      workspace_id: workspaceId,
      name: name.trim(),
      kind: inferredKind,
      notes: null,
      created_at: now,
      updated_at: now,
    })
    .returning('*');

  return created.id;
}

function amountToMinor(amount) {
  return Math.round(Number(amount) * 100);
}

function buildSummaryLines(payload) {
  const lines = [
    `Type: ${payload.type || '-'}`,
    `Amount: ${payload.amount ? `${payload.amount} ${payload.currency}` : '-'}`,
  ];

  if (payload.type === 'TRANSFER') {
    lines.push(`From: ${payload.from_account_name || '-'}`);
    lines.push(`To: ${payload.to_account_name || '-'}`);
  } else {
    lines.push(`Account: ${payload.account_name || '-'}`);
  }

  lines.push(`Counterparty: ${payload.counterparty_name || '-'}`);
  lines.push(`Category: ${payload.category || 'Uncategorized'}`);
  lines.push(`Date: ${payload.date || '-'}`);

  return lines;
}

function buildConfirmationBlocks(draftId, parsed, missing) {
  const summary = buildSummaryLines(parsed).join('\n');
  const missingText = missing.length > 0 ? `\nMissing: ${missing.join(', ')}` : '';

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Finance Draft*\n${summary}${missingText}`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          style: 'primary',
          text: { type: 'plain_text', text: 'Confirm' },
          action_id: 'money_confirm',
          value: draftId,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Edit' },
          action_id: 'money_edit',
          value: draftId,
        },
        {
          type: 'button',
          style: 'danger',
          text: { type: 'plain_text', text: 'Cancel' },
          action_id: 'money_cancel',
          value: draftId,
        },
      ],
    },
  ];
}

async function getPrimaryWorkspace() {
  const workspace = await knex()('finance_workspaces').orderBy('id', 'asc').first();
  assert(workspace, 500, 'No workspace found.');
  return workspace;
}

async function enrichParsedDraft(workspaceId, parsed) {
  const missing = new Set(parsed.missing_fields || []);
  const payload = { ...parsed };

  if (parsed.type === 'TRANSFER') {
    const fromResolved = await resolveAccountByName(workspaceId, parsed.from_account_name);
    const toResolved = await resolveAccountByName(workspaceId, parsed.to_account_name);

    if (fromResolved.ambiguous) missing.add('from_account_ambiguous');
    if (toResolved.ambiguous) missing.add('to_account_ambiguous');
    if (!fromResolved.account) missing.add('from_account');
    if (!toResolved.account) missing.add('to_account');

    payload.from_account_id = fromResolved.account?.id || null;
    payload.to_account_id = toResolved.account?.id || null;

    if (fromResolved.account && toResolved.account && fromResolved.account.currency !== toResolved.account.currency) {
      missing.add('fx_rate');
    }
  } else {
    const accountResolved = await resolveAccountByName(workspaceId, parsed.account_name);
    if (accountResolved.ambiguous) missing.add('account_ambiguous');
    if (!accountResolved.account) missing.add('account');

    payload.account_id = accountResolved.account?.id || null;
  }

  payload.category_id = await resolveCategoryByName(workspaceId, parsed.category || 'Uncategorized');

  return {
    payload,
    missing_fields: Array.from(missing),
  };
}

async function createDraft({ workspaceId, slackTeamId, slackChannelId, slackUserId, rawText, parsedPayload, confidence, missingFields }) {
  const draftToken = crypto.randomUUID();

  await knex()('finance_slack_drafts').insert({
    draft_token: draftToken,
    workspace_id: workspaceId,
    slack_team_id: slackTeamId || null,
    slack_channel_id: slackChannelId || null,
    slack_user_id: slackUserId || null,
    raw_text: rawText,
    parsed_payload_json: parsedPayload,
    confidence,
    missing_fields_json: missingFields,
    state: 'PENDING',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });

  return draftToken;
}

async function loadDraftOrThrow(draftId) {
  const draft = await knex()('finance_slack_drafts').where({ draft_token: draftId }).first();
  assert(draft, 404, 'Slack draft not found.');
  if (new Date(draft.expires_at).getTime() <= Date.now()) {
    await markDraftState(draftId, 'EXPIRED', null);
    assert(false, 409, 'Slack draft expired. Please submit again.');
  }

  assert(draft.state === 'PENDING', 409, 'Slack draft is no longer pending.');
  return draft;
}

async function markDraftState(draftId, state, createdTransactionId = null) {
  await knex()('finance_slack_drafts')
    .where({ draft_token: draftId })
    .update({
      state,
      created_transaction_id: createdTransactionId,
      updated_at: new Date().toISOString(),
    });
}

async function createTransactionFromDraft(draft, creatorUserId) {
  const workspace = await getWorkspaceSettings(draft.workspace_id);
  const parsed = draft.parsed_payload_json;
  const missing = draft.missing_fields_json || [];

  assert(Array.isArray(missing) && missing.length === 0, 400, 'Draft has unresolved fields and cannot be confirmed.');

  const counterpartyId = await resolveOrCreateCounterparty(
    draft.workspace_id,
    parsed.counterparty_name,
    parsed.type
  );

  if (parsed.type === 'TRANSFER') {
    const fromAccount = await knex()('finance_accounts').where({ id: parsed.from_account_id }).first();
    const toAccount = await knex()('finance_accounts').where({ id: parsed.to_account_id }).first();
    assert(fromAccount && toAccount, 400, 'Draft transfer accounts are invalid.');

    assert(fromAccount.currency === toAccount.currency, 400, 'Cross-currency transfer from Slack requires edit with FX details in web app.');

    return createTransaction(workspace, creatorUserId, {
      type: 'TRANSFER',
      date: parsed.date,
      description: parsed.normalized,
      from_account_id: parsed.from_account_id,
      to_account_id: parsed.to_account_id,
      from_amount_minor: amountToMinor(parsed.amount),
      from_currency: fromAccount.currency,
      to_amount_minor: amountToMinor(parsed.amount),
      to_currency: toAccount.currency,
      category_id: parsed.category_id,
      counterparty_id: counterpartyId,
      source: 'SLACK',
      status: 'PENDING',
      metadata: {
        slack_draft_id: draft.draft_token || draft.id,
      },
    });
  }

  return createTransaction(workspace, creatorUserId, {
    type: parsed.type,
    date: parsed.date,
    description: parsed.normalized,
    amount_minor: amountToMinor(parsed.amount),
    currency: parsed.currency,
    account_id: parsed.account_id,
    category_id: parsed.category_id,
    counterparty_id: counterpartyId,
    source: 'SLACK',
    status: 'PENDING',
    metadata: {
      slack_draft_id: draft.draft_token || draft.id,
    },
  });
}

async function callSlackApi(method, body) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    return;
  }

  await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });
}

async function processIncomingText({ rawText, slackTeamId, slackChannelId, slackUserId }) {
  const workspace = await getPrimaryWorkspace();
  const parsed = parseFinanceMessage(rawText);

  const confidence = parsed.confidence || 0;

  const enriched = await enrichParsedDraft(workspace.id, parsed);
  const draftId = await createDraft({
    workspaceId: workspace.id,
    slackTeamId,
    slackChannelId,
    slackUserId,
    rawText,
    parsedPayload: enriched.payload,
    confidence,
    missingFields: enriched.missing_fields,
  });

  const blocks = buildConfirmationBlocks(draftId, enriched.payload, enriched.missing_fields);
  const lowConfidence = confidence < Number(process.env.SLACK_MIN_CONFIDENCE || 0.67);

  return {
    draft_id: draftId,
    confidence,
    missing_fields: enriched.missing_fields,
    low_confidence: lowConfidence,
    blocks,
    text:
      enriched.missing_fields.length > 0 || lowConfidence
        ? 'I need a quick confirmation/edit before logging this transaction.'
        : 'Please confirm this transaction.',
  };
}

async function handleSlashCommand(ctx) {
  verifySlackSignature(ctx);

  const body = ctx.request.body || {};
  const text = body.text || '';
  assert(text.trim().length > 0, 400, 'Please provide text after /money command.');

  const result = await processIncomingText({
    rawText: text,
    slackTeamId: body.team_id,
    slackChannelId: body.channel_id,
    slackUserId: body.user_id,
  });

  ctx.body = {
    response_type: 'ephemeral',
    text: result.text,
    blocks: result.blocks,
  };
}

async function handleEvents(ctx) {
  verifySlackSignature(ctx);

  const payload = ctx.request.body || {};

  if (payload.type === 'url_verification') {
    ctx.body = { challenge: payload.challenge };
    return;
  }

  if (payload.type !== 'event_callback') {
    ctx.body = { ok: true };
    return;
  }

  const event = payload.event;
  const configuredChannel = process.env.SLACK_FINANCE_CHANNEL_ID;

  if (
    event?.type === 'message' &&
    !event?.bot_id &&
    event?.text &&
    (!configuredChannel || event.channel === configuredChannel)
  ) {
    const result = await processIncomingText({
      rawText: event.text,
      slackTeamId: payload.team_id,
      slackChannelId: event.channel,
      slackUserId: event.user,
    });

    await callSlackApi('chat.postMessage', {
      channel: event.channel,
      text: result.text,
      blocks: result.blocks,
      thread_ts: event.ts,
    });
  }

  ctx.body = { ok: true };
}

async function handleInteractions(ctx) {
  verifySlackSignature(ctx);

  const payloadRaw = ctx.request.body?.payload;
  assert(payloadRaw, 400, 'Missing interaction payload.');

  const payload = JSON.parse(payloadRaw);

  if (payload.type === 'block_actions') {
    const action = payload.actions?.[0];
    const draftId = action?.value;
    assert(draftId, 400, 'Missing draft id in interaction action.');

    const draft = await loadDraftOrThrow(draftId);
    if (typeof draft.parsed_payload_json === 'string') {
      draft.parsed_payload_json = JSON.parse(draft.parsed_payload_json);
    }
    if (typeof draft.missing_fields_json === 'string') {
      draft.missing_fields_json = JSON.parse(draft.missing_fields_json || '[]');
    }

    const workspace = await getPrimaryWorkspace();
    const actorMembership = await knex()('finance_workspace_members')
      .where({ workspace_id: workspace.id })
      .orderBy('id', 'asc')
      .first();

    assert(actorMembership, 403, 'No workspace admin available to create Slack transaction.');

    if (action.action_id === 'money_cancel') {
      await markDraftState(draftId, 'CANCELED', null);
      await addAuditLog({
        workspaceId: workspace.id,
        actorUserId: actorMembership.user_id,
        entityType: 'SLACK_DRAFT',
        entityId: draftId,
        action: 'CANCEL',
        before: draft,
        after: { state: 'CANCELED' },
      });

      ctx.body = {
        text: 'Canceled. No transaction was created.',
        replace_original: false,
      };
      return;
    }

    if (action.action_id === 'money_edit') {
      ctx.body = {
        text: 'Use `/money <corrected message>` to resubmit with edits. Existing draft stays pending until confirmed or canceled.',
        replace_original: false,
      };
      return;
    }

    if (action.action_id === 'money_confirm') {
      const created = await createTransactionFromDraft(draft, actorMembership.user_id);
      await markDraftState(draftId, 'CONFIRMED', created.id);

      await addAuditLog({
        workspaceId: workspace.id,
        actorUserId: actorMembership.user_id,
        entityType: 'SLACK_DRAFT',
        entityId: draftId,
        action: 'CONFIRM',
        before: draft,
        after: { state: 'CONFIRMED', created_transaction_id: created.id },
      });

      ctx.body = {
        text: `Transaction created as Pending (ID ${created.id}).`,
        replace_original: false,
      };
      return;
    }
  }

  ctx.body = { ok: true };
}

module.exports = {
  handleSlashCommand,
  handleEvents,
  handleInteractions,
  processIncomingText,
};
