export function formatMinor(amountMinor: number, currency: string) {
  const amount = Number(amountMinor || 0) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}

export function todayMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function todayDate() {
  return new Date().toISOString().slice(0, 10);
}
