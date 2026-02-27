const { CURRENCIES, SYSTEM_CATEGORIES } = require('./constants');

const FINANCE_PERMISSION_ACTIONS = [
  'api::finance.finance.me',
  'api::finance.finance.getSettings',
  'api::finance.finance.updateSettings',
  'api::finance.finance.listAccounts',
  'api::finance.finance.getAccount',
  'api::finance.finance.createAccount',
  'api::finance.finance.updateAccount',
  'api::finance.finance.deleteAccount',
  'api::finance.finance.listCategories',
  'api::finance.finance.createCategory',
  'api::finance.finance.updateCategory',
  'api::finance.finance.deleteCategory',
  'api::finance.finance.listCounterparties',
  'api::finance.finance.createCounterparty',
  'api::finance.finance.updateCounterparty',
  'api::finance.finance.deleteCounterparty',
  'api::finance.finance.listDepartments',
  'api::finance.finance.createDepartment',
  'api::finance.finance.updateDepartment',
  'api::finance.finance.deleteDepartment',
  'api::finance.finance.listEmployees',
  'api::finance.finance.getEmployee',
  'api::finance.finance.createEmployee',
  'api::finance.finance.updateEmployee',
  'api::finance.finance.deleteEmployee',
  'api::finance.finance.getEmployeeTimeline',
  'api::finance.finance.listTransactions',
  'api::finance.finance.getTransaction',
  'api::finance.finance.createTransaction',
  'api::finance.finance.updateTransaction',
  'api::finance.finance.deleteTransaction',
  'api::finance.finance.approveTransaction',
  'api::finance.finance.rejectTransaction',
  'api::finance.finance.listSubscriptions',
  'api::finance.finance.createSubscription',
  'api::finance.finance.updateSubscription',
  'api::finance.finance.deleteSubscription',
  'api::finance.finance.generateSubscription',
  'api::finance.finance.listPayrollRuns',
  'api::finance.finance.getPayrollRun',
  'api::finance.finance.createPayrollRun',
  'api::finance.finance.generatePayrollRun',
  'api::finance.finance.updatePayrollEntry',
  'api::finance.finance.approvePayrollRun',
  'api::finance.finance.payPayrollRun',
  'api::finance.finance.listLoans',
  'api::finance.finance.getLoan',
  'api::finance.finance.createLoan',
  'api::finance.finance.updateLoan',
  'api::finance.finance.disburseLoan',
  'api::finance.finance.repayLoan',
  'api::finance.finance.monthlySummary',
  'api::finance.finance.expenseBreakdown',
  'api::finance.finance.cashflow',
  'api::finance.finance.accountBalances',
  'api::finance.finance.payrollSummary',
  'api::finance.finance.payrollByDepartment',
  'api::finance.finance.loanOutstanding',
  'api::finance.finance.employeeLedger',
  'api::finance.finance.exportTransactionsCsv',
  'api::finance.finance.exportMonthlySummaryCsv',
  'api::finance.finance.exportPayrollCsv',
  'api::finance.finance.exportLoanLedgerCsv',
];

async function ensureWorkspace(knex) {
  const existing = await knex('finance_workspaces').first();
  if (existing) {
    return existing;
  }
  const now = new Date().toISOString();

  const [workspace] = await knex('finance_workspaces')
    .insert({
      name: process.env.FINANCE_WORKSPACE_NAME || 'TkTurners',
      base_currency: process.env.FINANCE_BASE_CURRENCY || 'USD',
      timezone: process.env.FINANCE_TIMEZONE || 'UTC',
      web_entry_default_status: process.env.FINANCE_WEB_DEFAULT_STATUS || 'APPROVED',
      allow_self_approval: true,
      created_at: now,
      updated_at: now,
    })
    .returning('*');

  return workspace;
}

async function ensureCurrencies(knex) {
  for (const [code, name, decimals] of CURRENCIES) {
    await knex('finance_currencies')
      .insert({ code, name, decimals, active: true })
      .onConflict('code')
      .merge({ name, decimals, active: true });
  }
}

