const dayjs = require('dayjs');

const {
  z,
  DepartmentInputSchema,
  EmployeeInputSchema,
  PayrollRunCreateSchema,
  PayrollEntryUpdateSchema,
  EmployeeLoanCreateSchema,
  EmployeeLoanUpdateSchema,
  LoanRepaymentInputSchema,
  LoanDisbursementInputSchema,
  PayrollPayActionSchema,
} = require('@tkturners/shared-types');

const { assert, HttpError } = require('./errors');
const { knex, getUncategorizedCategoryId } = require('./db');
const { addAuditLog } = require('./audit');
const { createTransaction, getWorkspaceSettings } = require('./transactions');
const { lastFridayOfMonth } = require('./utils');
const {
  toSafeMinor,
  computePayrollAmounts,
  calculateMonthlyInterestMinor,
  allocateLoanPayment,
  allocateLoanPrincipalOnlyPayment,
} = require('./payroll-utils');

const EmployeeUpdateSchema = z
  .object({
    employee_code: z.string().trim().min(1).max(32).optional(),
    full_name: z.string().trim().min(1).max(160).optional(),
    email: z.string().email().nullable().optional(),
    join_date: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).nullable().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    payroll_currency: z.string().trim().length(3).transform((v) => v.toUpperCase()).optional(),
    settlement_iban: z.string().trim().min(5).max(64).optional(),
    default_payout_account_id: z.number().int().positive().optional(),
    default_funding_account_id: z.number().int().positive().nullable().optional(),
    department_id: z.number().int().positive().nullable().optional(),
    base_salary_minor: z.number().int().nonnegative().optional(),
    default_allowances_minor: z.number().int().nonnegative().optional(),
    default_non_loan_deductions_minor: z.number().int().nonnegative().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided.',
  });

const DepartmentUpdateSchema = DepartmentInputSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  {
    message: 'At least one field must be provided.',
  }
);

function parseSchema(schema, payload, message) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new HttpError(400, message, parsed.error.flatten());
  }

  return parsed.data;
}

function normalizeJsonObject(value) {
  if (!value) {
    return {};
  }

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return {};
    }
  }

  return {};
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

function normalizeDepartmentCode(rawValue) {
  if (rawValue === undefined) {
    return undefined;
  }

  if (rawValue === null) {
    return null;
  }

  const normalized = String(rawValue).trim().toUpperCase();
  return normalized || null;
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

function normalizeOptionalNumericField(rawValue) {
  if (rawValue === undefined || rawValue === null) {
    return undefined;
  }

  if (typeof rawValue === 'string' && rawValue.trim() === '') {
    return undefined;
  }

  return normalizeNumericField(rawValue);
}

function pruneUndefinedFields(payload = {}) {
  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  }

  return payload;
}

function normalizeOptionalDateField(payload, fieldName, errorMessage) {
  if (payload[fieldName] === undefined) {
    return;
  }

  if (payload[fieldName] === null || String(payload[fieldName]).trim() === '') {
    payload[fieldName] = undefined;
    return;
  }

  const normalizedDate = normalizeOptionalDateInput(payload[fieldName]);
  assert(normalizedDate !== null, 400, errorMessage, {
    fieldErrors: { [fieldName]: ['Invalid'] },
  });
  payload[fieldName] = normalizedDate;
}

function normalizeRequiredDateField(payload, fieldName, errorMessage) {
  if (payload[fieldName] === undefined) {
    return;
  }

  if (payload[fieldName] === null || String(payload[fieldName]).trim() === '') {
    assert(false, 400, errorMessage, {
      fieldErrors: { [fieldName]: ['Invalid'] },
    });
  }

  const normalizedDate = normalizeOptionalDateInput(payload[fieldName]);
  assert(normalizedDate !== null, 400, errorMessage, {
    fieldErrors: { [fieldName]: ['Invalid'] },
  });
  payload[fieldName] = normalizedDate;
}

function normalizeEmployeePayload(payload = {}) {
  const normalized = { ...(payload || {}) };

  normalized.default_payout_account_id = normalizeNumericField(normalized.default_payout_account_id);
  normalized.default_funding_account_id = normalizeNumericField(normalized.default_funding_account_id, {
    nullable: true,
  });
  normalized.department_id = normalizeNumericField(normalized.department_id, {
    nullable: true,
  });
  normalized.base_salary_minor = normalizeNumericField(normalized.base_salary_minor);
  normalized.default_allowances_minor = normalizeNumericField(normalized.default_allowances_minor);
  normalized.default_non_loan_deductions_minor = normalizeNumericField(
    normalized.default_non_loan_deductions_minor
  );

  if (normalized.settlement_iban !== undefined && normalized.settlement_iban !== null) {
    normalized.settlement_iban = String(normalized.settlement_iban).trim().toUpperCase();
  }

  if (normalized.join_date !== undefined) {
    if (normalized.join_date === null || String(normalized.join_date).trim() === '') {
      normalized.join_date = null;
    }
  }

  return normalized;
}

function normalizeLoanCreatePayload(payload = {}) {
  const normalized = { ...(payload || {}) };

  normalized.employee_id = normalizeNumericField(normalized.employee_id);
  normalized.principal_minor = normalizeNumericField(normalized.principal_minor);
  normalized.annual_interest_bps = normalizeNumericField(normalized.annual_interest_bps);
  normalized.installment_minor = normalizeNumericField(normalized.installment_minor);
  normalized.disbursement_account_id = normalizeNumericField(normalized.disbursement_account_id);
  normalized.receivable_control_account_id = normalizeOptionalNumericField(
    normalized.receivable_control_account_id
  );

  if (typeof normalized.first_due_date === 'string') {
    const trimmed = normalized.first_due_date.trim();
    if (/^\d{4}-\d{2}$/.test(trimmed)) {
      const canonicalDate = lastFridayOfMonth(trimmed);
      assert(canonicalDate, 400, 'Invalid loan payload.', {
        fieldErrors: { first_due_date: ['Invalid'] },
      });
      normalized.first_due_date = canonicalDate;
    }
  }

  normalizeOptionalDateField(normalized, 'first_due_date', 'Invalid loan payload.');

  return pruneUndefinedFields(normalized);
}

function normalizeLoanUpdatePayload(payload = {}) {
  const normalized = { ...(payload || {}) };

  normalized.annual_interest_bps = normalizeOptionalNumericField(normalized.annual_interest_bps);
  normalized.installment_minor = normalizeOptionalNumericField(normalized.installment_minor);
  normalized.disbursement_account_id = normalizeOptionalNumericField(normalized.disbursement_account_id);

  normalizeOptionalDateField(normalized, 'next_due_date', 'Invalid loan payload.');

  return pruneUndefinedFields(normalized);
}

function normalizeLoanDisbursementPayload(payload = {}) {
  const normalized = { ...(payload || {}) };

  normalized.from_amount_minor = normalizeOptionalNumericField(normalized.from_amount_minor);
  normalized.fx_rate = normalizeOptionalNumericField(normalized.fx_rate);
  normalized.transfer_fee_amount_minor = normalizeOptionalNumericField(normalized.transfer_fee_amount_minor);
  normalized.transfer_fee_category_id = normalizeOptionalNumericField(normalized.transfer_fee_category_id);
  normalized.transfer_fee_fx_rate_to_base = normalizeOptionalNumericField(normalized.transfer_fee_fx_rate_to_base);

  normalizeOptionalDateField(normalized, 'disbursement_date', 'Invalid loan disbursement payload.');

  return pruneUndefinedFields(normalized);
}

function normalizeLoanRepaymentPayload(payload = {}) {
  const normalized = { ...(payload || {}) };

  normalized.amount_minor = normalizeNumericField(normalized.amount_minor);
  normalized.cash_account_id = normalizeNumericField(normalized.cash_account_id);

  normalizeRequiredDateField(normalized, 'repayment_date', 'Invalid loan repayment payload.');

  return pruneUndefinedFields(normalized);
}

async function resolveAccount(workspaceId, accountId, { mustBeActive = true } = {}) {
  const query = knex()('finance_accounts').where({ workspace_id: workspaceId, id: accountId });
  if (mustBeActive) {
    query.andWhere({ is_active: true });
  }

  const account = await query.first();
  assert(account, 400, `Account ${accountId} not found${mustBeActive ? ' or inactive' : ''}.`);
  return account;
}

async function resolveDepartment(workspaceId, departmentId, { mustBeActive = true } = {}) {
  if (!departmentId) {
    return null;
  }

  const query = knex()('finance_departments').where({ workspace_id: workspaceId, id: departmentId });
  if (mustBeActive) {
    query.andWhere({ is_active: true });
  }

  const department = await query.first();
  assert(department, 400, `Department ${departmentId} not found${mustBeActive ? ' or inactive' : ''}.`);
  return department;
}

async function assertDepartmentNameAvailable(workspaceId, name, excludeId = null) {
  const query = knex()('finance_departments')
    .where({ workspace_id: workspaceId })
    .whereRaw('LOWER(name) = LOWER(?)', [name]);

  if (excludeId) {
    query.andWhereNot({ id: excludeId });
  }

  const existing = await query.first();
  assert(!existing, 409, 'Department with this name already exists.');
}

async function assertDepartmentCodeAvailable(workspaceId, code, excludeId = null) {
  if (!code) {
    return;
  }

  const query = knex()('finance_departments')
    .where({ workspace_id: workspaceId })
    .whereRaw('UPPER(code) = UPPER(?)', [code]);

  if (excludeId) {
    query.andWhereNot({ id: excludeId });
  }

  const existing = await query.first();
  assert(!existing, 409, 'Department with this code already exists.');
}

async function getCategoryIdByName(workspaceId, name) {
  const category = await knex()('finance_categories')
    .where({ workspace_id: workspaceId })
    .whereRaw('LOWER(name) = LOWER(?)', [name])
    .first();

  if (category) {
    return category.id;
  }

  return getUncategorizedCategoryId(workspaceId);
}

async function resolveCategoryId(workspaceId, categoryId, fallbackName = 'Uncategorized') {
  if (!categoryId) {
    return getCategoryIdByName(workspaceId, fallbackName);
  }

  const category = await knex()('finance_categories')
    .where({ workspace_id: workspaceId, id: categoryId })
    .first();
  assert(category, 400, `Category ${categoryId} not found.`);
  return category.id;
}

async function generateEmployeeCode(workspaceId) {
  const latest = await knex()('finance_employees')
    .where({ workspace_id: workspaceId })
    .orderBy('id', 'desc')
    .first();

  const next = Number(latest?.id || 0) + 1;
  return `EMP-${String(next).padStart(4, '0')}`;
}

async function ensureEmployeeCounterparty(workspaceId, fullName) {
  const now = new Date().toISOString();
  const existing = await knex()('finance_counterparties')
    .where({ workspace_id: workspaceId })
    .whereRaw('LOWER(name) = LOWER(?)', [fullName.trim()])
    .first();

  if (existing) {
    if (existing.kind !== 'EMPLOYEE') {
      const [updated] = await knex()('finance_counterparties')
        .where({ id: existing.id })
        .update({ kind: 'EMPLOYEE', updated_at: now })
        .returning('*');
      return updated.id;
    }

    return existing.id;
  }

  const [counterparty] = await knex()('finance_counterparties')
    .insert({
      workspace_id: workspaceId,
      name: fullName.trim(),
      kind: 'EMPLOYEE',
      notes: null,
      created_at: now,
      updated_at: now,
    })
    .returning('*');

  return counterparty.id;
}

async function ensureReceivableControlAccount(workspaceId, actorUserId, currency, explicitAccountId = null) {
  if (explicitAccountId) {
    const account = await resolveAccount(workspaceId, explicitAccountId);
    assert(account.currency === currency, 400, 'Receivable control account currency mismatch.');
    assert(account.account_kind === 'LOAN_RECEIVABLE_CONTROL', 400, 'Receivable control account must be LOAN_RECEIVABLE_CONTROL.');
    return account;
  }

  const byKind = await knex()('finance_accounts')
    .where({
      workspace_id: workspaceId,
      currency,
      account_kind: 'LOAN_RECEIVABLE_CONTROL',
      is_active: true,
    })
    .orderBy('id', 'asc')
    .first();

  if (byKind) {
    return byKind;
  }

  const now = new Date().toISOString();
  const name = `Loan Receivable Control ${currency}`;

  const [created] = await knex()('finance_accounts')
    .insert({
      workspace_id: workspaceId,
      name,
      owner_user_id: null,
      currency,
      opening_balance_minor: 0,
      notes: 'System generated receivable control account for employee loans.',
      is_active: true,
      account_kind: 'LOAN_RECEIVABLE_CONTROL',
      is_system: true,
      created_by_user_id: actorUserId,
      created_at: now,
      updated_at: now,
    })
    .onConflict(['workspace_id', 'name'])
    .merge({
      currency,
      is_active: true,
      account_kind: 'LOAN_RECEIVABLE_CONTROL',
      is_system: true,
      updated_at: now,
    })
    .returning('*');

  return created;
}

async function listDepartments(workspaceId) {
  return knex()('finance_departments')
    .where({ workspace_id: workspaceId })
    .orderBy('is_active', 'desc')
    .orderBy('name', 'asc');
}

async function createDepartment(workspaceId, actorUserId, payload) {
  const input = parseSchema(DepartmentInputSchema, payload, 'Invalid department payload.');
  const now = new Date().toISOString();
  const normalizedCode = normalizeDepartmentCode(input.code);

  await assertDepartmentNameAvailable(workspaceId, input.name);
  await assertDepartmentCodeAvailable(workspaceId, normalizedCode);

  const [department] = await knex()('finance_departments')
    .insert({
      workspace_id: workspaceId,
      name: input.name.trim(),
      code: normalizedCode,
      notes: input.notes || null,
      is_active: input.is_active !== undefined ? Boolean(input.is_active) : true,
      created_by_user_id: actorUserId,
      created_at: now,
      updated_at: now,
    })
    .returning('*');

  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'DEPARTMENT',
    entityId: department.id,
    action: 'CREATE',
    before: null,
    after: department,
  });

  return department;
}

