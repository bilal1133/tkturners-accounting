const { DepartmentInputSchema, EmployeeInputSchema } = require('@tkturners/shared-types');

describe('department and employee schemas', () => {
  it('accepts a valid department payload', () => {
    const payload = DepartmentInputSchema.parse({
      name: 'Engineering',
      code: 'ENG',
    });

    expect(payload.name).toBe('Engineering');
    expect(payload.code).toBe('ENG');
  });

  it('rejects empty department name', () => {
    const result = DepartmentInputSchema.safeParse({
      name: '   ',
    });

    expect(result.success).toBe(false);
  });

  it('accepts employee payload with nullable department', () => {
    const payload = EmployeeInputSchema.parse({
      full_name: 'John Doe',
      payroll_currency: 'USD',
      settlement_iban: 'PK36SCBL0000001123456702',
      default_payout_account_id: 10,
      department_id: null,
      base_salary_minor: 1000,
      default_allowances_minor: 0,
      default_non_loan_deductions_minor: 0,
    });

    expect(payload.department_id).toBeNull();
  });
});