async function ensureSystemCategories(knex, workspaceId) {
  const now = new Date().toISOString();
  for (const category of SYSTEM_CATEGORIES) {
    await knex('finance_categories')
      .insert({
        workspace_id: workspaceId,
        name: category.name,
        type: category.type,
        is_system: true,
        created_at: now,
        updated_at: now,
      })
      .onConflict(['workspace_id', 'name'])
      .merge({ type: category.type, is_system: true, updated_at: now });
  }
}

async function ensureAuthenticatedRolePermissions(knex, roleId) {
  const now = new Date().toISOString();
  for (const action of FINANCE_PERMISSION_ACTIONS) {
    let permission = await knex('up_permissions').where({ action }).first();

    if (!permission) {
      [permission] = await knex('up_permissions')
        .insert({
          document_id: `perm-${action}`,
          action,
          created_at: now,
          updated_at: now,
          published_at: now,
        })
        .returning('*');
    }

    await knex('up_permissions_role_lnk')
      .insert({
        permission_id: permission.id,
        role_id: roleId,
        permission_ord: permission.id,
      })
      .onConflict(['permission_id', 'role_id'])
      .ignore();
  }
}

async function ensureUsersAndMemberships(strapiInstance, workspaceId) {
  const knex = strapiInstance.db.connection;
  const now = new Date().toISOString();

  const role = await knex('up_roles').where({ type: 'authenticated' }).first();
  if (!role) {
    throw new Error('Authenticated role not found in up_roles table.');
  }
  await ensureAuthenticatedRolePermissions(knex, role.id);

  const defaultSeedPassword = 'ChangeMe123!';
  const resolveSeedPassword = (envKey) => {
    const configured = process.env[envKey];
    if (configured && configured.trim()) {
      return configured.trim();
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error(`${envKey} must be set in production.`);
    }

    strapiInstance.log.warn(
      `${envKey} is not set. Falling back to development default password for seed user creation.`
    );
    return defaultSeedPassword;
  };

  const seedUsers = [
    {
      email: process.env.FINANCE_SEED_ADMIN_EMAIL_1 || 'bilal@tkturners.com',
      username: process.env.FINANCE_SEED_ADMIN_USERNAME_1 || 'bilal',
      password: resolveSeedPassword('FINANCE_SEED_ADMIN_PASSWORD_1'),
    },
    {
      email: 'amin@tkturners.com',
      username: 'amin',
      password:
        process.env.FINANCE_SEED_ADMIN_PASSWORD_AMIN ||
        process.env.FINANCE_SEED_ADMIN_PASSWORD_2 ||
        resolveSeedPassword('FINANCE_SEED_ADMIN_PASSWORD_1'),
    },
  ];

  const userService = strapiInstance.plugin('users-permissions').service('user');
  let firstUserId = null;
  let bilalUserId = null;

  for (const seed of seedUsers) {
    let user = await knex('up_users').whereRaw('LOWER(email) = LOWER(?)', [seed.email]).first();

    if (!user) {
      user = await userService.add({
        email: seed.email,
        username: seed.username,
        provider: 'local',
        password: seed.password,
        confirmed: true,
        blocked: false,
        role: role.id,
      });
    } else if (!user.provider) {
      await knex('up_users').where({ id: user.id }).update({
        provider: 'local',
        updated_at: new Date(),
      });
    }

    if (!firstUserId) {
      firstUserId = user.id;
    }

    if (String(seed.email).toLowerCase() === 'bilal@tkturners.com') {
      bilalUserId = user.id;
    }

    await knex('finance_workspace_members')
      .insert({
        workspace_id: workspaceId,
        user_id: user.id,
        role: 'ADMIN',
        created_at: now,
        updated_at: now,
      })
      .onConflict(['workspace_id', 'user_id'])
      .merge({ role: 'ADMIN', updated_at: now });
  }

  return {
    firstUserId,
    bilalUserId: bilalUserId || firstUserId,
  };
}

