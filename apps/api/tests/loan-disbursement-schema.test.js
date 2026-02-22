const { LoanDisbursementInputSchema } = require('@tkturners/shared-types');

describe('loan disbursement payload schema', () => {
  it('accepts cross-currency disbursement payload with transfer fee', () => {
    const parsed = LoanDisbursementInputSchema.parse({
      disbursement_date: '2026-02-22',
      from_amount_minor: 95000,
      fx_rate: 278.45,
      transfer_fee_amount_minor: 750,
      transfer_fee_currency: 'USD',
      transfer_fee_description: 'Wire fee',
    });

    expect(parsed.fx_rate).toBe(278.45);
    expect(parsed.transfer_fee_currency).toBe('USD');
  });

  it('requires transfer_fee_currency when transfer_fee_amount_minor is provided', () => {
    const result = LoanDisbursementInputSchema.safeParse({
      transfer_fee_amount_minor: 300,
    });

    expect(result.success).toBe(false);
  });
});
