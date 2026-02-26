const { lastFridayOfMonth } = require('../src/lib/finance/utils');

describe('date utils', () => {
  it('computes last friday for may 2026', () => {
    expect(lastFridayOfMonth('2026-05')).toBe('2026-05-29');
  });

  it('computes last friday for february 2026', () => {
    expect(lastFridayOfMonth('2026-02')).toBe('2026-02-27');
  });

  it('returns null for invalid month strings', () => {
    expect(lastFridayOfMonth('2026-13')).toBeNull();
    expect(lastFridayOfMonth('2026-5')).toBeNull();
    expect(lastFridayOfMonth('not-a-month')).toBeNull();
  });
});
