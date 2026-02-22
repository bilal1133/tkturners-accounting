function toCsv(rows, columns) {
  const escaped = (value) => {
    if (value === null || value === undefined) return '';
    const string = String(value);
    if (string.includes(',') || string.includes('"') || string.includes('\n')) {
      return `"${string.replace(/"/g, '""')}"`;
    }
    return string;
  };

  const header = columns.map((column) => escaped(column.header)).join(',');
  const lines = rows.map((row) => columns.map((column) => escaped(row[column.key])).join(','));

  return [header, ...lines].join('\n');
}

function transactionsCsvRows(transactions) {
  return transactions.map((tx) => ({
    id: tx.id,
    date: tx.transaction_date,
    type: tx.type,
    status: tx.status,
    source: tx.source,
    amount_minor: tx.amount_minor,
    currency: tx.currency,
    base_amount_minor: tx.base_amount_minor,
    description: tx.description,
    category: tx.category_name || '',
    counterparty: tx.counterparty_name || '',
    from_account: tx.from_account_name || '',
    to_account: tx.to_account_name || '',
    created_by: tx.created_by_email || '',
    approved_by: tx.approved_by_email || '',
    approved_at: tx.approved_at || '',
  }));
}

function monthlySummaryCsvRows(summary) {
  if (summary.mode === 'base') {
    return [
      {
        month: summary.month,
        mode: summary.mode,
        currency: summary.base_currency,
        revenue: summary.totals.revenue,
        expense: summary.totals.expense,
        profit_loss: summary.totals.profit_loss,
        cash_in: summary.totals.cash_in,
        cash_out: summary.totals.cash_out,
        transfer_volume: summary.totals.transfer_volume,
        excluded_unconverted_count: summary.totals.excluded_unconverted_count,
      },
    ];
  }

  return summary.by_currency.map((entry) => ({
    month: summary.month,
    mode: summary.mode,
    currency: entry.currency,
    revenue: entry.revenue,
    expense: entry.expense,
    profit_loss: entry.profit_loss,
    cash_in: entry.cash_in,
    cash_out: entry.cash_out,
    transfer_volume: entry.transfer_volume,
    excluded_unconverted_count: summary.excluded_unconverted_count || 0,
  }));
}

function payrollCsvRows(summary) {
  return (summary.rows || []).map((row) => ({
    payroll_entry_id: row.payroll_entry_id,
    employee_id: row.employee_id,
    employee_name: row.employee_name,
    department_name: row.department_name || '',
    department_code: row.department_code || '',
    period_month: row.period_month,
    run_status: row.run_status,
    base_salary_minor: row.base_salary_minor,
    allowances_minor: row.allowances_minor,
    non_loan_deductions_minor: row.non_loan_deductions_minor,
    planned_loan_deduction_minor: row.planned_loan_deduction_minor,
    actual_loan_deduction_minor: row.actual_loan_deduction_minor,
    net_paid_minor: row.net_paid_minor,
    salary_expense_transaction_id: row.salary_expense_transaction_id,
    payout_from_account_id: row.payout_from_account_id,
    payout_to_account_id: row.payout_to_account_id,
    payout_from_amount_minor: row.payout_from_amount_minor,
    payout_from_currency: row.payout_from_currency,
    payout_to_amount_minor: row.payout_to_amount_minor,
    payout_to_currency: row.payout_to_currency,
    payout_fx_rate: row.payout_fx_rate,
    payout_transfer_transaction_id: row.payout_transfer_transaction_id,
    payout_transfer_fee_transaction_id: row.payout_transfer_fee_transaction_id,
    payout_additional_fee_total_minor: row.payout_additional_fee_total_minor,
    payout_additional_fee_count: row.payout_additional_fee_count,
  }));
}

function loanLedgerCsvRows(report) {
  return (report.rows || []).map((row) => ({
    loan_id: row.id,
    employee_id: row.employee_id,
    employee_name: row.employee_name,
    currency: row.currency,
    status: row.status,
    principal_minor: row.principal_minor,
    installment_minor: row.installment_minor,
    annual_interest_bps: row.annual_interest_bps,
    outstanding_principal_minor: row.outstanding_principal_minor,
    outstanding_interest_minor: row.outstanding_interest_minor,
    outstanding_total_minor: Number(row.outstanding_principal_minor || 0) + Number(row.outstanding_interest_minor || 0),
    disbursement_date: row.disbursement_date,
    next_due_date: row.next_due_date,
    disbursement_account_id: row.disbursement_account_id,
    receivable_control_account_id: row.receivable_control_account_id,
    disbursement_transaction_id: row.disbursement_transaction_id,
  }));
}

