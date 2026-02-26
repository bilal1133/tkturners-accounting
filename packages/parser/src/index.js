const currencySymbols = {
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '₨': 'PKR',
};

const categoryKeywords = {
  Subscriptions: ['subscription', 'figma', 'notion', 'chatgpt', 'tool'],
  Hosting: ['hosting', 'aws', 'server', 'vercel', 'railway'],
  Payroll: ['payroll', 'salary'],
  Contractor: ['contractor', 'freelancer', 'upwork'],
  Marketing: ['marketing', 'ads', 'ad spend'],
  Tools: ['tool', 'software', 'license'],
};

function normalizeText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function parseAmountAndCurrency(input) {
  const text = normalizeText(input);

  const symbolMatch = text.match(/([$€£₨])\s?([0-9]+(?:\.[0-9]{1,2})?)/i);
  if (symbolMatch) {
    return {
      amount: Number(symbolMatch[2]),
      currency: currencySymbols[symbolMatch[1]] || 'USD',
    };
  }

  const codeMatch = text.match(/([0-9]+(?:\.[0-9]{1,2})?)\s*(USD|EUR|GBP|PKR|AED|INR)\b/i);
  if (codeMatch) {
    return {
      amount: Number(codeMatch[1]),
      currency: codeMatch[2].toUpperCase(),
    };
  }

  const trailingMatch = text.match(/\b(USD|EUR|GBP|PKR|AED|INR)\s*([0-9]+(?:\.[0-9]{1,2})?)\b/i);
  if (trailingMatch) {
    return {
      amount: Number(trailingMatch[2]),
      currency: trailingMatch[1].toUpperCase(),
    };
  }

  return null;
}

function parseDate(text, now = new Date()) {
  const normalized = normalizeText(text).toLowerCase();
  if (normalized.includes('yesterday')) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  const explicit = normalized.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (explicit) {
    return explicit[1];
  }

  return now.toISOString().slice(0, 10);
}

function inferCategory(text) {
  const lower = normalizeText(text).toLowerCase();
  for (const [category, words] of Object.entries(categoryKeywords)) {
    if (words.some((word) => lower.includes(word))) {
      return category;
    }
  }

  return 'Uncategorized';
}

function inferType(text) {
  const lower = normalizeText(text).toLowerCase();
  if (/\btransfer\b/.test(lower)) {
    return 'TRANSFER';
  }
  if (/\b(received|got|income)\b/.test(lower)) {
    return 'INCOME';
  }
  if (/\b(expense|paid|spent|fee)\b/.test(lower)) {
    return 'EXPENSE';
  }
  return null;
}

function parseTransferAccounts(text) {
  const normalized = normalizeText(text);
  const match = normalized.match(/from\s+(.+?)\s+to\s+(.+)$/i);
  if (!match) {
    return null;
  }

  return {
    from_account_name: match[1].trim(),
    to_account_name: match[2].trim(),
  };
}

function parseIncomeExpenseAccount(text, type) {
  const normalized = normalizeText(text);
  if (type === 'INCOME') {
    const match = normalized.match(/into\s+(.+)$/i);
    return match ? match[1].trim() : null;
  }

  const match = normalized.match(/from\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function parseCounterparty(text, type) {
  const normalized = normalizeText(text);
  if (type === 'INCOME') {
    const match = normalized.match(/from\s+(.+?)\s+into\s+/i);
    return match ? match[1].trim() : null;
  }

  if (type === 'EXPENSE') {
    const match = normalized.match(/for\s+(.+?)\s+from\s+/i);
    if (match) {
      return match[1].trim();
    }

    const feeMatch = normalized.match(/expense\s+[^ ]+\s+(.+?)\s+from\s+/i);
    return feeMatch ? feeMatch[1].trim() : null;
  }

  return null;
}

function scoreConfidence({ type, amount, account, transferAccounts }) {
  let score = 0;
  if (type) score += 0.34;
  if (amount) score += 0.33;
  if (account || transferAccounts) score += 0.33;
  return Number(score.toFixed(2));
}

function parseFinanceMessage(message, options = {}) {
  const now = options.now || new Date();
  const text = normalizeText(message);
  const type = inferType(text);
  const amount = parseAmountAndCurrency(text);
  const date = parseDate(text, now);
  const category = inferCategory(text);

  if (!type) {
    return {
      ok: false,
      confidence: 0,
      missing_fields: ['type'],
      normalized: text,
      error: 'Unable to determine transaction type.',
    };
  }

  const parsed = {
    ok: true,
    type,
    date,
    category,
    normalized: text,
    amount: amount?.amount ?? null,
    currency: amount?.currency ?? null,
    counterparty_name: parseCounterparty(text, type),
  };

  const missing = [];

  if (!amount || amount.amount <= 0) {
    missing.push('amount');
  }

  if (type === 'TRANSFER') {
    const transferAccounts = parseTransferAccounts(text);
    parsed.from_account_name = transferAccounts?.from_account_name ?? null;
    parsed.to_account_name = transferAccounts?.to_account_name ?? null;

    if (!transferAccounts?.from_account_name) missing.push('from_account');
    if (!transferAccounts?.to_account_name) missing.push('to_account');

    parsed.confidence = scoreConfidence({
      type,
      amount,
      transferAccounts,
    });
  } else {
    const account = parseIncomeExpenseAccount(text, type);
    parsed.account_name = account;
    if (!account) missing.push('account');

    parsed.confidence = scoreConfidence({
      type,
      amount,
      account,
    });
  }

  if (!parsed.currency) {
    parsed.currency = 'USD';
  }

  parsed.missing_fields = missing;
  parsed.ok = missing.length === 0;

  return parsed;
}

module.exports = {
  normalizeText,
  parseAmountAndCurrency,
  parseDate,
  inferCategory,
  inferType,
  parseFinanceMessage,
};
