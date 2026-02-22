const { assert } = require('./errors');

function knex() {
  return strapi.db.connection;
}

async function getWorkspaceMembership(userId) {
  const membership = await knex()
    .select(
      'm.workspace_id',
      'm.role',
      'w.name as workspace_name',
      'w.base_currency',
      'w.timezone',
      'w.web_entry_default_status',
      'w.allow_self_approval'
    )
    .from('finance_workspace_members as m')
    .innerJoin('finance_workspaces as w', 'w.id', 'm.workspace_id')
    .where('m.user_id', userId)
    .first();

  assert(membership, 403, 'User does not belong to a workspace.');
  return membership;
}

async function getUncategorizedCategoryId(workspaceId) {
  const uncategorized = await knex()
    .from('finance_categories')
    .where({ workspace_id: workspaceId })
    .whereRaw('LOWER(name) = LOWER(?)', ['Uncategorized'])
    .first();

  assert(uncategorized, 500, 'System category "Uncategorized" not found.');
  return uncategorized.id;
}

module.exports = {
  knex,
  getWorkspaceMembership,
  getUncategorizedCategoryId,
};
