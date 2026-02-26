const { knex } = require('./db');

async function addAuditLog({ workspaceId, actorUserId, entityType, entityId, action, before, after }) {
  const now = new Date().toISOString();
  await knex()('finance_audit_logs').insert({
    workspace_id: workspaceId,
    actor_user_id: actorUserId || null,
    entity_type: entityType,
    entity_id: String(entityId),
    action,
    before_json: before || null,
    after_json: after || null,
    created_at: now,
  });
}

async function addApprovalRecord({ workspaceId, transactionId, action, actorUserId, comment = null }) {
  const now = new Date().toISOString();
  await knex()('finance_approval_records').insert({
    workspace_id: workspaceId,
    transaction_id: transactionId,
    action,
    actor_user_id: actorUserId,
    comment,
    created_at: now,
  });
}

module.exports = {
  addAuditLog,
  addApprovalRecord,
};
