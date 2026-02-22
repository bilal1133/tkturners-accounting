const SYSTEM_CATEGORIES = [
  { name: 'Uncategorized', type: 'BOTH' },
  { name: 'Subscriptions', type: 'EXPENSE' },
  { name: 'Payroll', type: 'EXPENSE' },
  { name: 'Loan Interest', type: 'INCOME' },
  { name: 'Contractor', type: 'EXPENSE' },
  { name: 'Marketing', type: 'EXPENSE' },
  { name: 'Tools', type: 'EXPENSE' },
  { name: 'Hosting', type: 'EXPENSE' },
  { name: 'Transfer Fees', type: 'EXPENSE' },
  { name: 'Sales', type: 'INCOME' },
  { name: 'Misc', type: 'BOTH' },
];

const CURRENCIES = [
  ['USD', 'US Dollar', 2],
  ['PKR', 'Pakistani Rupee', 2],
  ['EUR', 'Euro', 2],
  ['GBP', 'British Pound', 2],
  ['AED', 'UAE Dirham', 2],
  ['INR', 'Indian Rupee', 2],
];

module.exports = {
  SYSTEM_CATEGORIES,
  CURRENCIES,
};
