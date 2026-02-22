const dayjs = require('dayjs');

function nowIso() {
  return new Date().toISOString();
}

function toMinorUnits(amount, decimals = 2) {
  return Math.round(Number(amount) * Math.pow(10, decimals));
}

function fromMinorUnits(amountMinor, decimals = 2) {
  return Number(amountMinor) / Math.pow(10, decimals);
}

function monthRange(month) {
  const start = dayjs(`${month}-01`).startOf('month');
  const end = start.endOf('month');
  return {
    start: start.format('YYYY-MM-DD'),
    end: end.format('YYYY-MM-DD'),
  };
}

function lastFridayOfMonth(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''))) {
    return null;
  }

  let cursor = dayjs(`${month}-01`).endOf('month');
  if (!cursor.isValid()) {
    return null;
  }

  while (cursor.day() !== 5) {
    cursor = cursor.subtract(1, 'day');
  }

  return cursor.format('YYYY-MM-DD');
}

function addSubscriptionInterval(dateString, frequency, intervalCount) {
  const base = dayjs(dateString);
  const interval = Math.max(Number(intervalCount || 1), 1);

  if (frequency === 'ANNUAL') {
    return base.add(interval, 'year').format('YYYY-MM-DD');
  }

  return base.add(interval, 'month').format('YYYY-MM-DD');
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function stringifyError(error) {
  if (!error) {
    return null;
  }

  return {
    message: error.message,
    stack: error.stack,
  };
}

module.exports = {
  nowIso,
  toMinorUnits,
  fromMinorUnits,
  monthRange,
  lastFridayOfMonth,
  addSubscriptionInterval,
  isIsoDate,
  stringifyError,
};
