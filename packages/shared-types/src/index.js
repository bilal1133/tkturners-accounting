const { z } = require('zod');

const TransactionTypeEnum = z.enum(['INCOME', 'EXPENSE', 'TRANSFER']);
const TransactionSourceEnum = z.enum(['WEB', 'SLACK', 'SYSTEM']);
const TransactionStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
const MemberRoleEnum = z.enum(['ADMIN', 'ACCOUNTANT', 'VIEWER']);
const DirectionEnum = z.enum(['IN', 'OUT']);
const AccountKindEnum = z.enum(['CASH', 'LOAN_RECEIVABLE_CONTROL']);
const EmployeeStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);
const PayrollRunStatusEnum = z.enum(['DRAFT', 'APPROVED', 'PAID']);
const LoanStatusEnum = z.enum(['DRAFT', 'APPROVED', 'ACTIVE', 'CLOSED', 'CANCELED']);
const LoanScheduleStatusEnum = z.enum(['DUE', 'PARTIAL', 'PAID']);

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);
const currencyCodeSchema = z.string().trim().length(3).transform((v) => v.toUpperCase());

const MoneySchema = z.object({
  amount_minor: z.number().int().positive(),
  currency: currencyCodeSchema,
});

const BaseTransactionSchema = z.object({
  date: dateSchema,
  description: z.string().trim().min(1).max(500),
  category_id: z.number().int().positive().optional(),
  counterparty_id: z.number().int().positive().nullable().optional(),
  source: TransactionSourceEnum.default('WEB'),
  status: TransactionStatusEnum.optional(),
  fx_rate_to_base: z.number().positive().optional(),
  metadata: z.record(z.any()).optional(),
});

const IncomeExpenseInputSchema = BaseTransactionSchema.extend({
  type: z.enum(['INCOME', 'EXPENSE']),
  account_id: z.number().int().positive(),
}).merge(MoneySchema);

const TransferInputSchema = BaseTransactionSchema.extend({
  type: z.literal('TRANSFER'),
  from_account_id: z.number().int().positive(),
  to_account_id: z.number().int().positive(),
  from_amount_minor: z.number().int().positive(),
  from_currency: currencyCodeSchema,
  to_amount_minor: z.number().int().positive(),
  to_currency: currencyCodeSchema,
  fx_rate: z.number().positive().optional(),
  fee_amount_minor: z.number().int().positive().optional(),
  fee_currency: currencyCodeSchema.optional(),
  fee_category_id: z.number().int().positive().optional(),
  fee_fx_rate_to_base: z.number().positive().optional(),
  fee_description: z.string().trim().min(1).max(500).optional(),
});

const CreateTransactionInputSchema = z
  .discriminatedUnion('type', [IncomeExpenseInputSchema, TransferInputSchema])
  .superRefine((payload, ctx) => {
    if (payload.type === 'TRANSFER' && payload.fee_amount_minor && !payload.fee_currency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fee_currency'],
        message: 'fee_currency is required when fee_amount_minor is provided.',
      });
    }
  });

const AccountInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  owner_user_id: z.number().int().positive().nullable().optional(),
  currency: currencyCodeSchema,
  opening_balance_minor: z.number().int().default(0),
  notes: z.string().trim().max(500).nullable().optional(),
  is_active: z.boolean().optional(),
  account_kind: AccountKindEnum.optional(),
  is_system: z.boolean().optional(),
});

const CategoryInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(['INCOME', 'EXPENSE', 'BOTH']).default('EXPENSE'),
});

const DepartmentInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(32).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  is_active: z.boolean().optional(),
});

const CounterpartyInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(['CLIENT', 'VENDOR', 'BOTH', 'UNKNOWN', 'EMPLOYEE']).default('UNKNOWN'),
  notes: z.string().trim().max(500).nullable().optional(),
});

const SubscriptionInputSchema = z.object({
  vendor_counterparty_id: z.number().int().positive(),
  amount_minor: z.number().int().positive(),
  currency: currencyCodeSchema,
  account_id: z.number().int().positive(),
  category_id: z.number().int().positive(),
  frequency: z.enum(['MONTHLY', 'ANNUAL', 'CUSTOM']),
  interval_count: z.number().int().positive().default(1),
  next_run_date: dateSchema,
  is_active: z.boolean().default(true),
  description: z.string().trim().max(500).nullable().optional(),
});

