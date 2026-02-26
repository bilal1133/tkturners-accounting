const { parseFinanceMessage } = require('../src');

describe('parseFinanceMessage', () => {
  const now = new Date('2026-02-22T12:00:00.000Z');

  it('parses income with symbol and account', () => {
    const parsed = parseFinanceMessage('received $250 from Client X into Bilal Wise', { now });
    expect(parsed.type).toBe('INCOME');
    expect(parsed.amount).toBe(250);
    expect(parsed.currency).toBe('USD');
    expect(parsed.account_name).toBe('Bilal Wise');
    expect(parsed.ok).toBe(true);
  });

  it('parses expense with subscription category', () => {
    const parsed = parseFinanceMessage('paid $49 for Figma subscription from Bilal Wise', { now });
    expect(parsed.type).toBe('EXPENSE');
    expect(parsed.category).toBe('Subscriptions');
    expect(parsed.counterparty_name).toBe('Figma subscription');
    expect(parsed.ok).toBe(true);
  });

  it('parses transfer message', () => {
    const parsed = parseFinanceMessage('transfer $500 from Bilal Wise to CoFounder Bank', { now });
    expect(parsed.type).toBe('TRANSFER');
    expect(parsed.from_account_name).toBe('Bilal Wise');
    expect(parsed.to_account_name).toBe('CoFounder Bank');
    expect(parsed.ok).toBe(true);
  });

  it('defaults date to today', () => {
    const parsed = parseFinanceMessage('received $10 from Acme into Bilal Wise', { now });
    expect(parsed.date).toBe('2026-02-22');
  });

  it('flags missing account', () => {
    const parsed = parseFinanceMessage('received $10 from Acme', { now });
    expect(parsed.missing_fields).toContain('account');
    expect(parsed.ok).toBe(false);
  });

  it('handles PKR no symbol', () => {
    const parsed = parseFinanceMessage('paid 18000 PKR for internet from CoFounder Bank', { now });
    expect(parsed.currency).toBe('PKR');
    expect(parsed.amount).toBe(18000);
  });

  it('handles got phrasing', () => {
    const parsed = parseFinanceMessage('got 1200 USD from Acme into CoFounder Bank', { now });
    expect(parsed.type).toBe('INCOME');
    expect(parsed.amount).toBe(1200);
    expect(parsed.currency).toBe('USD');
    expect(parsed.ok).toBe(true);
  });

  it('handles expense fee phrasing', () => {
    const parsed = parseFinanceMessage('expense $120 Upwork fee from Bilal Wise', { now });
    expect(parsed.type).toBe('EXPENSE');
    expect(parsed.account_name).toBe('Bilal Wise');
    expect(parsed.ok).toBe(true);
  });

  it('rejects message without type', () => {
    const parsed = parseFinanceMessage('$120 from Bilal Wise', { now });
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain('Unable to determine');
  });

  it('rejects malformed amount', () => {
    const parsed = parseFinanceMessage('paid zero for figma from Bilal Wise', { now });
    expect(parsed.ok).toBe(false);
    expect(parsed.missing_fields).toContain('amount');
  });
});
