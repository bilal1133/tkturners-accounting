const dayjs = require('dayjs');

const { knex } = require('./db');
const { assert } = require('./errors');
const { monthRange } = require('./utils');

function getMonthList(from, to) {
  const start = dayjs(`${from}-01`).startOf('month');
  const end = dayjs(`${to}-01`).startOf('month');
  const months = [];
  let cursor = start;

  while (cursor.isBefore(end) || cursor.isSame(end)) {
    months.push(cursor.format('YYYY-MM'));
    cursor = cursor.add(1, 'month');
  }

  return months;
}

async function fetchApprovedTransactionsInRange(workspaceId, startDate, endDate) {
  return knex()('finance_transactions')
    .where({ workspace_id: workspaceId, status: 'APPROVED' })
    .whereBetween('transaction_date', [startDate, endDate])
    .orderBy('transaction_date', 'asc');
}

function foldTotalsByCurrency(rows) {
  const map = new Map();

  for (const row of rows) {
    const currency = row.currency;
    if (!map.has(currency)) {
      map.set(currency, {
        currency,
        revenue: 0,
        expense: 0,
        profit_loss: 0,
        cash_in: 0,
        cash_out: 0,
        transfer_volume: 0,
      });
    }

    const current = map.get(currency);
    const amount = Number(row.amount_minor || 0);

    if (row.type === 'INCOME') {
      current.revenue += amount;
      current.cash_in += amount;
    }

    if (row.type === 'EXPENSE') {
      current.expense += amount;
      current.cash_out += amount;
    }

    if (row.type === 'TRANSFER') {
      current.transfer_volume += amount;
    }

    current.profit_loss = current.revenue - current.expense;
  }

  return Array.from(map.values());
}

function foldBaseTotals(rows, baseCurrency) {
  let revenue = 0;
  let expense = 0;
  let cashIn = 0;
  let cashOut = 0;
  let transferVolume = 0;
  let excluded = 0;

  for (const row of rows) {
    const amount =
      row.currency === baseCurrency
        ? Number(row.amount_minor)
        : row.base_amount_minor !== null && row.base_amount_minor !== undefined
          ? Number(row.base_amount_minor)
          : null;

    if (row.currency !== baseCurrency && amount === null) {
      if (row.type === 'INCOME' || row.type === 'EXPENSE' || row.type === 'TRANSFER') {
        excluded += 1;
      }
      continue;
    }

    if (row.type === 'INCOME') {
      revenue += amount;
      cashIn += amount;
    }

    if (row.type === 'EXPENSE') {
      expense += amount;
      cashOut += amount;
    }

    if (row.type === 'TRANSFER') {
      transferVolume += amount;
    }
  }

  return {
    revenue,
    expense,
    profit_loss: revenue - expense,
    cash_in: cashIn,
    cash_out: cashOut,
    transfer_volume: transferVolume,
    excluded_unconverted_count: excluded,
  };
}

async function monthlySummary(workspace, month, mode) {
  assert(/^\d{4}-\d{2}$/.test(month), 400, 'month must be in YYYY-MM format.');
  const { start, end } = monthRange(month);

  const rows = await fetchApprovedTransactionsInRange(workspace.id, start, end);

  if (mode === 'base') {
    const totals = foldBaseTotals(rows, workspace.base_currency);
    return {
      month,
      mode,
      base_currency: workspace.base_currency,
      totals,
    };
  }

  const byCurrency = foldTotalsByCurrency(rows);
  return {
    month,
    mode: 'per_currency',
    by_currency: byCurrency,
    excluded_unconverted_count: 0,
  };
}

async function expenseBreakdown(workspaceId, month) {
  assert(/^\d{4}-\d{2}$/.test(month), 400, 'month must be in YYYY-MM format.');
  const { start, end } = monthRange(month);

  return knex()
    .select(
      't.currency',
      'c.id as category_id',
      'c.name as category_name',
      knex().raw('SUM(t.amount_minor)::bigint as total_minor')
    )
    .from('finance_transactions as t')
    .leftJoin('finance_categories as c', 'c.id', 't.category_id')
    .where('t.workspace_id', workspaceId)
    .andWhere('t.status', 'APPROVED')
    .andWhere('t.type', 'EXPENSE')
    .whereBetween('t.transaction_date', [start, end])
    .groupBy('t.currency', 'c.id', 'c.name')
    .orderBy('total_minor', 'desc');
}

async function cashflow(workspace, from, to) {
  assert(/^\d{4}-\d{2}$/.test(from), 400, 'from must be in YYYY-MM format.');
  assert(/^\d{4}-\d{2}$/.test(to), 400, 'to must be in YYYY-MM format.');

  const months = getMonthList(from, to);
  const { start } = monthRange(from);
  const { end } = monthRange(to);

  const rows = await fetchApprovedTransactionsInRange(workspace.id, start, end);

  const series = months.map((month) => ({
    month,
    revenue: 0,
    expense: 0,
    profit_loss: 0,
    cash_in: 0,
    cash_out: 0,
    transfer_volume: 0,
    excluded_unconverted_count: 0,
  }));

  const byMonth = new Map(series.map((row) => [row.month, row]));

  for (const row of rows) {
    const month = dayjs(row.transaction_date).format('YYYY-MM');
    const bucket = byMonth.get(month);
    if (!bucket) {
      continue;
    }

    const amount =
      row.currency === workspace.base_currency
        ? Number(row.amount_minor)
        : row.base_amount_minor !== null && row.base_amount_minor !== undefined
          ? Number(row.base_amount_minor)
          : null;

    if (row.currency !== workspace.base_currency && amount === null) {
      bucket.excluded_unconverted_count += 1;
      continue;
    }

    if (row.type === 'INCOME') {
      bucket.revenue += amount;
      bucket.cash_in += amount;
    }

    if (row.type === 'EXPENSE') {
      bucket.expense += amount;
      bucket.cash_out += amount;
    }

    if (row.type === 'TRANSFER') {
      bucket.transfer_volume += amount;
    }

    bucket.profit_loss = bucket.revenue - bucket.expense;
  }

  return series;
}

async function accountBalances(workspaceId, asOfDate) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(asOfDate), 400, 'as_of must be in YYYY-MM-DD format.');

  const accounts = await knex()('finance_accounts').where({ workspace_id: workspaceId }).orderBy('name', 'asc');

  const deltas = await knex()
    .select(
      'l.account_id',
      knex().raw(
        "SUM(CASE WHEN l.direction = 'IN' THEN l.amount_minor ELSE -l.amount_minor END)::bigint as delta_minor"
      )
    )
    .from('finance_transaction_lines as l')
    .innerJoin('finance_transactions as t', 't.id', 'l.transaction_id')
    .where('t.workspace_id', workspaceId)
    .andWhere('t.status', 'APPROVED')
    .andWhere('t.transaction_date', '<=', asOfDate)
    .groupBy('l.account_id');

  const deltaMap = new Map(deltas.map((entry) => [Number(entry.account_id), Number(entry.delta_minor || 0)]));

  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    currency: account.currency,
    opening_balance_minor: Number(account.opening_balance_minor || 0),
    ledger_delta_minor: Number(deltaMap.get(account.id) || 0),
    current_balance_minor:
      Number(account.opening_balance_minor || 0) + Number(deltaMap.get(account.id) || 0),
  }));
}

module.exports = {
  foldTotalsByCurrency,
  foldBaseTotals,
  monthlySummary,
  expenseBreakdown,
  cashflow,
  accountBalances,
};
