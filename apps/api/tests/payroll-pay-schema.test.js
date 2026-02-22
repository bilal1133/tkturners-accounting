const { PayrollPayActionSchema } = require('@tkturners/shared-types');

describe('payroll pay payload schema', () => {
  it('accepts cross-currency payment instructions with transfer and additional fees', () => {
    const parsed = PayrollPayActionSchema.parse({
      payment_date: '2026-02-22',
      default_from_account_id: 1,
      entry_payments: [
        {
          entry_id: 11,
          from_account_id: 1,
          to_account_id: 2,
          from_amount_minor: 28000,
          from_currency: 'USD',
          to_amount_minor: 7800000,
          to_currency: 'PKR',
          fx_rate: 278.57,
          transfer_fee_amount_minor: 500,
          transfer_fee_currency: 'USD',
          additional_fees: [
            {
              amount_minor: 200,
              currency: 'USD',
              description: 'Bank transaction fee',
            },
          ],
        },
      ],
    });

    expect(parsed.entry_payments[0].fx_rate).toBe(278.57);
    expect(parsed.entry_payments[0].transfer_fee_currency).toBe('USD');
    expect(parsed.entry_payments[0].additional_fees).toHaveLength(1);
  });

  it('rejects duplicate entry_id instructions', () => {
    const result = PayrollPayActionSchema.safeParse({
      entry_payments: [
        { entry_id: 9, to_account_id: 11 },
        { entry_id: 9, to_account_id: 12 },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('requires transfer_fee_currency when transfer_fee_amount_minor is provided', () => {
    const result = PayrollPayActionSchema.safeParse({
      entry_payments: [
        {
          entry_id: 6,
          from_account_id: 1,
          to_account_id: 2,
          transfer_fee_amount_minor: 250,
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
