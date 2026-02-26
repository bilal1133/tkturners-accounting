const { foldBaseTotals, foldTotalsByCurrency } = require('../src/lib/finance/reports');

describe('reporting calculations', () => {
  it('computes monthly totals in single currency', () => {
    const rows = [
      { type: 'INCOME', amount_minor: 10000, currency: 'USD', base_amount_minor: 10000 },
      { type: 'EXPENSE', amount_minor: 2500, currency: 'USD', base_amount_minor: 2500 },
      { type: 'TRANSFER', amount_minor: 3000, currency: 'USD', base_amount_minor: 3000 },
    ];

    const totals = foldBaseTotals(rows, 'USD');
    expect(totals.revenue).toBe(10000);
    expect(totals.expense).toBe(2500);
    expect(totals.profit_loss).toBe(7500);
    expect(totals.transfer_volume).toBe(3000);
    expect(totals.excluded_unconverted_count).toBe(0);
  });

  it('uses base conversion amount when provided', () => {
    const rows = [
      { type: 'INCOME', amount_minor: 10000, currency: 'EUR', base_amount_minor: 10900 },
      { type: 'EXPENSE', amount_minor: 5000, currency: 'EUR', base_amount_minor: 5450 },
    ];

    const totals = foldBaseTotals(rows, 'USD');
    expect(totals.revenue).toBe(10900);
    expect(totals.expense).toBe(5450);
    expect(totals.profit_loss).toBe(5450);
  });

  it('counts excluded rows without conversion', () => {
    const rows = [
      { type: 'INCOME', amount_minor: 20000, currency: 'PKR', base_amount_minor: null },
      { type: 'EXPENSE', amount_minor: 4000, currency: 'USD', base_amount_minor: 4000 },
    ];

    const totals = foldBaseTotals(rows, 'USD');
    expect(totals.revenue).toBe(0);
    expect(totals.expense).toBe(4000);
    expect(totals.excluded_unconverted_count).toBe(1);
  });

  it('groups totals by currency', () => {
    const rows = [
      { type: 'INCOME', amount_minor: 10000, currency: 'USD' },
      { type: 'EXPENSE', amount_minor: 2000, currency: 'USD' },
      { type: 'INCOME', amount_minor: 9000, currency: 'PKR' },
      { type: 'TRANSFER', amount_minor: 1000, currency: 'PKR' },
    ];

    const grouped = foldTotalsByCurrency(rows);
    const usd = grouped.find((x) => x.currency === 'USD');
    const pkr = grouped.find((x) => x.currency === 'PKR');

    expect(usd.revenue).toBe(10000);
    expect(usd.expense).toBe(2000);
    expect(usd.profit_loss).toBe(8000);
    expect(pkr.transfer_volume).toBe(1000);
  });
});