async function ensureSystemAccounts(knex, workspace, creatorUserId) {
  if (!creatorUserId) {
    return;
  }

  const now = new Date().toISOString();
  const accountName = `Loan Receivable Control ${workspace.base_currency || 'USD'}`;

  await knex('finance_accounts')
    .insert({
      workspace_id: workspace.id,
      name: accountName,
      owner_user_id: null,
      currency: workspace.base_currency || 'USD',
      opening_balance_minor: 0,
      notes: 'System generated receivable control account for employee loans.',
      is_active: true,
      account_kind: 'LOAN_RECEIVABLE_CONTROL',
      is_system: true,
      created_by_user_id: creatorUserId,
      created_at: now,
      updated_at: now,
    })
    .onConflict(['workspace_id', 'name'])
    .merge({
      currency: workspace.base_currency || 'USD',
      is_active: true,
      account_kind: 'LOAN_RECEIVABLE_CONTROL',
      is_system: true,
      updated_at: now,
    });
}

function toMinorUnits(amount) {
  return Math.round(Number(amount || 0) * 100);
}

async function ensureBilalAccounts(knex, workspace, creatorUserId, bilalUserId) {
  if (!creatorUserId || !bilalUserId) {
    return;
  }

  const now = new Date().toISOString();
  const requiredAccounts = [
    { name: 'Bilal - Wise - EUR', currency: 'EUR', opening_balance_minor: toMinorUnits(4668.89) },
    { name: 'Bilal - Wise - USD', currency: 'USD', opening_balance_minor: toMinorUnits(136.63) },
    { name: 'Bilal - Wise - PKR', currency: 'PKR', opening_balance_minor: toMinorUnits(23281.29) },
    { name: 'Bilal - Wise - GBP', currency: 'GBP', opening_balance_minor: 0 },
    { name: 'Bilal - Payoneer - USD', currency: 'USD', opening_balance_minor: 0 },
    { name: 'Bilal - Payoneer - EUR', currency: 'EUR', opening_balance_minor: toMinorUnits(6.1) },
    { name: 'Bilal - Payoneer - GBP', currency: 'GBP', opening_balance_minor: 0 },
  ];

  for (const account of requiredAccounts) {
    await knex('finance_accounts')
      .insert({
        workspace_id: workspace.id,
        name: account.name,
        owner_user_id: bilalUserId,
        currency: account.currency,
        opening_balance_minor: account.opening_balance_minor,
        notes: null,
        is_active: true,
        account_kind: 'CASH',
        is_system: false,
        created_by_user_id: creatorUserId,
        created_at: now,
        updated_at: now,
      })
      .onConflict(['workspace_id', 'name'])
      .merge({
        owner_user_id: bilalUserId,
        currency: account.currency,
        opening_balance_minor: account.opening_balance_minor,
        is_active: true,
        account_kind: 'CASH',
        is_system: false,
        updated_at: now,
      });
  }
}

async function ensureBilalOwnsExistingAccounts(knex, workspaceId, bilalUserId) {
  if (!workspaceId || !bilalUserId) {
    return;
  }

  await knex('finance_accounts')
    .where({ workspace_id: workspaceId, is_system: false })
    .whereNot({ owner_user_id: bilalUserId })
    .update({
      owner_user_id: bilalUserId,
      updated_at: new Date().toISOString(),
    });
}

async function seedBaseData(strapiInstance) {
  const knex = strapiInstance.db.connection;

  await ensureCurrencies(knex);
  const workspace = await ensureWorkspace(knex);
  await ensureSystemCategories(knex, workspace.id);
  const { firstUserId, bilalUserId } = await ensureUsersAndMemberships(strapiInstance, workspace.id);
  await ensureSystemAccounts(knex, workspace, firstUserId);
  await ensureBilalAccounts(knex, workspace, firstUserId, bilalUserId);
  await ensureBilalOwnsExistingAccounts(knex, workspace.id, bilalUserId);

  strapiInstance.log.info('Finance seed data ready');
}

module.exports = {
  seedBaseData,
};