const EmployeeInputSchema = z.object({
  employee_code: z.string().trim().min(1).max(32).optional(),
  full_name: z.string().trim().min(1).max(160),
  email: z.string().email().nullable().optional(),
  join_date: dateSchema.nullable().optional(),
  status: EmployeeStatusEnum.default('ACTIVE'),
  payroll_currency: currencyCodeSchema,
  settlement_iban: z.string().trim().min(5).max(64),
  default_payout_account_id: z.number().int().positive(),
  default_funding_account_id: z.number().int().positive().nullable().optional(),
  department_id: z.number().int().positive().nullable().optional(),
  base_salary_minor: z.number().int().nonnegative().default(0),
  default_allowances_minor: z.number().int().nonnegative().default(0),
  default_non_loan_deductions_minor: z.number().int().nonnegative().default(0),
  notes: z.string().trim().max(1000).nullable().optional(),
});

const PayrollRunCreateSchema = z.object({
  period_month: monthSchema,
  cutoff_date: dateSchema.optional(),
  payday_date: dateSchema,
});

const PayrollEntryUpdateSchema = z
  .object({
    base_salary_minor: z.number().int().nonnegative().optional(),
    allowances_minor: z.number().int().nonnegative().optional(),
    non_loan_deductions_minor: z.number().int().nonnegative().optional(),
    planned_loan_deduction_minor: z.number().int().nonnegative().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided.',
  });

const EmployeeLoanCreateSchema = z.object({
  employee_id: z.number().int().positive(),
  currency: currencyCodeSchema,
  principal_minor: z.number().int().positive(),
  annual_interest_bps: z.number().int().nonnegative().default(0),
  installment_minor: z.number().int().positive(),
  disbursement_account_id: z.number().int().positive(),
  receivable_control_account_id: z.number().int().positive().optional(),
  first_due_date: dateSchema.optional(),
});

const EmployeeLoanUpdateSchema = z
  .object({
    annual_interest_bps: z.number().int().nonnegative().optional(),
    installment_minor: z.number().int().positive().optional(),
    status: LoanStatusEnum.optional(),
    next_due_date: dateSchema.optional(),
    disbursement_account_id: z.number().int().positive().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided.',
  });

const LoanRepaymentInputSchema = z.object({
  repayment_date: dateSchema,
  amount_minor: z.number().int().positive(),
  cash_account_id: z.number().int().positive(),
  note: z.string().trim().max(500).optional(),
});

const LoanDisbursementInputSchema = z
  .object({
    disbursement_date: dateSchema.optional(),
    from_amount_minor: z.number().int().positive().optional(),
    fx_rate: z.number().positive().optional(),
    transfer_fee_amount_minor: z.number().int().positive().optional(),
    transfer_fee_currency: currencyCodeSchema.optional(),
    transfer_fee_category_id: z.number().int().positive().optional(),
    transfer_fee_fx_rate_to_base: z.number().positive().optional(),
    transfer_fee_description: z.string().trim().min(1).max(500).optional(),
  })
  .superRefine((payload, ctx) => {
    if (payload.transfer_fee_amount_minor && !payload.transfer_fee_currency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['transfer_fee_currency'],
        message: 'transfer_fee_currency is required when transfer_fee_amount_minor is provided.',
      });
    }
  });

const PayrollAdditionalFeeSchema = z.object({
  amount_minor: z.number().int().positive(),
  currency: currencyCodeSchema.optional(),
  category_id: z.number().int().positive().optional(),
  fx_rate_to_base: z.number().positive().optional(),
  description: z.string().trim().min(1).max(500).optional(),
});

