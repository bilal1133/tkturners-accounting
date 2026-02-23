const FAWAZ_CURRENCY_API_BASE =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies';

type FawazCurrencyLatestResponse = {
  base?: string;
  date?: string;
} & Record<string, unknown>;

function normalizeCurrencyCode(value: string) {
  return String(value || '').trim().toUpperCase();
}

export async function fetchLatestFxRates(baseCurrency: string, symbols: string[]) {
  const base = normalizeCurrencyCode(baseCurrency);
  const normalizedSymbols = Array.from(
    new Set(symbols.map((currency) => normalizeCurrencyCode(currency)).filter((currency) => currency && currency !== base))
  );

  if (!base) {
    throw new Error('Base currency is required for FX lookup.');
  }

  if (normalizedSymbols.length === 0) {
    return {
      base,
      date: null as string | null,
      rates: {} as Record<string, number>,
    };
  }

  const baseLower = base.toLowerCase();
  const response = await fetch(`${FAWAZ_CURRENCY_API_BASE}/${baseLower}.min.json`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`FX rate request failed (${response.status}).`);
  }

  const payload = (await response.json()) as FawazCurrencyLatestResponse;
  const rawRates = (payload?.[baseLower] as Record<string, number> | undefined) || {};
  const rates: Record<string, number> = {};

  for (const symbol of normalizedSymbols) {
    const value = Number(rawRates[symbol.toLowerCase()]);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Missing FX rate for ${symbol}.`);
    }
    rates[symbol] = value;
  }

  return {
    base,
    date: payload?.date || null,
    rates,
  };
}
