const { assert } = require('./errors');
const { getWorkspaceMembership } = require('./db');

const ROLE_ORDER = {
  VIEWER: 1,
  ACCOUNTANT: 2,
  ADMIN: 3,
};

async function requireUser(ctx) {
  const user = ctx.state?.user;
  assert(user?.id, 401, 'Authentication required.');
  return user;
}

async function requireMembership(ctx) {
  const user = await requireUser(ctx);
  const membership = await getWorkspaceMembership(user.id);
  return {
    user,
    membership,
  };
}

function requireRole(membership, minimumRole) {
  const actual = ROLE_ORDER[membership.role] || 0;
  const required = ROLE_ORDER[minimumRole] || 0;
  assert(actual >= required, 403, 'Insufficient role permission.');
}

module.exports = {
  requireUser,
  requireMembership,
  requireRole,
};