async function updateDepartment(workspaceId, actorUserId, departmentId, payload) {
  const input = parseSchema(DepartmentUpdateSchema, payload, 'Invalid department payload.');
  const existing = await knex()('finance_departments')
    .where({ workspace_id: workspaceId, id: departmentId })
    .first();
  assert(existing, 404, 'Department not found.');

  const updates = {};

  if (input.name !== undefined) {
    const trimmedName = input.name.trim();
    if (trimmedName.toLowerCase() !== String(existing.name || '').toLowerCase()) {
      await assertDepartmentNameAvailable(workspaceId, trimmedName, departmentId);
    }
    updates.name = trimmedName;
  }

  if (input.code !== undefined) {
    const normalizedCode = normalizeDepartmentCode(input.code);
    if ((normalizedCode || null) !== (existing.code || null)) {
      await assertDepartmentCodeAvailable(workspaceId, normalizedCode, departmentId);
    }
    updates.code = normalizedCode;
  }

  if (input.notes !== undefined) {
    updates.notes = input.notes || null;
  }

  if (input.is_active !== undefined) {
    updates.is_active = Boolean(input.is_active);
  }

  assert(Object.keys(updates).length > 0, 400, 'No valid department fields provided.');
  updates.updated_at = new Date().toISOString();

  const [department] = await knex()('finance_departments')
    .where({ workspace_id: workspaceId, id: departmentId })
    .update(updates)
    .returning('*');

  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'DEPARTMENT',
    entityId: department.id,
    action: 'UPDATE',
    before: existing,
    after: department,
  });

  return department;
}

async function deleteDepartment(workspaceId, actorUserId, departmentId) {
  const existing = await knex()('finance_departments')
    .where({ workspace_id: workspaceId, id: departmentId })
    .first();
  assert(existing, 404, 'Department not found.');

  const linkedCountRow = await knex()('finance_employees')
    .where({ workspace_id: workspaceId, department_id: departmentId })
    .count('* as count')
    .first();

  const linkedCount = Number(linkedCountRow?.count || 0);

  if (linkedCount > 0) {
    const [department] = await knex()('finance_departments')
      .where({ workspace_id: workspaceId, id: departmentId })
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .returning('*');

    await addAuditLog({
      workspaceId,
      actorUserId,
      entityType: 'DEPARTMENT',
      entityId: department.id,
      action: 'SOFT_DELETE',
      before: existing,
      after: department,
    });

    return {
      deleted: false,
      soft_deleted: true,
      linked_employees_count: linkedCount,
      department,
    };
  }

  await knex()('finance_departments').where({ workspace_id: workspaceId, id: departmentId }).delete();

  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'DEPARTMENT',
    entityId: departmentId,
    action: 'DELETE',
    before: existing,
    after: null,
  });

  return { deleted: true, soft_deleted: false };
}

async function listEmployees(workspaceId) {
  return knex()
    .select(
      'e.*',
      'd.name as department_name',
      'd.code as department_code',
      'payout_account.name as payout_account_name',
      'funding_account.name as funding_account_name',
      'cp.name as counterparty_name',
      knex().raw(
        "COALESCE(SUM(CASE WHEN l.status IN ('APPROVED', 'ACTIVE') THEN 1 ELSE 0 END),0)::int as active_loan_count"
      )
    )
    .from('finance_employees as e')
    .leftJoin('finance_departments as d', 'd.id', 'e.department_id')
    .leftJoin('finance_accounts as payout_account', 'payout_account.id', 'e.default_payout_account_id')
    .leftJoin('finance_accounts as funding_account', 'funding_account.id', 'e.default_funding_account_id')
    .leftJoin('finance_counterparties as cp', 'cp.id', 'e.linked_counterparty_id')
    .leftJoin('finance_employee_loans as l', 'l.employee_id', 'e.id')
    .where('e.workspace_id', workspaceId)
    .groupBy('e.id', 'd.name', 'd.code', 'payout_account.name', 'funding_account.name', 'cp.name')
    .orderBy('e.full_name', 'asc');
}

async function getEmployee(workspaceId, employeeId) {
  const employee = await knex()
    .select(
      'e.*',
      'd.name as department_name',
      'd.code as department_code',
      'payout_account.name as payout_account_name',
      'funding_account.name as funding_account_name',
      'cp.name as counterparty_name',
      knex().raw(
        "COALESCE(SUM(CASE WHEN l.status IN ('APPROVED', 'ACTIVE') THEN 1 ELSE 0 END),0)::int as active_loan_count"
      )
    )
    .from('finance_employees as e')
    .leftJoin('finance_departments as d', 'd.id', 'e.department_id')
    .leftJoin('finance_accounts as payout_account', 'payout_account.id', 'e.default_payout_account_id')
    .leftJoin('finance_accounts as funding_account', 'funding_account.id', 'e.default_funding_account_id')
    .leftJoin('finance_counterparties as cp', 'cp.id', 'e.linked_counterparty_id')
    .leftJoin('finance_employee_loans as l', 'l.employee_id', 'e.id')
    .where('e.workspace_id', workspaceId)
    .andWhere('e.id', employeeId)
    .groupBy('e.id', 'd.name', 'd.code', 'payout_account.name', 'funding_account.name', 'cp.name')
    .first();

  assert(employee, 404, 'Employee not found.');

  const activeLoan = await knex()('finance_employee_loans')
    .where({ workspace_id: workspaceId, employee_id: employeeId })
    .whereIn('status', ['APPROVED', 'ACTIVE'])
    .orderBy('id', 'desc')
    .first();

  return {
    ...employee,
    active_loan: activeLoan || null,
  };
}

async function createEmployee(workspaceId, actorUserId, payload) {
  const normalizedPayload = normalizeEmployeePayload(payload || {});
  if (normalizedPayload.join_date !== undefined) {
    if (normalizedPayload.join_date === null) {
      normalizedPayload.join_date = null;
    } else {
      const normalizedJoinDate = normalizeOptionalDateInput(normalizedPayload.join_date);
      assert(normalizedJoinDate !== null, 400, 'Invalid employee payload.', {
        fieldErrors: { join_date: ['Invalid'] },
      });
      normalizedPayload.join_date = normalizedJoinDate;
    }
  }

  const input = parseSchema(EmployeeInputSchema, normalizedPayload, 'Invalid employee payload.');
  const now = new Date().toISOString();

  const payoutAccount = await resolveAccount(workspaceId, input.default_payout_account_id);
  assert(
    payoutAccount.currency === input.payroll_currency,
    400,
    'Employee payroll currency must match default payout account currency.'
  );

  let fundingAccountId = null;
  if (input.default_funding_account_id) {
    const fundingAccount = await resolveAccount(workspaceId, input.default_funding_account_id);
    assert(
      fundingAccount.account_kind === 'CASH',
      400,
      'Employee default funding account must be a CASH account.'
    );
    fundingAccountId = fundingAccount.id;
  }

  const counterpartyId = await ensureEmployeeCounterparty(workspaceId, input.full_name);
  const employeeCode = input.employee_code || (await generateEmployeeCode(workspaceId));
  const department = await resolveDepartment(workspaceId, input.department_id, { mustBeActive: true });

  const [employee] = await knex()('finance_employees')
    .insert({
      workspace_id: workspaceId,
      employee_code: employeeCode,
      full_name: input.full_name,
      email: input.email || null,
      join_date: input.join_date || null,
      status: input.status,
      payroll_currency: input.payroll_currency,
      settlement_iban: input.settlement_iban,
      default_payout_account_id: input.default_payout_account_id,
      default_funding_account_id: fundingAccountId,
      department_id: department?.id || null,
      linked_counterparty_id: counterpartyId,
      base_salary_minor: input.base_salary_minor,
      default_allowances_minor: input.default_allowances_minor,
      default_non_loan_deductions_minor: input.default_non_loan_deductions_minor,
      notes: input.notes || null,
      created_by_user_id: actorUserId,
      created_at: now,
      updated_at: now,
    })
    .returning('*');

  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'EMPLOYEE',
    entityId: employee.id,
    action: 'CREATE',
    before: null,
    after: employee,
  });

  return getEmployee(workspaceId, employee.id);
}

async function updateEmployee(workspaceId, actorUserId, employeeId, payload) {
  const normalizedPayload = normalizeEmployeePayload(payload || {});
  if (normalizedPayload.join_date !== undefined) {
    if (normalizedPayload.join_date === null) {
      normalizedPayload.join_date = null;
    } else {
      const normalizedJoinDate = normalizeOptionalDateInput(normalizedPayload.join_date);
      assert(normalizedJoinDate !== null, 400, 'Invalid employee payload.', {
        fieldErrors: { join_date: ['Invalid'] },
      });
      normalizedPayload.join_date = normalizedJoinDate;
    }
  }

  const input = parseSchema(EmployeeUpdateSchema, normalizedPayload, 'Invalid employee payload.');
  const existing = await knex()('finance_employees').where({ workspace_id: workspaceId, id: employeeId }).first();
  assert(existing, 404, 'Employee not found.');

  const updates = {};

  if (input.full_name !== undefined && input.full_name !== existing.full_name) {
    updates.full_name = input.full_name;
    updates.linked_counterparty_id = await ensureEmployeeCounterparty(workspaceId, input.full_name);
  }

  if (input.default_payout_account_id !== undefined) {
    const payoutAccount = await resolveAccount(workspaceId, input.default_payout_account_id);
    const expectedCurrency = input.payroll_currency || existing.payroll_currency;
    assert(
      payoutAccount.currency === expectedCurrency,
      400,
      'Employee payroll currency must match default payout account currency.'
    );
    updates.default_payout_account_id = input.default_payout_account_id;
  }

  if (input.payroll_currency !== undefined) {
    const payoutAccount = await resolveAccount(
      workspaceId,
      updates.default_payout_account_id || existing.default_payout_account_id
    );
    assert(
      payoutAccount.currency === input.payroll_currency,
      400,
      'Employee payroll currency must match default payout account currency.'
    );
    updates.payroll_currency = input.payroll_currency;
  }

  if (input.default_funding_account_id !== undefined) {
    if (input.default_funding_account_id === null) {
      updates.default_funding_account_id = null;
    } else {
      const fundingAccount = await resolveAccount(workspaceId, input.default_funding_account_id);
      assert(
        fundingAccount.account_kind === 'CASH',
        400,
        'Employee default funding account must be a CASH account.'
      );
      updates.default_funding_account_id = input.default_funding_account_id;
    }
  }

  if (input.department_id !== undefined) {
    if (input.department_id === null) {
      updates.department_id = null;
    } else {
      const department = await resolveDepartment(workspaceId, input.department_id, { mustBeActive: true });
      updates.department_id = department.id;
    }
  }

  if (input.employee_code !== undefined) updates.employee_code = input.employee_code;
  if (input.email !== undefined) updates.email = input.email;
  if (input.join_date !== undefined) updates.join_date = input.join_date;
  if (input.status !== undefined) updates.status = input.status;
  if (input.settlement_iban !== undefined) updates.settlement_iban = input.settlement_iban;
  if (input.base_salary_minor !== undefined) updates.base_salary_minor = input.base_salary_minor;
  if (input.default_allowances_minor !== undefined) {
    updates.default_allowances_minor = input.default_allowances_minor;
  }
  if (input.default_non_loan_deductions_minor !== undefined) {
    updates.default_non_loan_deductions_minor = input.default_non_loan_deductions_minor;
  }
  if (input.notes !== undefined) updates.notes = input.notes;

  assert(Object.keys(updates).length > 0, 400, 'No valid employee fields provided.');

  updates.updated_at = new Date().toISOString();

  const [employee] = await knex()('finance_employees')
    .where({ workspace_id: workspaceId, id: employeeId })
    .update(updates)
    .returning('*');

  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'EMPLOYEE',
    entityId: employee.id,
    action: 'UPDATE',
    before: existing,
    after: employee,
  });

  return getEmployee(workspaceId, employee.id);
}

async function deleteEmployee(workspaceId, actorUserId, employeeId) {
  const existing = await knex()('finance_employees').where({ workspace_id: workspaceId, id: employeeId }).first();
  assert(existing, 404, 'Employee not found.');

  const [employee] = await knex()('finance_employees')
    .where({ workspace_id: workspaceId, id: employeeId })
    .update({ status: 'INACTIVE', updated_at: new Date().toISOString() })
    .returning('*');

  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'EMPLOYEE',
    entityId: employee.id,
    action: 'SOFT_DELETE',
    before: existing,
    after: employee,
  });

  return { deleted: false, soft_deleted: true, employee };
}

async function listPayrollRuns(workspaceId, filters = {}) {
  const query = knex()
    .select(
      'r.*',
      knex().raw('COUNT(e.id)::int as entries_count'),
      knex().raw('COALESCE(SUM(e.net_paid_minor), 0)::bigint as total_net_paid_minor'),
      knex().raw('COALESCE(SUM(e.actual_loan_deduction_minor), 0)::bigint as total_loan_deduction_minor')
    )
    .from('finance_payroll_runs as r')
    .leftJoin('finance_payroll_entries as e', 'e.payroll_run_id', 'r.id')
    .where('r.workspace_id', workspaceId)
    .groupBy('r.id')
    .orderBy('r.period_month', 'desc');

  if (filters.month) {
    query.andWhere('r.period_month', String(filters.month));
  }

  if (filters.status) {
    query.andWhere('r.status', String(filters.status));
  }

  return query;
}

