const {
  computePayrollAmounts,
  calculateMonthlyInterestMinor,
  allocateLoanPayment,
} = require('../src/lib/finance/payroll-utils');

describe('payroll and loan utils', () => {
  it('computes payroll net pay with capped loan deduction', () => {
    const values = computePayrollAmounts({
      baseSalaryMinor: 100000,
      allowancesMinor: 10000,
      nonLoanDeductionsMinor: 15000,
      plannedLoanDeductionMinor: 50000,
    });

    expect(values.gross_minor).toBe(110000);
    expect(values.expense_base_minor).toBe(95000);
    expect(values.actual_loan_deduction_minor).toBe(50000);
    expect(values.net_paid_minor).toBe(45000);
  });

  it('prevents negative net pay and deduction overflow', () => {
    const values = computePayrollAmounts({
      baseSalaryMinor: 10000,
      allowancesMinor: 0,
      nonLoanDeductionsMinor: 9000,
      plannedLoanDeductionMinor: 5000,
    });

    expect(values.expense_base_minor).toBe(1000);
    expect(values.actual_loan_deduction_minor).toBe(1000);
    expect(values.net_paid_minor).toBe(0);
  });

  it('calculates monthly interest from annual bps', () => {
    const interest = calculateMonthlyInterestMinor(120000, 1200);
    expect(interest).toBe(1200);
  });

  it('allocates loan payment to interest first then principal', () => {
    const rows = [
      {
        id: 1,
        due_date: '2026-01-31',
        principal_due_minor: 10000,
        interest_due_minor: 1000,
        principal_paid_minor: 0,
        interest_paid_minor: 0,
        status: 'DUE',
      },
    ];

    const allocation = allocateLoanPayment(rows, 3000);
    expect(allocation.interest_paid_minor).toBe(1000);
    expect(allocation.principal_paid_minor).toBe(2000);
    expect(allocation.updated_rows[0].status).toBe('PARTIAL');
    expect(allocation.unapplied_minor).toBe(0);
  });

  it('carries forward unpaid amounts when payment is lower than due', () => {
    const rows = [
      {
        id: 11,
        due_date: '2026-01-31',
        principal_due_minor: 6000,
        interest_due_minor: 500,
        principal_paid_minor: 0,
        interest_paid_minor: 0,
        status: 'DUE',
      },
      {
        id: 12,
        due_date: '2026-02-28',
        principal_due_minor: 6000,
        interest_due_minor: 400,
        principal_paid_minor: 0,
        interest_paid_minor: 0,
        status: 'DUE',
      },
    ];

    const allocation = allocateLoanPayment(rows, 6500);
    expect(allocation.updated_rows[0].status).toBe('PAID');
    expect(allocation.updated_rows[1].status).toBe('DUE');
    expect(allocation.principal_paid_minor).toBe(6000);
    expect(allocation.interest_paid_minor).toBe(500);
    expect(allocation.unapplied_minor).toBe(0);
  });

  it('returns unapplied amount when payment exceeds due balances', () => {
    const rows = [
      {
        id: 1,
        due_date: '2026-01-31',
        principal_due_minor: 1000,
        interest_due_minor: 100,
        principal_paid_minor: 0,
        interest_paid_minor: 0,
        status: 'DUE',
      },
    ];

    const allocation = allocateLoanPayment(rows, 5000);
    expect(allocation.principal_paid_minor).toBe(1000);
    expect(allocation.interest_paid_minor).toBe(100);
    expect(allocation.updated_rows[0].status).toBe('PAID');
    expect(allocation.unapplied_minor).toBe(3900);
  });
});
