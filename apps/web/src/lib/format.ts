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

export function lastFridayOfMonth(month: string) {
  if (!/^\d{4}-\d{2}$/.test(String(month || ''))) {
    return '';
  }

  const [yearRaw, monthRaw] = month.split('-');
  const year = Number(yearRaw);
  const monthNumber = Number(monthRaw);
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return '';
  }

  const cursor = new Date(Date.UTC(year, monthNumber, 0));
  while (cursor.getUTCDay() !== 5) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return cursor.toISOString().slice(0, 10);
}