const TRANSACTION_COLUMNS = [
  { key: 'id', header: 'id' },
  { key: 'date', header: 'date' },
  { key: 'type', header: 'type' },
  { key: 'status', header: 'status' },
  { key: 'source', header: 'source' },
  { key: 'amount_minor', header: 'amount_minor' },
  { key: 'currency', header: 'currency' },
  { key: 'base_amount_minor', header: 'base_amount_minor' },
  { key: 'description', header: 'description' },
  { key: 'category', header: 'category' },
  { key: 'counterparty', header: 'counterparty' },
  { key: 'from_account', header: 'from_account' },
  { key: 'to_account', header: 'to_account' },
  { key: 'created_by', header: 'created_by' },
  { key: 'approved_by', header: 'approved_by' },
  { key: 'approved_at', header: 'approved_at' },
];

const SUMMARY_COLUMNS = [
  { key: 'month', header: 'month' },
  { key: 'mode', header: 'mode' },
  { key: 'currency', header: 'currency' },
  { key: 'revenue', header: 'revenue_minor' },
  { key: 'expense', header: 'expense_minor' },
  { key: 'profit_loss', header: 'profit_loss_minor' },
  { key: 'cash_in', header: 'cash_in_minor' },
  { key: 'cash_out', header: 'cash_out_minor' },
  { key: 'transfer_volume', header: 'transfer_volume_minor' },
  { key: 'excluded_unconverted_count', header: 'excluded_unconverted_count' },
];

const PAYROLL_COLUMNS = [
  { key: 'payroll_entry_id', header: 'payroll_entry_id' },
  { key: 'employee_id', header: 'employee_id' },
  { key: 'employee_name', header: 'employee_name' },
  { key: 'department_name', header: 'department_name' },
  { key: 'department_code', header: 'department_code' },
  { key: 'period_month', header: 'period_month' },
  { key: 'run_status', header: 'run_status' },
  { key: 'base_salary_minor', header: 'base_salary_minor' },
  { key: 'allowances_minor', header: 'allowances_minor' },
  { key: 'non_loan_deductions_minor', header: 'non_loan_deductions_minor' },
  { key: 'planned_loan_deduction_minor', header: 'planned_loan_deduction_minor' },
  { key: 'actual_loan_deduction_minor', header: 'actual_loan_deduction_minor' },
  { key: 'net_paid_minor', header: 'net_paid_minor' },
  { key: 'salary_expense_transaction_id', header: 'salary_expense_transaction_id' },
  { key: 'payout_from_account_id', header: 'payout_from_account_id' },
  { key: 'payout_to_account_id', header: 'payout_to_account_id' },
  { key: 'payout_from_amount_minor', header: 'payout_from_amount_minor' },
  { key: 'payout_from_currency', header: 'payout_from_currency' },
  { key: 'payout_to_amount_minor', header: 'payout_to_amount_minor' },
  { key: 'payout_to_currency', header: 'payout_to_currency' },
  { key: 'payout_fx_rate', header: 'payout_fx_rate' },
  { key: 'payout_transfer_transaction_id', header: 'payout_transfer_transaction_id' },
  { key: 'payout_transfer_fee_transaction_id', header: 'payout_transfer_fee_transaction_id' },
  { key: 'payout_additional_fee_total_minor', header: 'payout_additional_fee_total_minor' },
  { key: 'payout_additional_fee_count', header: 'payout_additional_fee_count' },
];

const LOAN_LEDGER_COLUMNS = [
  { key: 'loan_id', header: 'loan_id' },
  { key: 'employee_id', header: 'employee_id' },
  { key: 'employee_name', header: 'employee_name' },
  { key: 'currency', header: 'currency' },
  { key: 'status', header: 'status' },
  { key: 'principal_minor', header: 'principal_minor' },
  { key: 'installment_minor', header: 'installment_minor' },
  { key: 'annual_interest_bps', header: 'annual_interest_bps' },
  { key: 'outstanding_principal_minor', header: 'outstanding_principal_minor' },
  { key: 'outstanding_interest_minor', header: 'outstanding_interest_minor' },
  { key: 'outstanding_total_minor', header: 'outstanding_total_minor' },
  { key: 'disbursement_date', header: 'disbursement_date' },
  { key: 'next_due_date', header: 'next_due_date' },
  { key: 'disbursement_account_id', header: 'disbursement_account_id' },
  { key: 'receivable_control_account_id', header: 'receivable_control_account_id' },
  { key: 'disbursement_transaction_id', header: 'disbursement_transaction_id' },
];

module.exports = {
  toCsv,
  transactionsCsvRows,
  monthlySummaryCsvRows,
  payrollCsvRows,
  loanLedgerCsvRows,
  TRANSACTION_COLUMNS,
  SUMMARY_COLUMNS,
  PAYROLL_COLUMNS,
  LOAN_LEDGER_COLUMNS,
};