async function getPayrollRun(workspaceId, payrollRunId) {
  const run = await knex()('finance_payroll_runs').where({ workspace_id: workspaceId, id: payrollRunId }).first();
  assert(run, 404, 'Payroll run not found.');

  const entries = await knex()
    .select(
      'e.*',
      'emp.employee_code',
      'emp.full_name',
      'emp.department_id',
      'dept.name as department_name',
      'dept.code as department_code',
      'emp.default_payout_account_id',
      'emp.default_funding_account_id',
      'default_payout_account.name as payout_account_name',
      'default_funding_account.name as funding_account_name',
      'payout_from_account.name as payout_from_account_name',
      'payout_to_account.name as payout_to_account_name',
      'l.status as loan_status',
      'l.installment_minor as loan_installment_minor',
      'l.outstanding_principal_minor as loan_outstanding_principal_minor'
    )
    .from('finance_payroll_entries as e')
    .innerJoin('finance_employees as emp', 'emp.id', 'e.employee_id')
    .leftJoin('finance_departments as dept', 'dept.id', 'emp.department_id')
    .leftJoin('finance_accounts as default_payout_account', 'default_payout_account.id', 'emp.default_payout_account_id')
    .leftJoin('finance_accounts as default_funding_account', 'default_funding_account.id', 'emp.default_funding_account_id')
    .leftJoin('finance_accounts as payout_from_account', 'payout_from_account.id', 'e.payout_from_account_id')
    .leftJoin('finance_accounts as payout_to_account', 'payout_to_account.id', 'e.payout_to_account_id')
    .leftJoin('finance_employee_loans as l', 'l.id', 'e.loan_id')
    .where('e.payroll_run_id', payrollRunId)
    .orderBy('emp.full_name', 'asc');

  const entryIds = entries.map((entry) => entry.id);
  const components = entryIds.length
    ? await knex()('finance_payroll_components')
        .whereIn('payroll_entry_id', entryIds)
        .orderBy('sort_order', 'asc')
        .orderBy('id', 'asc')
    : [];

  const byEntryId = components.reduce((map, component) => {
    const key = Number(component.payroll_entry_id);
    if (!map[key]) {
      map[key] = [];
    }
    map[key].push(component);
    return map;
  }, {});

  return {
    ...run,
    entries: entries.map((entry) => {
      const {
        loan_installment_minor: loanInstallmentMinor,
        loan_outstanding_principal_minor: loanOutstandingPrincipalMinor,
        ...entryData
      } = entry;
      const autoLoanDeductionMinor = computeAutoLoanDeductionMinor(
        {
          status: entry.loan_status,
          installment_minor: loanInstallmentMinor,
          outstanding_principal_minor: loanOutstandingPrincipalMinor,
        },
        entry.base_salary_minor
      );
      return {
        ...entryData,
        auto_loan_deduction_minor: autoLoanDeductionMinor,
        components: byEntryId[entry.id] || [],
      };
    }),
  };
}

async function syncPayrollComponents(payrollEntryId, data) {
  await knex()('finance_payroll_components').where({ payroll_entry_id: payrollEntryId }).delete();

  const components = [
    {
      payroll_entry_id: payrollEntryId,
      component_type: 'EARNING',
      component_code: 'BASE_SALARY',
      label: 'Base Salary',
      amount_minor: toSafeMinor(data.base_salary_minor),
      is_system: true,
      sort_order: 10,
      created_at: new Date().toISOString(),
    },
    {
      payroll_entry_id: payrollEntryId,
      component_type: 'EARNING',
      component_code: 'ALLOWANCES',
      label: 'Allowances',
      amount_minor: toSafeMinor(data.allowances_minor),
      is_system: true,
      sort_order: 20,
      created_at: new Date().toISOString(),
    },
    {
      payroll_entry_id: payrollEntryId,
      component_type: 'DEDUCTION',
      component_code: 'NON_LOAN_DEDUCTIONS',
      label: 'Non-loan deductions',
      amount_minor: toSafeMinor(data.non_loan_deductions_minor),
      is_system: true,
      sort_order: 30,
      created_at: new Date().toISOString(),
    },
    {
      payroll_entry_id: payrollEntryId,
      component_type: 'DEDUCTION',
      component_code: 'PLANNED_LOAN_DEDUCTION',
      label: 'Planned loan deduction',
      amount_minor: toSafeMinor(data.planned_loan_deduction_minor),
      is_system: true,
      sort_order: 40,
      created_at: new Date().toISOString(),
    },
    {
      payroll_entry_id: payrollEntryId,
      component_type: 'INFO',
      component_code: 'NET_PAID',
      label: 'Net paid',
      amount_minor: toSafeMinor(data.net_paid_minor),
      is_system: true,
      sort_order: 50,
      created_at: new Date().toISOString(),
    },
  ];

  await knex()('finance_payroll_components').insert(components);
}

async function ensureDueSchedulesForLoan(workspaceId, actorUserId, loan, upToDate) {
  if (!loan || !['ACTIVE', 'APPROVED'].includes(String(loan.status))) {
    return loan;
  }

  let currentLoan = { ...loan };
  if (!currentLoan.next_due_date) {
    return currentLoan;
  }

  const cutoffDate = dayjs(upToDate);
  let dueDateCursor = dayjs(currentLoan.next_due_date);

  while (
    dueDateCursor.isValid() &&
    (dueDateCursor.isBefore(cutoffDate) || dueDateCursor.isSame(cutoffDate)) &&
    Number(currentLoan.outstanding_principal_minor) > 0
  ) {
    const dueDate = dueDateCursor.format('YYYY-MM-DD');

    const existing = await knex()('finance_loan_schedules')
      .where({ loan_id: currentLoan.id, due_date: dueDate })
      .first();

    let addedInterest = 0;
    if (!existing) {
      const maxRow = await knex()('finance_loan_schedules').where({ loan_id: currentLoan.id }).max('installment_no as max_installment').first();
      const installmentNo = Number(maxRow?.max_installment || 0) + 1;
      const principalDue = Math.min(
        toSafeMinor(currentLoan.installment_minor),
        toSafeMinor(currentLoan.outstanding_principal_minor)
      );

      const interestDue = calculateMonthlyInterestMinor(
        toSafeMinor(currentLoan.outstanding_principal_minor),
        Number(currentLoan.annual_interest_bps || 0)
      );

      await knex()('finance_loan_schedules').insert({
        loan_id: currentLoan.id,
        installment_no: installmentNo,
        due_date: dueDate,
        principal_due_minor: principalDue,
        interest_due_minor: interestDue,
        principal_paid_minor: 0,
        interest_paid_minor: 0,
        status: 'DUE',
        linked_payroll_entry_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      addedInterest = interestDue;
    }

    dueDateCursor = dueDateCursor.add(1, 'month');

    const [updatedLoan] = await knex()('finance_employee_loans')
      .where({ id: currentLoan.id })
      .update({
        next_due_date: dueDateCursor.format('YYYY-MM-DD'),
        outstanding_interest_minor: toSafeMinor(currentLoan.outstanding_interest_minor) + toSafeMinor(addedInterest),
        updated_at: new Date().toISOString(),
      })
      .returning('*');

    currentLoan = updatedLoan;

    await addAuditLog({
      workspaceId,
      actorUserId,
      entityType: 'EMPLOYEE_LOAN',
      entityId: currentLoan.id,
      action: 'SCHEDULE_ADVANCE',
      before: loan,
      after: currentLoan,
    });
  }

  return currentLoan;
}

async function getOpenLoanRows(loanId, asOfDate) {
  return knex()('finance_loan_schedules')
    .where({ loan_id: loanId })
    .whereIn('status', ['DUE', 'PARTIAL'])
    .andWhere('due_date', '<=', asOfDate)
    .orderBy('due_date', 'asc')
    .orderBy('installment_no', 'asc');
}

function computeAutoLoanDeductionMinor(loan, baseSalaryMinor) {
  if (!loan || !['ACTIVE', 'APPROVED'].includes(String(loan.status))) {
    return 0;
  }

  const installmentMinor = toSafeMinor(loan.installment_minor);
  const outstandingPrincipalMinor = toSafeMinor(loan.outstanding_principal_minor);
  const baseMinor = toSafeMinor(baseSalaryMinor);

  return Math.min(installmentMinor, outstandingPrincipalMinor, baseMinor);
}

async function getLoanPlannedDeductionMinor(workspaceId, actorUserId, loan, asOfDate, baseSalaryMinor) {
  const refreshed = await ensureDueSchedulesForLoan(workspaceId, actorUserId, loan, asOfDate);
  const plannedLoanDeductionMinor = computeAutoLoanDeductionMinor(refreshed, baseSalaryMinor);

  return {
    loan: refreshed,
    planned_loan_deduction_minor: plannedLoanDeductionMinor,
  };
}

async function createPayrollRun(workspaceId, actorUserId, payload) {
  const normalizedPayload = { ...(payload || {}) };
  if (!normalizedPayload.payday_date && normalizedPayload.period_month) {
    const autoDate = lastFridayOfMonth(String(normalizedPayload.period_month));
    if (autoDate) {
      normalizedPayload.payday_date = autoDate;
      normalizedPayload.cutoff_date = autoDate;
    }
  }

  const input = parseSchema(PayrollRunCreateSchema, normalizedPayload, 'Invalid payroll run payload.');
  const canonicalRunDate = lastFridayOfMonth(input.period_month);
  assert(canonicalRunDate, 400, 'Invalid payroll run payload.', {
    fieldErrors: { period_month: ['Invalid'] },
  });

  const existing = await knex()('finance_payroll_runs')
    .where({ workspace_id: workspaceId, period_month: input.period_month })
    .first();
  assert(!existing, 409, 'Payroll run already exists for this month.');

  const now = new Date().toISOString();
  const [run] = await knex()('finance_payroll_runs')
    .insert({
      workspace_id: workspaceId,
      period_month: input.period_month,
      cutoff_date: canonicalRunDate,
      payday_date: canonicalRunDate,
      status: 'DRAFT',
      approved_by_user_id: null,
      approved_at: null,
      paid_at: null,
      created_by_user_id: actorUserId,
      created_at: now,
      updated_at: now,
    })
    .returning('*');

  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'PAYROLL_RUN',
    entityId: run.id,
    action: 'CREATE',
    before: null,
    after: run,
  });

  return getPayrollRun(workspaceId, run.id);
}

async function deletePayrollRun(workspaceId, actorUserId, payrollRunId) {
  const existing = await knex()('finance_payroll_runs').where({ workspace_id: workspaceId, id: payrollRunId }).first();
  assert(existing, 404, 'Payroll run not found.');
  assert(existing.status !== 'PAID', 409, 'Paid payroll runs cannot be deleted.');

  const entries = await knex()('finance_payroll_entries')
    .select(
      'id',
      'status',
      'salary_expense_transaction_id',
      'loan_principal_repayment_transaction_id',
      'loan_interest_income_transaction_id',
      'payout_transfer_transaction_id',
      'payout_transfer_fee_transaction_id'
    )
    .where({ workspace_id: workspaceId, payroll_run_id: payrollRunId });

  const hasPostedTransactions = entries.some((entry) => {
    return Boolean(
      entry.salary_expense_transaction_id
      || entry.loan_principal_repayment_transaction_id
      || entry.loan_interest_income_transaction_id
      || entry.payout_transfer_transaction_id
      || entry.payout_transfer_fee_transaction_id
    );
  });

  assert(
    !hasPostedTransactions,
    409,
    'Payroll run has posted transactions and cannot be deleted.'
  );

  const entryIds = entries.map((entry) => Number(entry.id));
  if (entryIds.length > 0) {
    const repaymentCountRow = await knex()('finance_loan_repayments')
      .where({ workspace_id: workspaceId })
      .whereIn('linked_payroll_entry_id', entryIds)
      .count('* as count')
      .first();
    const repaymentCount = Number(repaymentCountRow?.count || 0);
    assert(
      repaymentCount === 0,
      409,
      'Payroll run has linked loan repayments and cannot be deleted.'
    );
  }

  await knex()('finance_payroll_runs').where({ workspace_id: workspaceId, id: payrollRunId }).delete();

  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'PAYROLL_RUN',
    entityId: payrollRunId,
    action: 'DELETE',
    before: {
      ...existing,
      entries_count: entries.length,
    },
    after: null,
  });

  return {
    deleted: true,
    payroll_run_id: payrollRunId,
    entries_deleted: entries.length,
  };
}