const PayrollEntryPaymentInputSchema = z
  .object({
    entry_id: z.number().int().positive(),
    from_account_id: z.number().int().positive().optional(),
    to_account_id: z.number().int().positive().optional(),
    from_amount_minor: z.number().int().positive().optional(),
    from_currency: currencyCodeSchema.optional(),
    to_amount_minor: z.number().int().positive().optional(),
    to_currency: currencyCodeSchema.optional(),
    fx_rate: z.number().positive().optional(),
    transfer_fee_amount_minor: z.number().int().positive().optional(),
    transfer_fee_currency: currencyCodeSchema.optional(),
    transfer_fee_category_id: z.number().int().positive().optional(),
    transfer_fee_fx_rate_to_base: z.number().positive().optional(),
    transfer_fee_description: z.string().trim().min(1).max(500).optional(),
    additional_fees: z.array(PayrollAdditionalFeeSchema).max(10).optional(),
  })
  .superRefine((payload, ctx) => {
    if (payload.transfer_fee_amount_minor && !payload.transfer_fee_currency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['transfer_fee_currency'],
        message: 'transfer_fee_currency is required when transfer_fee_amount_minor is provided.',
      });
    }
  });

const PayrollPayActionSchema = z
  .object({
    payment_date: dateSchema.optional(),
    entry_ids: z.array(z.number().int().positive()).optional(),
    default_from_account_id: z.number().int().positive().optional(),
    default_to_account_id: z.number().int().positive().optional(),
    entry_payments: z.array(PayrollEntryPaymentInputSchema).optional(),
  })
  .superRefine((payload, ctx) => {
    if (!Array.isArray(payload.entry_payments)) {
      return;
    }

    const seen = new Set();
    for (const [index, payment] of payload.entry_payments.entries()) {
      if (seen.has(payment.entry_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['entry_payments', index, 'entry_id'],
          message: `Duplicate entry_id ${payment.entry_id} in entry_payments.`,
        });
      }
      seen.add(payment.entry_id);
    }
  });

const EmployeeTimelineResponseSchema = z.object({
  employee: z.record(z.any()),
  payroll_entries: z.array(z.record(z.any())),
  loans: z.array(z.record(z.any())),
  repayments: z.array(z.record(z.any())),
  transactions: z.array(z.record(z.any())),
  events: z.array(z.record(z.any())),
});

const PayrollSummaryResponseSchema = z.object({
  month: monthSchema,
  totals: z.object({
    employees_count: z.number().int().nonnegative(),
    gross_minor: z.number().int(),
    non_loan_deductions_minor: z.number().int(),
    actual_loan_deductions_minor: z.number().int(),
    net_paid_minor: z.number().int(),
    principal_repaid_minor: z.number().int(),
    interest_repaid_minor: z.number().int(),
  }),
  rows: z.array(z.record(z.any())),
});

const LoanOutstandingResponseSchema = z.object({
  as_of: dateSchema,
  totals: z.object({
    loans_count: z.number().int().nonnegative(),
    outstanding_principal_minor: z.number().int(),
    outstanding_interest_minor: z.number().int(),
    outstanding_total_minor: z.number().int(),
  }),
  rows: z.array(z.record(z.any())),
});

module.exports = {
  z,
  MemberRoleEnum,
  DirectionEnum,
  TransactionTypeEnum,
  TransactionSourceEnum,
  TransactionStatusEnum,
  AccountKindEnum,
  EmployeeStatusEnum,
  PayrollRunStatusEnum,
  LoanStatusEnum,
  LoanScheduleStatusEnum,
  MoneySchema,
  AccountInputSchema,
  CategoryInputSchema,
  DepartmentInputSchema,
  CounterpartyInputSchema,
  CreateTransactionInputSchema,
  SubscriptionInputSchema,
  EmployeeInputSchema,
  PayrollRunCreateSchema,
  PayrollEntryUpdateSchema,
  EmployeeLoanCreateSchema,
  EmployeeLoanUpdateSchema,
  LoanRepaymentInputSchema,
  LoanDisbursementInputSchema,
  PayrollAdditionalFeeSchema,
  PayrollEntryPaymentInputSchema,
  PayrollPayActionSchema,
  EmployeeTimelineResponseSchema,
  PayrollSummaryResponseSchema,
  LoanOutstandingResponseSchema,
};
