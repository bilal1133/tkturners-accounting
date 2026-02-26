export type CurrencyLike = {
  id?: number | null;
  code?: string | null;
  name?: string | null;
  symbol?: string | null;
  Code?: string | null;
  Name?: string | null;
  Symbol?: string | null;
};

export const currencyCode = (currency?: CurrencyLike | null) =>
  currency?.code || currency?.Code || "";

export const currencyName = (currency?: CurrencyLike | null) =>
  currency?.name || currency?.Name || "";

export const currencySymbol = (currency?: CurrencyLike | null) =>
  currency?.symbol || currency?.Symbol || "";

export const currencyLabel = (currency?: CurrencyLike | null) => {
  const code = currencyCode(currency);
  const name = currencyName(currency);
  const symbol = currencySymbol(currency);

  if (code && symbol) return `${code} (${symbol})`;
  if (code) return code;
  if (name && symbol) return `${name} (${symbol})`;
  if (name) return name;
  if (symbol) return symbol;
  return "";
};