async function generatePayrollRunEntries(workspace, actorUserId, payrollRunId) {
  let run = await knex()('finance_payroll_runs').where({ workspace_id: workspace.id, id: payrollRunId }).first();
  assert(run, 404, 'Payroll run not found.');
  assert(run.status !== 'PAID', 409, 'Paid payroll runs cannot be regenerated.');
  const canonicalRunDate = lastFridayOfMonth(run.period_month);
  assert(canonicalRunDate, 400, 'Payroll run has invalid period month.');

  if (run.cutoff_date !== canonicalRunDate || run.payday_date !== canonicalRunDate) {
    const [normalizedRun] = await knex()('finance_payroll_runs')
      .where({ id: run.id, workspace_id: workspace.id })
      .update({
        cutoff_date: canonicalRunDate,
        payday_date: canonicalRunDate,
        updated_at: new Date().toISOString(),
      })
      .returning('*');
    run = normalizedRun;
  }

  const employees = await knex()('finance_employees')
    .where({ workspace_id: workspace.id, status: 'ACTIVE' })
    .orderBy('full_name', 'asc');

  const createdOrUpdated = [];

  for (const employee of employees) {
    const existingEntry = await knex()('finance_payroll_entries')
      .where({ payroll_run_id: run.id, employee_id: employee.id })
      .first();

    const baseSalaryMinor = existingEntry ? existingEntry.base_salary_minor : employee.base_salary_minor;
    const allowancesMinor = existingEntry ? existingEntry.allowances_minor : employee.default_allowances_minor;
    const nonLoanDeductionsMinor = existingEntry
      ? existingEntry.non_loan_deductions_minor
      : employee.default_non_loan_deductions_minor;

    let activeLoan = await knex()('finance_employee_loans')
      .where({ workspace_id: workspace.id, employee_id: employee.id })
      .whereIn('status', ['ACTIVE', 'APPROVED'])
      .orderBy('id', 'desc')
      .first();

    let plannedLoanDeduction = 0;
    if (activeLoan) {
      const loanCalc = await getLoanPlannedDeductionMinor(
        workspace.id,
        actorUserId,
        activeLoan,
        canonicalRunDate,
        baseSalaryMinor
      );
      activeLoan = loanCalc.loan;
      plannedLoanDeduction = loanCalc.planned_loan_deduction_minor;
    }

    const amounts = computePayrollAmounts({
      baseSalaryMinor,
      allowancesMinor,
      nonLoanDeductionsMinor,
      plannedLoanDeductionMinor: plannedLoanDeduction,
    });

    const payload = {
      workspace_id: workspace.id,
      payroll_run_id: run.id,
      employee_id: employee.id,
      loan_id: activeLoan?.id || null,
      currency: employee.payroll_currency,
      base_salary_minor: baseSalaryMinor,
      allowances_minor: allowancesMinor,
      non_loan_deductions_minor: nonLoanDeductionsMinor,
      planned_loan_deduction_minor: plannedLoanDeduction,
      actual_loan_deduction_minor: 0,
      net_paid_minor: amounts.net_paid_minor,
      status: run.status === 'APPROVED' ? 'APPROVED' : 'DRAFT',
      salary_expense_transaction_id: null,
      loan_principal_repayment_transaction_id: null,
      loan_interest_income_transaction_id: null,
      payout_from_account_id: null,
      payout_to_account_id: null,
      payout_from_amount_minor: null,
      payout_from_currency: null,
      payout_to_amount_minor: null,
      payout_to_currency: null,
      payout_fx_rate: null,
      payout_transfer_transaction_id: null,
      payout_transfer_fee_transaction_id: null,
      payout_additional_fee_total_minor: 0,
      payout_additional_fee_count: 0,
      updated_at: new Date().toISOString(),
    };

    let entry;
    if (existingEntry) {
      [entry] = await knex()('finance_payroll_entries')
        .where({ id: existingEntry.id })
        .update(payload)
        .returning('*');
    } else {
      [entry] = await knex()('finance_payroll_entries')
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
        })
        .returning('*');
    }

    await syncPayrollComponents(entry.id, {
      ...payload,
      net_paid_minor: amounts.net_paid_minor,
    });

    createdOrUpdated.push(entry.id);
  }

  await addAuditLog({
    workspaceId: workspace.id,
    actorUserId,
    entityType: 'PAYROLL_RUN',
    entityId: run.id,
    action: 'GENERATE_ENTRIES',
    before: run,
    after: { generated_entry_ids: createdOrUpdated },
  });

  return getPayrollRun(workspace.id, run.id);
}

async function updatePayrollEntry(workspaceId, actorUserId, payrollRunId, entryId, payload) {
  const input = parseSchema(PayrollEntryUpdateSchema, payload, 'Invalid payroll entry update payload.');

  const run = await knex()('finance_payroll_runs').where({ workspace_id: workspaceId, id: payrollRunId }).first();
  assert(run, 404, 'Payroll run not found.');
  assert(run.status !== 'PAID', 409, 'Paid payroll runs cannot be edited.');

  const existing = await knex()('finance_payroll_entries')
    .where({ workspace_id: workspaceId, payroll_run_id: payrollRunId, id: entryId })
    .first();
  assert(existing, 404, 'Payroll entry not found.');

  const baseSalaryMinor = input.base_salary_minor ?? existing.base_salary_minor;
  const allowancesMinor = input.allowances_minor ?? existing.allowances_minor;
  const nonLoanDeductionsMinor = input.non_loan_deductions_minor ?? existing.non_loan_deductions_minor;
  let plannedLoanDeductionMinor = input.planned_loan_deduction_minor ?? existing.planned_loan_deduction_minor;

  const activeLoan = existing.loan_id
    ? await knex()('finance_employee_loans')
        .where({ workspace_id: workspaceId, id: existing.loan_id, employee_id: existing.employee_id })
        .whereIn('status', ['ACTIVE', 'APPROVED'])
        .first()
    : null;

  if (activeLoan) {
    const autoLoanDeductionMinor = computeAutoLoanDeductionMinor(activeLoan, baseSalaryMinor);
    plannedLoanDeductionMinor = Math.min(toSafeMinor(plannedLoanDeductionMinor), autoLoanDeductionMinor);
  } else {
    plannedLoanDeductionMinor = 0;
  }

  const amounts = computePayrollAmounts({
    baseSalaryMinor,
    allowancesMinor,
    nonLoanDeductionsMinor,
    plannedLoanDeductionMinor,
  });

  const [entry] = await knex()('finance_payroll_entries')
    .where({ id: existing.id })
    .update({
      base_salary_minor: baseSalaryMinor,
      allowances_minor: allowancesMinor,
      non_loan_deductions_minor: nonLoanDeductionsMinor,
      planned_loan_deduction_minor: plannedLoanDeductionMinor,
      net_paid_minor: amounts.net_paid_minor,
      updated_at: new Date().toISOString(),
    })
    .returning('*');

  await syncPayrollComponents(entry.id, entry);

  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'PAYROLL_ENTRY',
    entityId: entry.id,
    action: 'UPDATE',
    before: existing,
    after: entry,
  });

  return entry;
}

async function approvePayrollRun(workspaceId, actorUserId, payrollRunId) {
  const existing = await knex()('finance_payroll_runs').where({ workspace_id: workspaceId, id: payrollRunId }).first();
  assert(existing, 404, 'Payroll run not found.');
  assert(existing.status !== 'PAID', 409, 'Payroll run already paid.');

  const now = new Date().toISOString();

  const [run] = await knex()('finance_payroll_runs')
    .where({ id: payrollRunId })
    .update({
      status: 'APPROVED',
      approved_by_user_id: actorUserId,
      approved_at: now,
      updated_at: now,
    })
    .returning('*');

  await knex()('finance_payroll_entries')
    .where({ payroll_run_id: payrollRunId })
    .andWhereNot({ status: 'PAID' })
    .update({ status: 'APPROVED', updated_at: now });

  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'PAYROLL_RUN',
    entityId: run.id,
    action: 'APPROVE',
    before: existing,
    after: run,
  });

  return getPayrollRun(workspaceId, payrollRunId);
}

