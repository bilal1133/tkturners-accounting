'use strict';

module.exports = {
  routes: [
    { method: 'GET', path: '/finance/health', handler: 'finance.health', config: { auth: false } },
    { method: 'GET', path: '/finance/health/db', handler: 'finance.healthDb', config: { auth: false } },
    { method: 'GET', path: '/finance/health/models', handler: 'finance.healthModels', config: { auth: false } },

    { method: 'GET', path: '/finance/me', handler: 'finance.me' },

    { method: 'GET', path: '/finance/settings', handler: 'finance.getSettings' },
    { method: 'PATCH', path: '/finance/settings', handler: 'finance.updateSettings' },

    { method: 'GET', path: '/finance/accounts', handler: 'finance.listAccounts' },
    { method: 'GET', path: '/finance/accounts/:id', handler: 'finance.getAccount' },
    { method: 'POST', path: '/finance/accounts', handler: 'finance.createAccount' },
    { method: 'PATCH', path: '/finance/accounts/:id', handler: 'finance.updateAccount' },
    { method: 'DELETE', path: '/finance/accounts/:id', handler: 'finance.deleteAccount' },

    { method: 'GET', path: '/finance/categories', handler: 'finance.listCategories' },
    { method: 'POST', path: '/finance/categories', handler: 'finance.createCategory' },
    { method: 'PATCH', path: '/finance/categories/:id', handler: 'finance.updateCategory' },
    { method: 'DELETE', path: '/finance/categories/:id', handler: 'finance.deleteCategory' },

    { method: 'GET', path: '/finance/counterparties', handler: 'finance.listCounterparties' },
    { method: 'POST', path: '/finance/counterparties', handler: 'finance.createCounterparty' },
    { method: 'PATCH', path: '/finance/counterparties/:id', handler: 'finance.updateCounterparty' },
    { method: 'DELETE', path: '/finance/counterparties/:id', handler: 'finance.deleteCounterparty' },

    { method: 'GET', path: '/finance/departments', handler: 'finance.listDepartments' },
    { method: 'POST', path: '/finance/departments', handler: 'finance.createDepartment' },
    { method: 'PATCH', path: '/finance/departments/:id', handler: 'finance.updateDepartment' },
    { method: 'DELETE', path: '/finance/departments/:id', handler: 'finance.deleteDepartment' },

    { method: 'GET', path: '/finance/employees', handler: 'finance.listEmployees' },
    { method: 'GET', path: '/finance/employees/:id', handler: 'finance.getEmployee' },
    { method: 'POST', path: '/finance/employees', handler: 'finance.createEmployee' },
    { method: 'PATCH', path: '/finance/employees/:id', handler: 'finance.updateEmployee' },
    { method: 'DELETE', path: '/finance/employees/:id', handler: 'finance.deleteEmployee' },
    { method: 'GET', path: '/finance/employees/:id/timeline', handler: 'finance.getEmployeeTimeline' },

    { method: 'GET', path: '/finance/transactions', handler: 'finance.listTransactions' },
    { method: 'GET', path: '/finance/transactions/:id', handler: 'finance.getTransaction' },
    { method: 'POST', path: '/finance/transactions', handler: 'finance.createTransaction' },
    { method: 'PATCH', path: '/finance/transactions/:id', handler: 'finance.updateTransaction' },
    { method: 'DELETE', path: '/finance/transactions/:id', handler: 'finance.deleteTransaction' },
    { method: 'POST', path: '/finance/transactions/:id/approve', handler: 'finance.approveTransaction' },
    { method: 'POST', path: '/finance/transactions/:id/reject', handler: 'finance.rejectTransaction' },

    { method: 'GET', path: '/finance/subscriptions', handler: 'finance.listSubscriptions' },
    { method: 'POST', path: '/finance/subscriptions', handler: 'finance.createSubscription' },
    { method: 'PATCH', path: '/finance/subscriptions/:id', handler: 'finance.updateSubscription' },
    { method: 'DELETE', path: '/finance/subscriptions/:id', handler: 'finance.deleteSubscription' },
    { method: 'POST', path: '/finance/subscriptions/:id/generate', handler: 'finance.generateSubscription' },

    { method: 'GET', path: '/finance/payroll-runs', handler: 'finance.listPayrollRuns' },
    { method: 'POST', path: '/finance/payroll-runs', handler: 'finance.createPayrollRun' },
    { method: 'GET', path: '/finance/payroll-runs/:id', handler: 'finance.getPayrollRun' },
    { method: 'POST', path: '/finance/payroll-runs/:id/generate', handler: 'finance.generatePayrollRun' },
    { method: 'PATCH', path: '/finance/payroll-runs/:id/entries/:entryId', handler: 'finance.updatePayrollEntry' },
    { method: 'POST', path: '/finance/payroll-runs/:id/approve', handler: 'finance.approvePayrollRun' },
    { method: 'POST', path: '/finance/payroll-runs/:id/pay', handler: 'finance.payPayrollRun' },

    { method: 'GET', path: '/finance/loans', handler: 'finance.listLoans' },
    { method: 'POST', path: '/finance/loans', handler: 'finance.createLoan' },
    { method: 'GET', path: '/finance/loans/:id', handler: 'finance.getLoan' },
    { method: 'PATCH', path: '/finance/loans/:id', handler: 'finance.updateLoan' },
    { method: 'POST', path: '/finance/loans/:id/disburse', handler: 'finance.disburseLoan' },
    { method: 'POST', path: '/finance/loans/:id/repay', handler: 'finance.repayLoan' },

    { method: 'GET', path: '/finance/reports/monthly-summary', handler: 'finance.monthlySummary' },
    { method: 'GET', path: '/finance/reports/expense-breakdown', handler: 'finance.expenseBreakdown' },
    { method: 'GET', path: '/finance/reports/cashflow', handler: 'finance.cashflow' },
    { method: 'GET', path: '/finance/reports/account-balances', handler: 'finance.accountBalances' },
    { method: 'GET', path: '/finance/reports/payroll-summary', handler: 'finance.payrollSummary' },
    { method: 'GET', path: '/finance/reports/payroll-by-department', handler: 'finance.payrollByDepartment' },
    { method: 'GET', path: '/finance/reports/loan-outstanding', handler: 'finance.loanOutstanding' },
    { method: 'GET', path: '/finance/reports/employee-ledger', handler: 'finance.employeeLedger' },

    { method: 'GET', path: '/finance/exports/transactions.csv', handler: 'finance.exportTransactionsCsv' },
    { method: 'GET', path: '/finance/exports/monthly-summary.csv', handler: 'finance.exportMonthlySummaryCsv' },
    { method: 'GET', path: '/finance/exports/payroll.csv', handler: 'finance.exportPayrollCsv' },
    { method: 'GET', path: '/finance/exports/loan-ledger.csv', handler: 'finance.exportLoanLedgerCsv' },

    {
      method: 'POST',
      path: '/finance/cron/subscriptions',
      handler: 'finance.subscriptionCron',
      config: { auth: false },
    },
  ],
};
