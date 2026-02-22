'use strict';

const { requireMembership, requireRole } = require('../../../lib/finance/auth');
const { handleControllerError } = require('../../../lib/finance/errors');
const {
  getWorkspaceSettings,
  updateWorkspaceSettings,
  listAccounts,
  getAccountDetail,
  createAccount,
  updateAccount,
  deleteAccount,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listCounterparties,
  createCounterparty,
  updateCounterparty,
  deleteCounterparty,
  listTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  changeTransactionStatus,
  deleteTransaction,
  listSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  generateSubscriptionRun,
  runSubscriptionCron,
} = require('../../../lib/finance/transactions');
const { knex } = require('../../../lib/finance/db');
const {
  monthlySummary,
  expenseBreakdown,
  cashflow,
  accountBalances,
} = require('../../../lib/finance/reports');
const {
  getHealthModels,
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
} = require('../../../lib/finance/payroll');
const {
  toCsv,
  transactionsCsvRows,
  monthlySummaryCsvRows,
  payrollCsvRows,
  loanLedgerCsvRows,
  TRANSACTION_COLUMNS,
  SUMMARY_COLUMNS,
  PAYROLL_COLUMNS,
  LOAN_LEDGER_COLUMNS,
} = require('../../../lib/finance/exports');

module.exports = {
  async health(ctx) {
    ctx.body = {
      ok: true,
      service: 'finance-api',
      timestamp: new Date().toISOString(),
    };
  },

  async healthDb(ctx) {
    try {
      await knex().raw('select 1 as ok');
      ctx.body = {
        ok: true,
        db: 'reachable',
      };
    } catch (error) {
      ctx.status = 503;
      ctx.body = {
        ok: false,
        db: 'unreachable',
        error: error.message,
      };
    }
  },

  async healthModels(ctx) {
    try {
      ctx.body = await getHealthModels();
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async me(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      const workspace = await getWorkspaceSettings(membership.workspace_id);

      ctx.body = {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
        },
        membership: {
          workspace_id: membership.workspace_id,
          role: membership.role,
        },
        workspace,
      };
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async getSettings(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      const workspace = await getWorkspaceSettings(membership.workspace_id);
      ctx.body = workspace;
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async updateSettings(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ADMIN');

      const workspace = await updateWorkspaceSettings(membership.workspace_id, ctx.request.body || {});
      ctx.body = workspace;
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async listAccounts(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      ctx.body = await listAccounts(membership.workspace_id);
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async getAccount(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      ctx.body = await getAccountDetail(membership.workspace_id, Number(ctx.params.id));
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async createAccount(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await createAccount(membership.workspace_id, user.id, ctx.request.body || {});
      ctx.status = 201;
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async updateAccount(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await updateAccount(
        membership.workspace_id,
        user.id,
        Number(ctx.params.id),
        ctx.request.body || {}
      );
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async deleteAccount(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await deleteAccount(membership.workspace_id, user.id, Number(ctx.params.id));
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async listCategories(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      ctx.body = await listCategories(membership.workspace_id);
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async createCategory(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await createCategory(membership.workspace_id, user.id, ctx.request.body || {});
      ctx.status = 201;
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async updateCategory(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await updateCategory(
        membership.workspace_id,
        user.id,
        Number(ctx.params.id),
        ctx.request.body || {}
      );
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async deleteCategory(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await deleteCategory(membership.workspace_id, user.id, Number(ctx.params.id));
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async listCounterparties(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      ctx.body = await listCounterparties(membership.workspace_id);
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async createCounterparty(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await createCounterparty(membership.workspace_id, user.id, ctx.request.body || {});
      ctx.status = 201;
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async updateCounterparty(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await updateCounterparty(
        membership.workspace_id,
        user.id,
        Number(ctx.params.id),
        ctx.request.body || {}
      );
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async deleteCounterparty(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await deleteCounterparty(membership.workspace_id, user.id, Number(ctx.params.id));
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async listDepartments(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await listDepartments(membership.workspace_id);
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async createDepartment(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await createDepartment(membership.workspace_id, user.id, ctx.request.body || {});
      ctx.status = 201;
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async updateDepartment(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await updateDepartment(
        membership.workspace_id,
        user.id,
        Number(ctx.params.id),
        ctx.request.body || {}
      );
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async deleteDepartment(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await deleteDepartment(membership.workspace_id, user.id, Number(ctx.params.id));
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async listEmployees(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await listEmployees(membership.workspace_id);
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async getEmployee(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await getEmployee(membership.workspace_id, Number(ctx.params.id));
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async createEmployee(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await createEmployee(membership.workspace_id, user.id, ctx.request.body || {});
      ctx.status = 201;
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async updateEmployee(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await updateEmployee(
        membership.workspace_id,
        user.id,
        Number(ctx.params.id),
        ctx.request.body || {}
      );
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async deleteEmployee(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await deleteEmployee(membership.workspace_id, user.id, Number(ctx.params.id));
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async getEmployeeTimeline(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await getEmployeeTimeline(membership.workspace_id, Number(ctx.params.id));
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async listTransactions(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      ctx.body = await listTransactions(membership.workspace_id, ctx.query || {});
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async getTransaction(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      ctx.body = await getTransaction(membership.workspace_id, Number(ctx.params.id));
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async createTransaction(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      const workspace = await getWorkspaceSettings(membership.workspace_id);

      ctx.body = await createTransaction(workspace, user.id, ctx.request.body || {});
      ctx.status = 201;
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async updateTransaction(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      const workspace = await getWorkspaceSettings(membership.workspace_id);

      ctx.body = await updateTransaction(workspace, user.id, Number(ctx.params.id), ctx.request.body || {});
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async deleteTransaction(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await deleteTransaction(membership.workspace_id, user.id, Number(ctx.params.id));
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async approveTransaction(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ADMIN');
      ctx.body = await changeTransactionStatus(
        membership.workspace_id,
        user.id,
        Number(ctx.params.id),
        'APPROVED',
        ctx.request.body?.comment || null
      );
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async rejectTransaction(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ADMIN');
      ctx.body = await changeTransactionStatus(
        membership.workspace_id,
        user.id,
        Number(ctx.params.id),
        'REJECTED',
        ctx.request.body?.comment || null
      );
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async listSubscriptions(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      ctx.body = await listSubscriptions(membership.workspace_id);
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async createSubscription(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await createSubscription(membership.workspace_id, user.id, ctx.request.body || {});
      ctx.status = 201;
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async updateSubscription(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await updateSubscription(
        membership.workspace_id,
        user.id,
        Number(ctx.params.id),
        ctx.request.body || {}
      );
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async deleteSubscription(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await deleteSubscription(membership.workspace_id, user.id, Number(ctx.params.id));
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async generateSubscription(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      const workspace = await getWorkspaceSettings(membership.workspace_id);

      ctx.body = await generateSubscriptionRun(workspace, user.id, Number(ctx.params.id));
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async listPayrollRuns(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await listPayrollRuns(membership.workspace_id, ctx.query || {});
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async getPayrollRun(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await getPayrollRun(membership.workspace_id, Number(ctx.params.id));
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async createPayrollRun(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await createPayrollRun(membership.workspace_id, user.id, ctx.request.body || {});
      ctx.status = 201;
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async generatePayrollRun(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      const workspace = await getWorkspaceSettings(membership.workspace_id);
      ctx.body = await generatePayrollRunEntries(workspace, user.id, Number(ctx.params.id));
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async updatePayrollEntry(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await updatePayrollEntry(
        membership.workspace_id,
        user.id,
        Number(ctx.params.id),
        Number(ctx.params.entryId),
        ctx.request.body || {}
      );
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async approvePayrollRun(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await approvePayrollRun(membership.workspace_id, user.id, Number(ctx.params.id));
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async payPayrollRun(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      const workspace = await getWorkspaceSettings(membership.workspace_id);
      ctx.body = await payPayrollRun(workspace, user.id, Number(ctx.params.id), ctx.request.body || {});
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async listLoans(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await listLoans(membership.workspace_id, ctx.query || {});
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async getLoan(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await getLoan(membership.workspace_id, Number(ctx.params.id));
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async createLoan(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      const workspace = await getWorkspaceSettings(membership.workspace_id);
      ctx.body = await createLoan(workspace, user.id, ctx.request.body || {});
      ctx.status = 201;
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async updateLoan(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      ctx.body = await updateLoan(
        membership.workspace_id,
        user.id,
        Number(ctx.params.id),
        ctx.request.body || {}
      );
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async disburseLoan(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      const workspace = await getWorkspaceSettings(membership.workspace_id);
      ctx.body = await disburseLoan(workspace, user.id, Number(ctx.params.id), ctx.request.body || {});
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async repayLoan(ctx) {
    try {
      const { user, membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      const workspace = await getWorkspaceSettings(membership.workspace_id);
      ctx.body = await repayLoan(workspace, user.id, Number(ctx.params.id), ctx.request.body || {});
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async monthlySummary(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      const workspace = await getWorkspaceSettings(membership.workspace_id);
      const month = ctx.query.month || new Date().toISOString().slice(0, 7);
      const mode = ctx.query.mode === 'base' ? 'base' : 'per_currency';

      ctx.body = await monthlySummary(workspace, month, mode);
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async expenseBreakdown(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      const month = ctx.query.month || new Date().toISOString().slice(0, 7);
      ctx.body = await expenseBreakdown(membership.workspace_id, month);
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async cashflow(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      const workspace = await getWorkspaceSettings(membership.workspace_id);
      const from = ctx.query.from || new Date().toISOString().slice(0, 7);
      const to = ctx.query.to || from;
      ctx.body = await cashflow(workspace, from, to);
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async accountBalances(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      const asOf = ctx.query.as_of || new Date().toISOString().slice(0, 10);
      ctx.body = await accountBalances(membership.workspace_id, asOf);
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async payrollSummary(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      const month = ctx.query.month || new Date().toISOString().slice(0, 7);
      ctx.body = await payrollSummaryReport(membership.workspace_id, month);
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async payrollByDepartment(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      const workspace = await getWorkspaceSettings(membership.workspace_id);
      const month = ctx.query.month || new Date().toISOString().slice(0, 7);
      const mode = ctx.query.mode === 'per_currency' ? 'per_currency' : 'base';
      ctx.body = await payrollByDepartmentReport(workspace, month, mode);
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async loanOutstanding(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      const asOf = ctx.query.as_of || new Date().toISOString().slice(0, 10);
      ctx.body = await loanOutstandingReport(membership.workspace_id, asOf);
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async employeeLedger(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      const employeeId = Number(ctx.query.employee_id);
      const from = ctx.query.from || new Date().toISOString().slice(0, 7);
      const to = ctx.query.to || from;
      ctx.body = await employeeLedgerReport(membership.workspace_id, employeeId, from, to);
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async exportTransactionsCsv(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      const transactions = await listTransactions(membership.workspace_id, ctx.query || {});
      const rows = transactionsCsvRows(transactions);
      const csv = toCsv(rows, TRANSACTION_COLUMNS);

      ctx.set('Content-Type', 'text/csv');
      ctx.set('Content-Disposition', `attachment; filename=transactions-${Date.now()}.csv`);
      ctx.body = csv;
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async exportMonthlySummaryCsv(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      const workspace = await getWorkspaceSettings(membership.workspace_id);
      const month = ctx.query.month || new Date().toISOString().slice(0, 7);
      const mode = ctx.query.mode === 'base' ? 'base' : 'per_currency';

      const summary = await monthlySummary(workspace, month, mode);
      const rows = monthlySummaryCsvRows(summary);
      const csv = toCsv(rows, SUMMARY_COLUMNS);

      ctx.set('Content-Type', 'text/csv');
      ctx.set('Content-Disposition', `attachment; filename=monthly-summary-${month}.csv`);
      ctx.body = csv;
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async exportPayrollCsv(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      const month = ctx.query.month || new Date().toISOString().slice(0, 7);
      const report = await payrollSummaryReport(membership.workspace_id, month);
      const rows = payrollCsvRows(report);
      const csv = toCsv(rows, PAYROLL_COLUMNS);

      ctx.set('Content-Type', 'text/csv');
      ctx.set('Content-Disposition', `attachment; filename=payroll-${month}.csv`);
      ctx.body = csv;
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async exportLoanLedgerCsv(ctx) {
    try {
      const { membership } = await requireMembership(ctx);
      requireRole(membership, 'ACCOUNTANT');
      const asOf = ctx.query.as_of || new Date().toISOString().slice(0, 10);
      const report = await loanOutstandingReport(membership.workspace_id, asOf);
      const rows = loanLedgerCsvRows(report);
      const csv = toCsv(rows, LOAN_LEDGER_COLUMNS);

      ctx.set('Content-Type', 'text/csv');
      ctx.set('Content-Disposition', `attachment; filename=loan-ledger-${asOf}.csv`);
      ctx.body = csv;
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async subscriptionCron(ctx) {
    try {
      const secret = process.env.CRON_SECRET;
      if (secret) {
        const incoming = ctx.request.headers['x-cron-secret'];
        if (incoming !== secret) {
          ctx.status = 401;
          ctx.body = { error: 'Invalid cron secret.' };
          return;
        }
      }

      const autoGenerate = String(ctx.query.auto_generate || 'false').toLowerCase() === 'true';
      const actorUserId = Number(ctx.query.actor_user_id || 1);
      const workspaceId = Number(ctx.query.workspace_id || 1);

      const workspace = await getWorkspaceSettings(workspaceId);
      const result = await runSubscriptionCron(workspace.id, autoGenerate, actorUserId);
      ctx.body = result;
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },
};