async function applyLoanPayment({
  workspace,
  actorUserId,
  loan,
  amountMinor,
  repaymentDate,
  source,
  linkedPayrollEntryId,
  cashAccountId,
  payrollRunId,
}) {
  let currentLoan = await ensureDueSchedulesForLoan(workspace.id, actorUserId, loan, repaymentDate);
  let openRows = await getOpenLoanRows(currentLoan.id, repaymentDate);

  if (openRows.length === 0 && toSafeMinor(currentLoan.outstanding_principal_minor) > 0) {
    const maxRow = await knex()('finance_loan_schedules').where({ loan_id: currentLoan.id }).max('installment_no as max_installment').first();
    const installmentNo = Number(maxRow?.max_installment || 0) + 1;
    const principalDue = Math.min(toSafeMinor(amountMinor), toSafeMinor(currentLoan.outstanding_principal_minor));
    const interestDue = calculateMonthlyInterestMinor(
      toSafeMinor(currentLoan.outstanding_principal_minor),
      Number(currentLoan.annual_interest_bps || 0)
    );

    await knex()('finance_loan_schedules').insert({
      loan_id: currentLoan.id,
      installment_no: installmentNo,
      due_date: repaymentDate,
      principal_due_minor: principalDue,
      interest_due_minor: interestDue,
      principal_paid_minor: 0,
      interest_paid_minor: 0,
      status: 'DUE',
      linked_payroll_entry_id: linkedPayrollEntryId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const [loanWithInterest] = await knex()('finance_employee_loans')
      .where({ id: currentLoan.id })
      .update({
        outstanding_interest_minor: toSafeMinor(currentLoan.outstanding_interest_minor) + toSafeMinor(interestDue),
        updated_at: new Date().toISOString(),
      })
      .returning('*');
    currentLoan = loanWithInterest;
    openRows = await getOpenLoanRows(currentLoan.id, repaymentDate);
  }

  const allocation =
    source === 'PAYROLL'
      ? allocateLoanPrincipalOnlyPayment(openRows, amountMinor)
      : allocateLoanPayment(openRows, amountMinor);
  const principalPaid = toSafeMinor(allocation.principal_paid_minor);
  const interestPaid = toSafeMinor(allocation.interest_paid_minor);
  const totalPaid = principalPaid + interestPaid;
  assert(totalPaid > 0, 409, 'No due loan amount available for repayment on the selected date.');

  const cashAccount = await resolveAccount(workspace.id, cashAccountId);
  assert(cashAccount.currency === currentLoan.currency, 400, 'Repayment cash account currency must match loan currency.');

  const uncategorizedCategoryId = await getUncategorizedCategoryId(workspace.id);
  const loanInterestCategoryId =
    interestPaid > 0 ? await getCategoryIdByName(workspace.id, 'Loan Interest') : null;

  let principalTransferTx = null;
  let interestIncomeTx = null;

  if (principalPaid > 0) {
    principalTransferTx = await createTransaction(workspace, actorUserId, {
      type: 'TRANSFER',
      date: repaymentDate,
      description:
        source === 'PAYROLL'
          ? `Loan principal recovery via payroll for loan #${currentLoan.id}`
          : `Manual loan principal repayment for loan #${currentLoan.id}`,
      from_account_id: Number(currentLoan.receivable_control_account_id),
      to_account_id: Number(cashAccount.id),
      from_amount_minor: Number(principalPaid),
      from_currency: currentLoan.currency,
      to_amount_minor: Number(principalPaid),
      to_currency: currentLoan.currency,
      category_id: Number(uncategorizedCategoryId),
      source: 'WEB',
      status: 'APPROVED',
      metadata: {
        link_type: 'LOAN_REPAYMENT_PRINCIPAL',
        employee_id: currentLoan.employee_id,
        loan_id: currentLoan.id,
        payroll_run_id: payrollRunId || null,
        payroll_entry_id: linkedPayrollEntryId || null,
      },
    });
  }

  if (interestPaid > 0) {
    interestIncomeTx = await createTransaction(workspace, actorUserId, {
      type: 'INCOME',
      date: repaymentDate,
      amount_minor: Number(interestPaid),
      currency: currentLoan.currency,
      account_id: Number(cashAccount.id),
      description:
        source === 'PAYROLL'
          ? `Loan interest recovery via payroll for loan #${currentLoan.id}`
          : `Manual loan interest repayment for loan #${currentLoan.id}`,
      category_id: Number(loanInterestCategoryId),
      counterparty_id: null,
      source: 'WEB',
      status: 'APPROVED',
      metadata: {
        link_type: 'LOAN_REPAYMENT_INTEREST',
        employee_id: currentLoan.employee_id,
        loan_id: currentLoan.id,
        payroll_run_id: payrollRunId || null,
        payroll_entry_id: linkedPayrollEntryId || null,
      },
    });
  }

  for (const row of allocation.updated_rows) {
    await knex()('finance_loan_schedules')
      .where({ id: row.id })
      .update({
        principal_paid_minor: row.principal_paid_minor,
        interest_paid_minor: row.interest_paid_minor,
        status: row.status,
        linked_payroll_entry_id: linkedPayrollEntryId || row.linked_payroll_entry_id || null,
        updated_at: new Date().toISOString(),
      });
  }

  const [updatedLoan] = await knex()('finance_employee_loans')
    .where({ id: currentLoan.id })
    .update({
      outstanding_principal_minor: Math.max(
        toSafeMinor(currentLoan.outstanding_principal_minor) - principalPaid,
        0
      ),
      outstanding_interest_minor: Math.max(toSafeMinor(currentLoan.outstanding_interest_minor) - interestPaid, 0),
      status:
        Math.max(toSafeMinor(currentLoan.outstanding_principal_minor) - principalPaid, 0) === 0 &&
        Math.max(toSafeMinor(currentLoan.outstanding_interest_minor) - interestPaid, 0) === 0
          ? 'CLOSED'
          : 'ACTIVE',
      updated_at: new Date().toISOString(),
    })
    .returning('*');

  const [repayment] = await knex()('finance_loan_repayments')
    .insert({
      workspace_id: workspace.id,
      loan_id: currentLoan.id,
      employee_id: currentLoan.employee_id,
      repayment_date: repaymentDate,
      source,
      principal_paid_minor: principalPaid,
      interest_paid_minor: interestPaid,
      total_paid_minor: totalPaid,
      principal_transfer_transaction_id: principalTransferTx?.id || null,
      interest_income_transaction_id: interestIncomeTx?.id || null,
      linked_payroll_entry_id: linkedPayrollEntryId || null,
      created_by_user_id: actorUserId,
      created_at: new Date().toISOString(),
    })
    .returning('*');

  await addAuditLog({
    workspaceId: workspace.id,
    actorUserId,
    entityType: 'LOAN_REPAYMENT',
    entityId: repayment.id,
    action: 'CREATE',
    before: null,
    after: repayment,
  });

  await addAuditLog({
    workspaceId: workspace.id,
    actorUserId,
    entityType: 'EMPLOYEE_LOAN',
    entityId: updatedLoan.id,
    action: 'REPAY',
    before: currentLoan,
    after: updatedLoan,
  });

  return {
    updated_loan: updatedLoan,
    repayment,
    principal_transfer_transaction: principalTransferTx,
    interest_income_transaction: interestIncomeTx,
    principal_paid_minor: principalPaid,
    interest_paid_minor: interestPaid,
  };
}

async function payPayrollRun(workspace, actorUserId, payrollRunId, payload) {
  const input = parseSchema(PayrollPayActionSchema, payload || {}, 'Invalid payroll pay payload.');

  const run = await knex()('finance_payroll_runs').where({ workspace_id: workspace.id, id: payrollRunId }).first();
  assert(run, 404, 'Payroll run not found.');
  assert(run.status === 'APPROVED', 409, 'Payroll run must be approved before payment.');

  const entriesQuery = knex()('finance_payroll_entries')
    .where({ workspace_id: workspace.id, payroll_run_id: payrollRunId })
    .whereIn('status', ['APPROVED', 'DRAFT']);

  if (Array.isArray(input.entry_ids) && input.entry_ids.length > 0) {
    entriesQuery.whereIn('id', input.entry_ids);
  }

  const entries = await entriesQuery.orderBy('id', 'asc');
  assert(entries.length > 0, 400, 'No payable payroll entries found.');

  const payrollCategoryId = await getCategoryIdByName(workspace.id, 'Payroll');
  const transferFeesCategoryId = await getCategoryIdByName(workspace.id, 'Transfer Fees');
  const uncategorizedCategoryId = await getUncategorizedCategoryId(workspace.id);
  const paymentDate = input.payment_date || run.payday_date;
  const entryPaymentMap = new Map(
    (input.entry_payments || []).map((row) => [Number(row.entry_id), row])
  );

  const processedEntries = [];

  for (const entry of entries) {
    const employee = await knex()('finance_employees')
      .where({ workspace_id: workspace.id, id: entry.employee_id })
      .first();
    assert(employee, 400, `Employee ${entry.employee_id} not found for payroll entry ${entry.id}.`);

    const amounts = computePayrollAmounts({
      baseSalaryMinor: entry.base_salary_minor,
      allowancesMinor: entry.allowances_minor,
      nonLoanDeductionsMinor: entry.non_loan_deductions_minor,
      plannedLoanDeductionMinor: entry.planned_loan_deduction_minor,
    });

    const paymentInput = entryPaymentMap.get(Number(entry.id)) || {};
    const payoutToAccountId = Number(
      paymentInput.to_account_id || input.default_to_account_id || employee.default_payout_account_id
    );
    const payoutToAccount = await resolveAccount(workspace.id, payoutToAccountId);
    assert(
      payoutToAccount.currency === entry.currency,
      400,
      `Payroll payout destination account currency must match payroll currency for entry ${entry.id}.`
    );

    const payoutFromAccountId = paymentInput.from_account_id
      || input.default_from_account_id
      || employee.default_funding_account_id
      || null;
    const payoutFromAccount = payoutFromAccountId
      ? await resolveAccount(workspace.id, Number(payoutFromAccountId))
      : null;

    if (payoutFromAccount) {
      assert(
        payoutFromAccount.account_kind === 'CASH',
        400,
        `Payroll funding account must be a CASH account for entry ${entry.id}.`
      );
    }

    const payoutToAmountMinor = Number(paymentInput.to_amount_minor || amounts.net_paid_minor);
    const payoutToCurrency = paymentInput.to_currency || entry.currency;
    assert(
      payoutToAmountMinor === Number(amounts.net_paid_minor),
      400,
      `payout to_amount_minor must equal computed net pay for payroll entry ${entry.id}.`
    );
    assert(
      payoutToCurrency === entry.currency,
      400,
      `payout to_currency must match payroll entry currency for payroll entry ${entry.id}.`
    );

    const shouldCreatePayoutTransfer =
      payoutToAmountMinor > 0
      && Boolean(payoutFromAccount)
      && Number(payoutFromAccount.id) !== Number(payoutToAccount.id);

    let payoutTransferTx = null;
    let payoutTransferFeeTxId = null;
    let payoutFromAmountMinor = null;
    let payoutFromCurrency = null;
    let payoutFxRate = null;

    if (shouldCreatePayoutTransfer) {
      const fromCurrency = paymentInput.from_currency || payoutFromAccount.currency;
      assert(
        fromCurrency === payoutFromAccount.currency,
        400,
        `payout from_currency must match selected funding account currency for payroll entry ${entry.id}.`
      );

      let fromAmountMinor;
      let fxRate = null;

      if (fromCurrency === payoutToCurrency) {
        fromAmountMinor = Number(paymentInput.from_amount_minor || payoutToAmountMinor);
        assert(
          fromAmountMinor === payoutToAmountMinor,
          400,
          `Same-currency payroll payout must use equal from/to amounts for payroll entry ${entry.id}.`
        );
      } else {
        assert(
          paymentInput.from_amount_minor,
          400,
          `Cross-currency payroll payout requires from_amount_minor for payroll entry ${entry.id}.`
        );
        assert(paymentInput.fx_rate, 400, `Cross-currency payroll payout requires fx_rate for payroll entry ${entry.id}.`);
        fromAmountMinor = Number(paymentInput.from_amount_minor);
        fxRate = Number(paymentInput.fx_rate);
      }

      const transferFeeMinor = Number(paymentInput.transfer_fee_amount_minor || 0);
      const transferFeeCurrency = transferFeeMinor > 0
        ? paymentInput.transfer_fee_currency || fromCurrency
        : null;

      if (transferFeeMinor > 0) {
        assert(
          transferFeeCurrency === fromCurrency,
          400,
          `Transfer fee currency must match payout source currency for payroll entry ${entry.id}.`
        );
      }

      payoutTransferTx = await createTransaction(workspace, actorUserId, {
        type: 'TRANSFER',
        date: paymentDate,
        description: `Payroll payout transfer for ${employee.full_name} (${run.period_month})`,
        from_account_id: Number(payoutFromAccount.id),
        to_account_id: Number(payoutToAccount.id),
        from_amount_minor: Number(fromAmountMinor),
        from_currency: fromCurrency,
        to_amount_minor: Number(payoutToAmountMinor),
        to_currency: payoutToCurrency,
        fx_rate: fxRate || undefined,
        fee_amount_minor: transferFeeMinor > 0 ? transferFeeMinor : undefined,
        fee_currency: transferFeeMinor > 0 ? transferFeeCurrency : undefined,
        fee_category_id:
          transferFeeMinor > 0
            ? Number(paymentInput.transfer_fee_category_id || transferFeesCategoryId)
            : undefined,
        fee_fx_rate_to_base:
          transferFeeMinor > 0 ? paymentInput.transfer_fee_fx_rate_to_base || undefined : undefined,
        fee_description:
          transferFeeMinor > 0
            ? paymentInput.transfer_fee_description
                || `Payroll payout transfer fee for ${employee.full_name} (${run.period_month})`
            : undefined,
        category_id: Number(uncategorizedCategoryId),
        source: 'WEB',
        status: 'APPROVED',
        metadata: {
          link_type: 'PAYROLL_PAYOUT_TRANSFER',
          employee_id: employee.id,
          payroll_run_id: run.id,
          payroll_entry_id: entry.id,
          salary_currency: entry.currency,
        },
      });

      const transferMetadata = normalizeJsonObject(payoutTransferTx.metadata_json);
      payoutTransferFeeTxId = transferMetadata.fee_transaction_id
        ? Number(transferMetadata.fee_transaction_id)
        : null;
      payoutFromAmountMinor = Number(fromAmountMinor);
      payoutFromCurrency = fromCurrency;
      payoutFxRate = fxRate;
    }

    let salaryExpenseTx = null;
    if (amounts.expense_base_minor > 0) {
      salaryExpenseTx = await createTransaction(workspace, actorUserId, {
        type: 'EXPENSE',
        date: paymentDate,
        amount_minor: Number(amounts.expense_base_minor),
        currency: entry.currency,
        account_id: Number(payoutToAccount.id),
        description: `Salary expense for ${employee.full_name} (${run.period_month})`,
        category_id: Number(payrollCategoryId),
        counterparty_id: Number(employee.linked_counterparty_id),
        source: 'WEB',
        status: 'APPROVED',
        metadata: {
          link_type: 'PAYROLL_SALARY',
          employee_id: employee.id,
          payroll_run_id: run.id,
          payroll_entry_id: entry.id,
          loan_id: entry.loan_id || null,
          payout_from_account_id: payoutFromAccount?.id || null,
          payout_to_account_id: payoutToAccount.id,
          payout_transfer_transaction_id: payoutTransferTx?.id || null,
          payout_transfer_fee_transaction_id: payoutTransferFeeTxId,
        },
      });
    }

    const extraFees = Array.isArray(paymentInput.additional_fees) ? paymentInput.additional_fees : [];
    const additionalFeeTransactionIds = [];
    let additionalFeeTotalMinor = 0;

    for (const fee of extraFees) {
      const feeAccount = payoutFromAccount || payoutToAccount;
      const feeCurrency = fee.currency || feeAccount.currency;
      assert(
        feeCurrency === feeAccount.currency,
        400,
        `Additional fee currency must match selected fee account currency for payroll entry ${entry.id}.`
      );

      const feeCategoryId = await resolveCategoryId(
        workspace.id,
        fee.category_id,
        'Transfer Fees'
      );

      const feeTx = await createTransaction(workspace, actorUserId, {
        type: 'EXPENSE',
        date: paymentDate,
        amount_minor: Number(fee.amount_minor),
        currency: feeCurrency,
        account_id: Number(feeAccount.id),
        description:
          fee.description || `Additional payroll payout fee for ${employee.full_name} (${run.period_month})`,
        category_id: Number(feeCategoryId),
        source: 'WEB',
        status: 'APPROVED',
        fx_rate_to_base: fee.fx_rate_to_base || undefined,
        metadata: {
          link_type: 'PAYROLL_PAYOUT_FEE',
          employee_id: employee.id,
          payroll_run_id: run.id,
          payroll_entry_id: entry.id,
          salary_expense_transaction_id: salaryExpenseTx?.id || null,
          payout_transfer_transaction_id: payoutTransferTx?.id || null,
        },
      });

      additionalFeeTransactionIds.push(feeTx.id);
      additionalFeeTotalMinor += Number(fee.amount_minor);
    }

    if (!shouldCreatePayoutTransfer && Number(paymentInput.transfer_fee_amount_minor || 0) > 0) {
      const standaloneFeeAccount = payoutFromAccount || payoutToAccount;
      const standaloneFeeCurrency = paymentInput.transfer_fee_currency || standaloneFeeAccount.currency;
      assert(
        standaloneFeeCurrency === standaloneFeeAccount.currency,
        400,
        `Standalone payout fee currency must match selected fee account currency for payroll entry ${entry.id}.`
      );

      const standaloneFeeCategoryId = await resolveCategoryId(
        workspace.id,
        paymentInput.transfer_fee_category_id,
        'Transfer Fees'
      );

      const standaloneFeeTx = await createTransaction(workspace, actorUserId, {
        type: 'EXPENSE',
        date: paymentDate,
        amount_minor: Number(paymentInput.transfer_fee_amount_minor),
        currency: standaloneFeeCurrency,
        account_id: Number(standaloneFeeAccount.id),
        description:
          paymentInput.transfer_fee_description
            || `Payroll payout fee for ${employee.full_name} (${run.period_month})`,
        category_id: Number(standaloneFeeCategoryId),
        source: 'WEB',
        status: 'APPROVED',
        fx_rate_to_base: paymentInput.transfer_fee_fx_rate_to_base || undefined,
        metadata: {
          link_type: 'PAYROLL_PAYOUT_FEE',
          employee_id: employee.id,
          payroll_run_id: run.id,
          payroll_entry_id: entry.id,
          salary_expense_transaction_id: salaryExpenseTx?.id || null,
          payout_transfer_transaction_id: null,
        },
      });

      additionalFeeTransactionIds.push(standaloneFeeTx.id);
      additionalFeeTotalMinor += Number(paymentInput.transfer_fee_amount_minor);
    }

    let principalTransferTx = null;
    let interestIncomeTx = null;

    if (entry.loan_id && amounts.actual_loan_deduction_minor > 0) {
      const loan = await knex()('finance_employee_loans')
        .where({ workspace_id: workspace.id, id: entry.loan_id, employee_id: employee.id })
        .first();

      if (loan && ['ACTIVE', 'APPROVED'].includes(String(loan.status))) {
        const repaymentPosting = await applyLoanPayment({
          workspace,
          actorUserId,
          loan,
          amountMinor: amounts.actual_loan_deduction_minor,
          repaymentDate: paymentDate,
          source: 'PAYROLL',
          linkedPayrollEntryId: entry.id,
          cashAccountId: payoutToAccount.id,
          payrollRunId: run.id,
        });

        principalTransferTx = repaymentPosting.principal_transfer_transaction;
        interestIncomeTx = repaymentPosting.interest_income_transaction;
      }
    }

    const [updatedEntry] = await knex()('finance_payroll_entries')
      .where({ id: entry.id })
      .update({
        actual_loan_deduction_minor: amounts.actual_loan_deduction_minor,
        net_paid_minor: amounts.net_paid_minor,
        salary_expense_transaction_id: salaryExpenseTx?.id || null,
        loan_principal_repayment_transaction_id: principalTransferTx?.id || null,
        loan_interest_income_transaction_id: interestIncomeTx?.id || null,
        payout_from_account_id: payoutFromAccount?.id || null,
        payout_to_account_id: payoutToAccount.id,
        payout_from_amount_minor: payoutFromAmountMinor,
        payout_from_currency: payoutFromCurrency,
        payout_to_amount_minor: payoutToAmountMinor,
        payout_to_currency: payoutToCurrency,
        payout_fx_rate: payoutFxRate,
        payout_transfer_transaction_id: payoutTransferTx?.id || null,
        payout_transfer_fee_transaction_id: payoutTransferFeeTxId,
        payout_additional_fee_total_minor: additionalFeeTotalMinor,
        payout_additional_fee_count: additionalFeeTransactionIds.length,
        status: 'PAID',
        updated_at: new Date().toISOString(),
      })
      .returning('*');

    await syncPayrollComponents(updatedEntry.id, updatedEntry);

    await addAuditLog({
      workspaceId: workspace.id,
      actorUserId,
      entityType: 'PAYROLL_ENTRY',
      entityId: updatedEntry.id,
      action: 'PAY',
      before: entry,
      after: updatedEntry,
    });

    processedEntries.push(updatedEntry.id);
  }

  const [updatedRun] = await knex()('finance_payroll_runs')
    .where({ id: run.id })
    .update({
      status: 'PAID',
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .returning('*');

  await addAuditLog({
    workspaceId: workspace.id,
    actorUserId,
    entityType: 'PAYROLL_RUN',
    entityId: updatedRun.id,
    action: 'PAY',
    before: run,
    after: { ...updatedRun, processed_entry_ids: processedEntries },
  });

  return getPayrollRun(workspace.id, run.id);
}

async function listLoans(workspaceId, filters = {}) {
  const query = knex()
    .select(
      'l.*',
      'e.employee_code',
      'e.full_name',
      'disbursement_account.name as disbursement_account_name',
      'disbursement_account.currency as disbursement_account_currency',
      'control_account.name as receivable_control_account_name',
      'control_account.currency as receivable_control_account_currency'
    )
    .from('finance_employee_loans as l')
    .innerJoin('finance_employees as e', 'e.id', 'l.employee_id')
    .leftJoin('finance_accounts as disbursement_account', 'disbursement_account.id', 'l.disbursement_account_id')
    .leftJoin('finance_accounts as control_account', 'control_account.id', 'l.receivable_control_account_id')
    .where('l.workspace_id', workspaceId)
    .orderBy('l.id', 'desc');

  if (filters.status) {
    query.andWhere('l.status', String(filters.status));
  }

  if (filters.employee_id) {
    query.andWhere('l.employee_id', Number(filters.employee_id));
  }

  return query;
}

async function getLoan(workspaceId, loanId) {
  const loan = await knex()('finance_employee_loans').where({ workspace_id: workspaceId, id: loanId }).first();
  assert(loan, 404, 'Loan not found.');

  const schedules = await knex()('finance_loan_schedules')
    .where({ loan_id: loanId })
    .orderBy('installment_no', 'asc');

  const repayments = await knex()('finance_loan_repayments')
    .where({ workspace_id: workspaceId, loan_id: loanId })
    .orderBy('repayment_date', 'desc')
    .orderBy('id', 'desc');

  return {
    ...loan,
    schedules,
    repayments,
  };
}

async function createLoan(workspace, actorUserId, payload) {
  const normalizedPayload = normalizeLoanCreatePayload(payload || {});
  const input = parseSchema(EmployeeLoanCreateSchema, normalizedPayload, 'Invalid loan payload.');
  const employee = await knex()('finance_employees')
    .where({ workspace_id: workspace.id, id: input.employee_id })
    .first();
  assert(employee, 404, 'Employee not found.');

  assert(
    employee.payroll_currency === input.currency,
    400,
    'Loan currency must match employee payroll currency.'
  );

  const existingActive = await knex()('finance_employee_loans')
    .where({ workspace_id: workspace.id, employee_id: employee.id })
    .whereIn('status', ['APPROVED', 'ACTIVE'])
    .first();
  assert(!existingActive, 409, 'Employee already has an active loan.');

  const disbursementAccount = await resolveAccount(workspace.id, input.disbursement_account_id);
  assert(disbursementAccount.account_kind === 'CASH', 400, 'Disbursement account must be a CASH account.');

  const controlAccount = await ensureReceivableControlAccount(
    workspace.id,
    actorUserId,
    input.currency,
    input.receivable_control_account_id || null
  );

  const now = new Date().toISOString();
  const defaultDueDate = lastFridayOfMonth(dayjs().add(1, 'month').format('YYYY-MM'));
  const nextDueDate = input.first_due_date || defaultDueDate;
  assert(nextDueDate, 400, 'Invalid loan payload.', {
    fieldErrors: { first_due_date: ['Invalid'] },
  });

  const [loan] = await knex()('finance_employee_loans')
    .insert({
      workspace_id: workspace.id,
      employee_id: employee.id,
      currency: input.currency,
      principal_minor: input.principal_minor,
      annual_interest_bps: input.annual_interest_bps,
      installment_minor: input.installment_minor,
      disbursement_date: null,
      next_due_date: nextDueDate,
      outstanding_principal_minor: input.principal_minor,
      outstanding_interest_minor: 0,
      status: 'APPROVED',
      disbursement_account_id: disbursementAccount.id,
      receivable_control_account_id: controlAccount.id,
      disbursement_transaction_id: null,
      approved_by_user_id: actorUserId,
      approved_at: now,
      created_by_user_id: actorUserId,
      created_at: now,
      updated_at: now,
    })
    .returning('*');

  await addAuditLog({
    workspaceId: workspace.id,
    actorUserId,
    entityType: 'EMPLOYEE_LOAN',
    entityId: loan.id,
    action: 'CREATE',
    before: null,
    after: loan,
  });

  return getLoan(workspace.id, loan.id);
}

async function updateLoan(workspaceId, actorUserId, loanId, payload) {
  const normalizedPayload = normalizeLoanUpdatePayload(payload || {});
  const input = parseSchema(EmployeeLoanUpdateSchema, normalizedPayload, 'Invalid loan payload.');
  const existing = await knex()('finance_employee_loans').where({ workspace_id: workspaceId, id: loanId }).first();
  assert(existing, 404, 'Loan not found.');

  const updates = {
    updated_at: new Date().toISOString(),
  };

  if (input.annual_interest_bps !== undefined) updates.annual_interest_bps = input.annual_interest_bps;
  if (input.installment_minor !== undefined) updates.installment_minor = input.installment_minor;
  if (input.status !== undefined) updates.status = input.status;
  if (input.next_due_date !== undefined) updates.next_due_date = input.next_due_date;

  if (input.disbursement_account_id !== undefined) {
    assert(
      !existing.disbursement_transaction_id,
      409,
      'Cannot change disbursement account after loan has already been disbursed.'
    );
    const disbursementAccount = await resolveAccount(workspaceId, input.disbursement_account_id);
    assert(disbursementAccount.account_kind === 'CASH', 400, 'Disbursement account must be a CASH account.');
    updates.disbursement_account_id = disbursementAccount.id;
  }

  if (updates.status === 'CLOSED') {
    assert(
      toSafeMinor(existing.outstanding_principal_minor) === 0 &&
        toSafeMinor(existing.outstanding_interest_minor) === 0,
      409,
      'Cannot close a loan with outstanding balances.'
    );
  }

  const [loan] = await knex()('finance_employee_loans')
    .where({ id: loanId })
    .update(updates)
    .returning('*');

  await addAuditLog({
    workspaceId,
    actorUserId,
    entityType: 'EMPLOYEE_LOAN',
    entityId: loan.id,
    action: 'UPDATE',
    before: existing,
    after: loan,
  });

  return getLoan(workspaceId, loan.id);
}

async function disburseLoan(workspace, actorUserId, loanId, payload) {
  const normalizedPayload = normalizeLoanDisbursementPayload(payload || {});
  const input = parseSchema(
    LoanDisbursementInputSchema,
    normalizedPayload,
    'Invalid loan disbursement payload.'
  );

  const existing = await knex()('finance_employee_loans').where({ workspace_id: workspace.id, id: loanId }).first();
  assert(existing, 404, 'Loan not found.');
  assert(['APPROVED', 'DRAFT'].includes(existing.status), 409, 'Loan cannot be disbursed in its current status.');

  const disbursementAccount = await resolveAccount(workspace.id, Number(existing.disbursement_account_id));
  const controlAccount = await resolveAccount(workspace.id, Number(existing.receivable_control_account_id));
  assert(controlAccount.account_kind === 'LOAN_RECEIVABLE_CONTROL', 400, 'Invalid receivable control account.');
  assert(controlAccount.currency === existing.currency, 400, 'Loan and receivable control account currency mismatch.');

  const sourceCurrency = disbursementAccount.currency;
  const destinationCurrency = existing.currency;
  const principalMinor = Number(existing.principal_minor);

  let sourceAmountMinor = principalMinor;
  let fxRate = null;
  if (sourceCurrency === destinationCurrency) {
    if (input.from_amount_minor !== undefined) {
      sourceAmountMinor = Number(input.from_amount_minor);
    }
    assert(
      sourceAmountMinor === principalMinor,
      400,
      'Same-currency loan disbursement requires source amount equal to principal.'
    );
    assert(input.fx_rate === undefined, 400, 'fx_rate is only allowed for cross-currency disbursement.');
  } else {
    assert(input.from_amount_minor, 400, 'Cross-currency loan disbursement requires from_amount_minor.');
    assert(input.fx_rate, 400, 'Cross-currency loan disbursement requires fx_rate.');
    sourceAmountMinor = Number(input.from_amount_minor);
    fxRate = Number(input.fx_rate);
  }

  const transferFeeAmountMinor = Number(input.transfer_fee_amount_minor || 0);
  const transferFeeCurrency =
    transferFeeAmountMinor > 0 ? input.transfer_fee_currency || sourceCurrency : null;
  if (transferFeeAmountMinor > 0) {
    assert(
      transferFeeCurrency === sourceCurrency,
      400,
      'Transfer fee currency must match disbursement account currency.'
    );
  }

  const disbursementDate = input.disbursement_date || new Date().toISOString().slice(0, 10);
  const uncategorizedCategoryId = await getUncategorizedCategoryId(workspace.id);
  const transferFeesCategoryId =
    transferFeeAmountMinor > 0
      ? await resolveCategoryId(workspace.id, input.transfer_fee_category_id, 'Transfer Fees')
      : null;

  const transferTx = await createTransaction(workspace, actorUserId, {
    type: 'TRANSFER',
    date: disbursementDate,
    description: `Loan disbursement for employee #${existing.employee_id}`,
    from_account_id: Number(disbursementAccount.id),
    to_account_id: Number(controlAccount.id),
    from_amount_minor: Number(sourceAmountMinor),
    from_currency: sourceCurrency,
    to_amount_minor: principalMinor,
    to_currency: destinationCurrency,
    fx_rate: fxRate || undefined,
    fee_amount_minor: transferFeeAmountMinor > 0 ? transferFeeAmountMinor : undefined,
    fee_currency: transferFeeAmountMinor > 0 ? transferFeeCurrency : undefined,
    fee_category_id: transferFeeAmountMinor > 0 ? Number(transferFeesCategoryId) : undefined,
    fee_fx_rate_to_base:
      transferFeeAmountMinor > 0 ? input.transfer_fee_fx_rate_to_base || undefined : undefined,
    fee_description:
      transferFeeAmountMinor > 0
        ? input.transfer_fee_description || `Loan disbursement transfer fee for employee #${existing.employee_id}`
        : undefined,
    category_id: Number(uncategorizedCategoryId),
    source: 'WEB',
    status: 'APPROVED',
    metadata: {
      link_type: 'LOAN_DISBURSEMENT',
      employee_id: existing.employee_id,
      loan_id: existing.id,
      disbursement_from_amount_minor: sourceAmountMinor,
      disbursement_from_currency: sourceCurrency,
      disbursement_to_amount_minor: principalMinor,
      disbursement_to_currency: destinationCurrency,
      disbursement_fx_rate: fxRate,
      disbursement_transfer_fee_amount_minor: transferFeeAmountMinor || null,
      disbursement_transfer_fee_currency: transferFeeCurrency,
    },
  });

  const transferMetadata = normalizeJsonObject(transferTx.metadata_json);
  const feeTransactionId = transferMetadata.fee_transaction_id
    ? Number(transferMetadata.fee_transaction_id)
    : null;

  const [loan] = await knex()('finance_employee_loans')
    .where({ id: existing.id })
    .update({
      disbursement_date: disbursementDate,
      disbursement_transaction_id: transferTx.id,
      status: 'ACTIVE',
      approved_by_user_id: actorUserId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .returning('*');

  await addAuditLog({
    workspaceId: workspace.id,
    actorUserId,
    entityType: 'EMPLOYEE_LOAN',
    entityId: loan.id,
    action: 'DISBURSE',
    before: existing,
    after: {
      ...loan,
      disbursement_from_amount_minor: sourceAmountMinor,
      disbursement_from_currency: sourceCurrency,
      disbursement_to_amount_minor: principalMinor,
      disbursement_to_currency: destinationCurrency,
      disbursement_fx_rate: fxRate,
      disbursement_transfer_fee_amount_minor: transferFeeAmountMinor || null,
      disbursement_transfer_fee_currency: transferFeeCurrency,
      disbursement_transfer_fee_transaction_id: feeTransactionId,
    },
  });

  return getLoan(workspace.id, loan.id);
}

async function repayLoan(workspace, actorUserId, loanId, payload) {
  const normalizedPayload = normalizeLoanRepaymentPayload(payload || {});
  const input = parseSchema(LoanRepaymentInputSchema, normalizedPayload, 'Invalid loan repayment payload.');
  const loan = await knex()('finance_employee_loans').where({ workspace_id: workspace.id, id: loanId }).first();
  assert(loan, 404, 'Loan not found.');
  assert(['ACTIVE', 'APPROVED'].includes(String(loan.status)), 409, 'Loan is not repayable in current status.');

  const posting = await applyLoanPayment({
    workspace,
    actorUserId,
    loan,
    amountMinor: input.amount_minor,
    repaymentDate: input.repayment_date,
    source: 'MANUAL',
    linkedPayrollEntryId: null,
    cashAccountId: input.cash_account_id,
    payrollRunId: null,
  });

  return {
    loan: posting.updated_loan,
    repayment: posting.repayment,
    principal_transfer_transaction: posting.principal_transfer_transaction,
    interest_income_transaction: posting.interest_income_transaction,
  };
}

async function getEmployeeTimeline(workspaceId, employeeId) {
  const employee = await getEmployee(workspaceId, employeeId);
  const toNumberOrNull = (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const payrollEntries = await knex()
    .select(
      'e.*',
      'r.period_month',
      'r.payday_date',
      'r.status as payroll_run_status',
      'salary_tx.transaction_date as salary_sent_date',
      'salary_tx.amount_minor as salary_amount_minor',
      'salary_tx.currency as salary_currency',
      'salary_tx.status as salary_transaction_status',
      'payout_from_account.name as payout_from_account_name',
      'payout_to_account.name as payout_to_account_name'
    )
    .from('finance_payroll_entries as e')
    .innerJoin('finance_payroll_runs as r', 'r.id', 'e.payroll_run_id')
    .leftJoin('finance_transactions as salary_tx', 'salary_tx.id', 'e.salary_expense_transaction_id')
    .leftJoin('finance_accounts as payout_from_account', 'payout_from_account.id', 'e.payout_from_account_id')
    .leftJoin('finance_accounts as payout_to_account', 'payout_to_account.id', 'e.payout_to_account_id')
    .where('e.workspace_id', workspaceId)
    .andWhere('e.employee_id', employeeId)
    .orderBy('r.period_month', 'desc');

  const loans = await knex()
    .select(
      'l.*',
      'disbursement_account.name as disbursement_account_name',
      'disbursement_account.currency as disbursement_account_currency',
      'control_account.name as receivable_control_account_name',
      'control_account.currency as receivable_control_account_currency'
    )
    .from('finance_employee_loans as l')
    .leftJoin('finance_accounts as disbursement_account', 'disbursement_account.id', 'l.disbursement_account_id')
    .leftJoin('finance_accounts as control_account', 'control_account.id', 'l.receivable_control_account_id')
    .where('l.workspace_id', workspaceId)
    .andWhere('l.employee_id', employeeId)
    .orderBy('id', 'desc');

  const loanIds = loans.map((loan) => loan.id);
  const repayments = loanIds.length
    ? await knex()
        .select('lr.*', 'loan.currency as loan_currency')
        .from('finance_loan_repayments as lr')
        .innerJoin('finance_employee_loans as loan', 'loan.id', 'lr.loan_id')
        .where('lr.workspace_id', workspaceId)
        .andWhere('lr.employee_id', employeeId)
        .whereIn('loan_id', loanIds)
        .orderBy('repayment_date', 'desc')
        .orderBy('id', 'desc')
    : [];

  const transactions = await knex()
    .select(
      't.*',
      knex().raw("COALESCE(MAX(CASE WHEN l.direction = 'IN' THEN a.name END), '') as to_account_name"),
      knex().raw("COALESCE(MAX(CASE WHEN l.direction = 'OUT' THEN a.name END), '') as from_account_name"),
      knex().raw("COALESCE(MAX(CASE WHEN l.direction = 'IN' THEN l.currency END), t.currency) as to_account_currency"),
      knex().raw("COALESCE(MAX(CASE WHEN l.direction = 'OUT' THEN l.currency END), t.currency) as from_account_currency")
    )
    .from('finance_transactions as t')
    .leftJoin('finance_transaction_lines as l', 'l.transaction_id', 't.id')
    .leftJoin('finance_accounts as a', 'a.id', 'l.account_id')
    .where('t.workspace_id', workspaceId)
    .andWhereRaw(
      "(t.metadata_json ->> 'employee_id') ~ '^[0-9]+$' AND (t.metadata_json ->> 'employee_id')::bigint = ?",
      [employeeId]
    )
    .groupBy('t.id')
    .orderBy('transaction_date', 'desc')
    .orderBy('id', 'desc');

  const transactionById = new Map(
    transactions.map((transaction) => {
      const normalizedId = Number(transaction.id);
      return [
        normalizedId,
        {
          ...transaction,
          id: normalizedId,
          amount_minor: toSafeMinor(transaction.amount_minor),
          from_account_name: transaction.from_account_name || null,
          to_account_name: transaction.to_account_name || null,
          from_account_currency: transaction.from_account_currency || transaction.currency || null,
          to_account_currency: transaction.to_account_currency || transaction.currency || null,
          metadata_json: normalizeJsonObject(transaction.metadata_json),
        },
      ];
    })
  );

  const loanById = new Map(loans.map((loan) => [Number(loan.id), loan]));

  const payrollEvents = payrollEntries.map((entry) => {
    const payoutToAmountMinor =
      entry.payout_to_amount_minor === null || entry.payout_to_amount_minor === undefined
        ? toSafeMinor(entry.net_paid_minor)
        : toSafeMinor(entry.payout_to_amount_minor);
    const payoutFromAmountMinor =
      entry.payout_from_amount_minor === null || entry.payout_from_amount_minor === undefined
        ? payoutToAmountMinor
        : toSafeMinor(entry.payout_from_amount_minor);

    return {
      date: entry.salary_sent_date || entry.payday_date,
      type: 'PAYROLL',
      label: `Salary ${entry.period_month}`,
      data: {
        payroll_entry_id: Number(entry.id),
        payroll_run_id: Number(entry.payroll_run_id),
        status: entry.status,
        payroll_run_status: entry.payroll_run_status,
        currency: entry.currency,
        salary_sent_date: entry.salary_sent_date || null,
        salary_expense_transaction_id: toNumberOrNull(entry.salary_expense_transaction_id),
        salary_amount_minor:
          entry.salary_amount_minor === null || entry.salary_amount_minor === undefined
            ? null
            : toSafeMinor(entry.salary_amount_minor),
        salary_currency: entry.salary_currency || entry.currency,
        net_paid_minor: toSafeMinor(entry.net_paid_minor),
        gross_minor: toSafeMinor(entry.base_salary_minor) + toSafeMinor(entry.allowances_minor),
        non_loan_deductions_minor: toSafeMinor(entry.non_loan_deductions_minor),
        planned_loan_deduction_minor: toSafeMinor(entry.planned_loan_deduction_minor),
        actual_loan_deduction_minor: toSafeMinor(entry.actual_loan_deduction_minor),
        from_account_name: entry.payout_from_account_name || entry.payout_to_account_name || null,
        to_account_name: entry.payout_to_account_name || null,
        from_amount_minor: payoutFromAmountMinor,
        from_currency: entry.payout_from_currency || entry.payout_to_currency || entry.currency || null,
        to_amount_minor: payoutToAmountMinor,
        to_currency: entry.payout_to_currency || entry.currency || null,
        payout_fx_rate:
          entry.payout_fx_rate === null || entry.payout_fx_rate === undefined
            ? null
            : Number(entry.payout_fx_rate),
        payout_transfer_transaction_id: toNumberOrNull(entry.payout_transfer_transaction_id),
        payout_transfer_fee_transaction_id: toNumberOrNull(entry.payout_transfer_fee_transaction_id),
        payout_additional_fee_total_minor: toSafeMinor(entry.payout_additional_fee_total_minor),
        payout_additional_fee_count: Number(entry.payout_additional_fee_count || 0),
      },
    };
  });

  const loanEvents = loans.map((loan) => {
    const disbursementTransactionId = toNumberOrNull(loan.disbursement_transaction_id);
    const disbursementTransaction = disbursementTransactionId
      ? transactionById.get(disbursementTransactionId)
      : null;
    const disbursementMetadata = normalizeJsonObject(disbursementTransaction?.metadata_json);
    const fromAmountMinor =
      disbursementMetadata.disbursement_from_amount_minor === undefined ||
      disbursementMetadata.disbursement_from_amount_minor === null
        ? toSafeMinor(loan.principal_minor)
        : toSafeMinor(disbursementMetadata.disbursement_from_amount_minor);
    const toAmountMinor =
      disbursementMetadata.disbursement_to_amount_minor === undefined ||
      disbursementMetadata.disbursement_to_amount_minor === null
        ? toSafeMinor(loan.principal_minor)
        : toSafeMinor(disbursementMetadata.disbursement_to_amount_minor);
    const transferFeeAmountMinor =
      disbursementMetadata.disbursement_transfer_fee_amount_minor === undefined ||
      disbursementMetadata.disbursement_transfer_fee_amount_minor === null
        ? null
        : toSafeMinor(disbursementMetadata.disbursement_transfer_fee_amount_minor);

    return {
      date: loan.disbursement_date || loan.created_at?.slice(0, 10),
      type: 'LOAN',
      label: `Loan #${loan.id} ${loan.status}`,
      data: {
        loan_id: Number(loan.id),
        status: loan.status,
        currency: loan.currency,
        principal_minor: toSafeMinor(loan.principal_minor),
        installment_minor: toSafeMinor(loan.installment_minor),
        annual_interest_bps: Number(loan.annual_interest_bps || 0),
        outstanding_principal_minor: toSafeMinor(loan.outstanding_principal_minor),
        outstanding_interest_minor: toSafeMinor(loan.outstanding_interest_minor),
        disbursement_transaction_id: disbursementTransactionId,
        disbursement_date: loan.disbursement_date || null,
        from_account_name:
          disbursementTransaction?.from_account_name || loan.disbursement_account_name || null,
        to_account_name:
          disbursementTransaction?.to_account_name || loan.receivable_control_account_name || null,
        from_amount_minor: fromAmountMinor,
        from_currency:
          disbursementMetadata.disbursement_from_currency ||
          disbursementTransaction?.from_account_currency ||
          loan.disbursement_account_currency ||
          loan.currency,
        to_amount_minor: toAmountMinor,
        to_currency:
          disbursementMetadata.disbursement_to_currency ||
          disbursementTransaction?.to_account_currency ||
          loan.receivable_control_account_currency ||
          loan.currency,
        payout_fx_rate:
          disbursementMetadata.disbursement_fx_rate === undefined ||
          disbursementMetadata.disbursement_fx_rate === null
            ? null
            : Number(disbursementMetadata.disbursement_fx_rate),
        transfer_fee_amount_minor: transferFeeAmountMinor,
        transfer_fee_currency: disbursementMetadata.disbursement_transfer_fee_currency || null,
      },
    };
  });

  const repaymentEvents = repayments.map((repayment) => {
    const principalTransferTransactionId = toNumberOrNull(repayment.principal_transfer_transaction_id);
    const interestIncomeTransactionId = toNumberOrNull(repayment.interest_income_transaction_id);
    const principalTransaction = principalTransferTransactionId
      ? transactionById.get(principalTransferTransactionId)
      : null;
    const interestTransaction = interestIncomeTransactionId
      ? transactionById.get(interestIncomeTransactionId)
      : null;
    const linkedLoan = loanById.get(Number(repayment.loan_id));
    const repaymentCurrency =
      linkedLoan?.currency ||
      repayment.loan_currency ||
      principalTransaction?.to_account_currency ||
      principalTransaction?.from_account_currency ||
      interestTransaction?.currency ||
      employee.payroll_currency;

    return {
      date: repayment.repayment_date,
      type: 'LOAN_REPAYMENT',
      label: `Loan repayment #${repayment.id} (${repayment.source})`,
      data: {
        loan_repayment_id: Number(repayment.id),
        loan_id: Number(repayment.loan_id),
        source: repayment.source,
        status: linkedLoan?.status || null,
        currency: repaymentCurrency,
        principal_paid_minor: toSafeMinor(repayment.principal_paid_minor),
        interest_paid_minor: toSafeMinor(repayment.interest_paid_minor),
        total_paid_minor: toSafeMinor(repayment.total_paid_minor),
        outstanding_principal_minor:
          linkedLoan?.outstanding_principal_minor === undefined
            ? null
            : toSafeMinor(linkedLoan.outstanding_principal_minor),
        outstanding_interest_minor:
          linkedLoan?.outstanding_interest_minor === undefined
            ? null
            : toSafeMinor(linkedLoan.outstanding_interest_minor),
        principal_transfer_transaction_id: principalTransferTransactionId,
        interest_income_transaction_id: interestIncomeTransactionId,
        from_account_name: principalTransaction?.from_account_name || null,
        to_account_name: principalTransaction?.to_account_name || interestTransaction?.to_account_name || null,
        from_amount_minor:
          principalTransaction?.amount_minor === undefined
            ? null
            : toSafeMinor(principalTransaction.amount_minor),
        from_currency:
          principalTransaction?.from_account_currency ||
          principalTransaction?.to_account_currency ||
          repaymentCurrency,
        to_amount_minor:
          principalTransaction?.amount_minor === undefined
            ? toSafeMinor(repayment.total_paid_minor)
            : toSafeMinor(principalTransaction.amount_minor),
        to_currency:
          principalTransaction?.to_account_currency ||
          interestTransaction?.to_account_currency ||
          repaymentCurrency,
      },
    };
  });

  const events = [
    ...payrollEvents,
    ...loanEvents,
    ...repaymentEvents,
  ]
    .filter((event) => Boolean(event.date))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const activeLoan = loans.find((loan) => ['APPROVED', 'ACTIVE'].includes(String(loan.status))) || null;

  return {
    employee: {
      ...employee,
      active_loan: activeLoan || employee.active_loan || null,
    },
    payroll_entries: payrollEntries,
    loans,
    repayments,
    transactions: transactions.map((transaction) => ({
      ...transaction,
      metadata_json: normalizeJsonObject(transaction.metadata_json),
      amount_minor: toSafeMinor(transaction.amount_minor),
      from_account_name: transaction.from_account_name || null,
      to_account_name: transaction.to_account_name || null,
      from_account_currency: transaction.from_account_currency || transaction.currency || null,
      to_account_currency: transaction.to_account_currency || transaction.currency || null,
    })),
    events,
  };
}

async function payrollSummaryReport(workspaceId, month) {
  assert(/^\d{4}-\d{2}$/.test(month), 400, 'month must be in YYYY-MM format.');

  const rows = await knex()
    .select(
      'e.id as payroll_entry_id',
      'e.employee_id',
      'emp.full_name as employee_name',
      'emp.department_id',
      'dept.name as department_name',
      'dept.code as department_code',
      'r.period_month',
      'r.status as run_status',
      'e.base_salary_minor',
      'e.allowances_minor',
      'e.non_loan_deductions_minor',
      'e.planned_loan_deduction_minor',
      'e.actual_loan_deduction_minor',
      'e.net_paid_minor',
      'e.salary_expense_transaction_id',
      'e.payout_from_account_id',
      'e.payout_to_account_id',
      'e.payout_from_amount_minor',
      'e.payout_from_currency',
      'e.payout_to_amount_minor',
      'e.payout_to_currency',
      'e.payout_fx_rate',
      'e.payout_transfer_transaction_id',
      'e.payout_transfer_fee_transaction_id',
      'e.payout_additional_fee_total_minor',
      'e.payout_additional_fee_count'
    )
    .from('finance_payroll_entries as e')
    .innerJoin('finance_payroll_runs as r', 'r.id', 'e.payroll_run_id')
    .innerJoin('finance_employees as emp', 'emp.id', 'e.employee_id')
    .leftJoin('finance_departments as dept', 'dept.id', 'emp.department_id')
    .where('e.workspace_id', workspaceId)
    .andWhere('r.period_month', month)
    .orderBy('emp.full_name', 'asc');

  const principalAndInterest = await knex()
    .select(
      knex().raw('COALESCE(SUM(principal_paid_minor), 0)::bigint as principal_repaid_minor'),
      knex().raw('COALESCE(SUM(interest_paid_minor), 0)::bigint as interest_repaid_minor')
    )
    .from('finance_loan_repayments as lr')
    .leftJoin('finance_payroll_entries as pe', 'pe.id', 'lr.linked_payroll_entry_id')
    .leftJoin('finance_payroll_runs as pr', 'pr.id', 'pe.payroll_run_id')
    .where('lr.workspace_id', workspaceId)
    .andWhere('pr.period_month', month)
    .first();

  const totals = rows.reduce(
    (acc, row) => {
      acc.employees_count += 1;
      acc.gross_minor += toSafeMinor(row.base_salary_minor) + toSafeMinor(row.allowances_minor);
      acc.non_loan_deductions_minor += toSafeMinor(row.non_loan_deductions_minor);
      acc.actual_loan_deductions_minor += toSafeMinor(row.actual_loan_deduction_minor);
      acc.net_paid_minor += toSafeMinor(row.net_paid_minor);
      return acc;
    },
    {
      employees_count: 0,
      gross_minor: 0,
      non_loan_deductions_minor: 0,
      actual_loan_deductions_minor: 0,
      net_paid_minor: 0,
      principal_repaid_minor: toSafeMinor(principalAndInterest?.principal_repaid_minor),
      interest_repaid_minor: toSafeMinor(principalAndInterest?.interest_repaid_minor),
    }
  );

  return {
    month,
    totals,
    rows,
  };
}

async function payrollByDepartmentReport(workspace, month, mode = 'base') {
  assert(/^\d{4}-\d{2}$/.test(month), 400, 'month must be in YYYY-MM format.');
  assert(['base', 'per_currency'].includes(mode), 400, 'mode must be either base or per_currency.');

  const rows = await knex()
    .select(
      'e.employee_id',
      'e.currency',
      knex().raw('COALESCE(emp.department_id, 0)::bigint as department_id'),
      knex().raw("COALESCE(NULLIF(TRIM(dept.name), ''), 'Unassigned') as department_name"),
      knex().raw("NULLIF(TRIM(dept.code), '') as department_code"),
      knex().raw(
        'GREATEST((e.base_salary_minor + e.allowances_minor - e.non_loan_deductions_minor), 0)::bigint as expense_minor'
      ),
      knex().raw(
        `CASE
          WHEN salary_tx.base_amount_minor IS NOT NULL THEN salary_tx.base_amount_minor
          WHEN e.currency = ? THEN GREATEST((e.base_salary_minor + e.allowances_minor - e.non_loan_deductions_minor), 0)::bigint
          ELSE NULL
        END as base_amount_minor`,
        [workspace.base_currency]
      )
    )
    .from('finance_payroll_entries as e')
    .innerJoin('finance_payroll_runs as r', 'r.id', 'e.payroll_run_id')
    .innerJoin('finance_employees as emp', 'emp.id', 'e.employee_id')
    .leftJoin('finance_departments as dept', 'dept.id', 'emp.department_id')
    .leftJoin('finance_transactions as salary_tx', 'salary_tx.id', 'e.salary_expense_transaction_id')
    .where('e.workspace_id', workspace.id)
    .andWhere('r.period_month', month)
    .andWhere('e.status', 'PAID')
    .orderBy('department_name', 'asc')
    .orderBy('e.employee_id', 'asc');

  if (mode === 'per_currency') {
    const grouped = new Map();

    for (const row of rows) {
      const expenseMinor = toSafeMinor(row.expense_minor);
      if (expenseMinor <= 0) {
        continue;
      }

      const key = `${row.department_id}:${row.currency}`;
      const existing = grouped.get(key) || {
        department_id: Number(row.department_id) || null,
        department_name: row.department_name,
        department_code: row.department_code || null,
        currency: row.currency,
        total_minor: 0,
        employee_ids: new Set(),
      };

      existing.total_minor += expenseMinor;
      existing.employee_ids.add(Number(row.employee_id));
      grouped.set(key, existing);
    }

    const currencyTotals = new Map();
    for (const value of grouped.values()) {
      currencyTotals.set(value.currency, (currencyTotals.get(value.currency) || 0) + value.total_minor);
    }

    const resultRows = Array.from(grouped.values())
      .map((value) => {
        const currencyTotal = currencyTotals.get(value.currency) || 0;
        const sharePct = currencyTotal > 0 ? Number(((value.total_minor / currencyTotal) * 100).toFixed(2)) : 0;
        return {
          department_id: value.department_id,
          department_name: value.department_name,
          department_code: value.department_code,
          currency: value.currency,
          total_minor: value.total_minor,
          employees_count: value.employee_ids.size,
          share_pct: sharePct,
        };
      })
      .sort((a, b) => {
        if (a.currency === b.currency) {
          return b.total_minor - a.total_minor;
        }
        return String(a.currency).localeCompare(String(b.currency));
      });

    return {
      month,
      mode,
      rows: resultRows,
    };
  }

  const grouped = new Map();
  let grandTotal = 0;
  let excludedUnconvertedCount = 0;

  for (const row of rows) {
    const expenseMinor = toSafeMinor(row.expense_minor);
    if (expenseMinor <= 0) {
      continue;
    }

    const key = String(row.department_id);
    const existing = grouped.get(key) || {
      department_id: Number(row.department_id) || null,
      department_name: row.department_name,
      department_code: row.department_code || null,
      total_minor: 0,
      employee_ids: new Set(),
      excluded_unconverted_count: 0,
    };

    const baseAmountMinor = row.base_amount_minor === null ? null : toSafeMinor(row.base_amount_minor);
    if (baseAmountMinor === null) {
      existing.excluded_unconverted_count += 1;
      excludedUnconvertedCount += 1;
    } else {
      existing.total_minor += baseAmountMinor;
      grandTotal += baseAmountMinor;
    }

    existing.employee_ids.add(Number(row.employee_id));
    grouped.set(key, existing);
  }

  const resultRows = Array.from(grouped.values())
    .map((value) => ({
      department_id: value.department_id,
      department_name: value.department_name,
      department_code: value.department_code,
      total_minor: value.total_minor,
      employees_count: value.employee_ids.size,
      excluded_unconverted_count: value.excluded_unconverted_count,
      share_pct: grandTotal > 0 ? Number(((value.total_minor / grandTotal) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.total_minor - a.total_minor);

  return {
    month,
    mode,
    base_currency: workspace.base_currency,
    totals: {
      total_minor: grandTotal,
      excluded_unconverted_count: excludedUnconvertedCount,
    },
    rows: resultRows,
  };
}

async function loanOutstandingReport(workspaceId, asOf) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(asOf), 400, 'as_of must be in YYYY-MM-DD format.');

  const rows = await knex()
    .select(
      'l.*',
      'emp.employee_code',
      'emp.full_name as employee_name'
    )
    .from('finance_employee_loans as l')
    .innerJoin('finance_employees as emp', 'emp.id', 'l.employee_id')
    .where('l.workspace_id', workspaceId)
    .andWhere((builder) => {
      builder.whereNull('l.disbursement_date').orWhere('l.disbursement_date', '<=', asOf);
    })
    .orderBy('l.id', 'desc');

  const totals = rows.reduce(
    (acc, row) => {
      acc.loans_count += 1;
      acc.outstanding_principal_minor += toSafeMinor(row.outstanding_principal_minor);
      acc.outstanding_interest_minor += toSafeMinor(row.outstanding_interest_minor);
      acc.outstanding_total_minor +=
        toSafeMinor(row.outstanding_principal_minor) + toSafeMinor(row.outstanding_interest_minor);
      return acc;
    },
    {
      loans_count: 0,
      outstanding_principal_minor: 0,
      outstanding_interest_minor: 0,
      outstanding_total_minor: 0,
    }
  );

  return {
    as_of: asOf,
    totals,
    rows,
  };
}

async function employeeLedgerReport(workspaceId, employeeId, fromMonth, toMonth) {
  assert(/^\d{4}-\d{2}$/.test(fromMonth), 400, 'from must be in YYYY-MM format.');
  assert(/^\d{4}-\d{2}$/.test(toMonth), 400, 'to must be in YYYY-MM format.');

  const fromDate = `${fromMonth}-01`;
  const toDate = dayjs(`${toMonth}-01`).endOf('month').format('YYYY-MM-DD');

  const employee = await knex()('finance_employees').where({ workspace_id: workspaceId, id: employeeId }).first();
  assert(employee, 404, 'Employee not found.');

  const payroll = await knex()
    .select(
      'e.id as payroll_entry_id',
      'r.period_month',
      'r.payday_date',
      'e.net_paid_minor',
      'e.actual_loan_deduction_minor',
      'e.salary_expense_transaction_id'
    )
    .from('finance_payroll_entries as e')
    .innerJoin('finance_payroll_runs as r', 'r.id', 'e.payroll_run_id')
    .where('e.workspace_id', workspaceId)
    .andWhere('e.employee_id', employeeId)
    .andWhere('r.payday_date', '>=', fromDate)
    .andWhere('r.payday_date', '<=', toDate)
    .orderBy('r.payday_date', 'asc');

  const loanRepayments = await knex()('finance_loan_repayments')
    .where({ workspace_id: workspaceId, employee_id: employeeId })
    .andWhere('repayment_date', '>=', fromDate)
    .andWhere('repayment_date', '<=', toDate)
    .orderBy('repayment_date', 'asc');

  const transactions = await knex()('finance_transactions')
    .where({ workspace_id: workspaceId })
    .andWhereRaw("(metadata_json ->> 'employee_id')::bigint = ?", [employeeId])
    .andWhere('transaction_date', '>=', fromDate)
    .andWhere('transaction_date', '<=', toDate)
    .orderBy('transaction_date', 'asc')
    .orderBy('id', 'asc');

  const events = [
    ...payroll.map((row) => ({
      date: row.payday_date,
      type: 'PAYROLL',
      amount_minor: row.net_paid_minor,
      row,
    })),
    ...loanRepayments.map((row) => ({
      date: row.repayment_date,
      type: 'LOAN_REPAYMENT',
      amount_minor: row.total_paid_minor,
      row,
    })),
    ...transactions.map((row) => ({
      date: row.transaction_date,
      type: 'TRANSACTION',
      amount_minor: row.amount_minor,
      row,
    })),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return {
    employee,
    from: fromMonth,
    to: toMonth,
    payroll,
    loan_repayments: loanRepayments,
    transactions,
    events,
  };
}

async function getHealthModels() {
  return {
    finance_models: Object.keys(strapi.contentTypes)
      .filter((uid) => uid.startsWith('api::finance-'))
      .sort(),
  };
}

module.exports = {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,

  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeeTimeline,

  listPayrollRuns,
  getPayrollRun,
  createPayrollRun,
  deletePayrollRun,
  generatePayrollRunEntries,
  updatePayrollEntry,
  approvePayrollRun,
  payPayrollRun,

  listLoans,
  getLoan,
  createLoan,
  updateLoan,
  disburseLoan,
  repayLoan,

  payrollSummaryReport,
  payrollByDepartmentReport,
  loanOutstandingReport,
  employeeLedgerReport,

  getHealthModels,
  ensureReceivableControlAccount,
};
