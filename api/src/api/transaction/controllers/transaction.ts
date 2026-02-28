/**
 * transaction controller
 */

import { factories } from "@strapi/strapi";

const round2 = (value: number) => Math.round(value * 100) / 100;

const toNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toNullableNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const relationId = (value: any): number | null => {
  if (!value) return null;
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
  }
  if (typeof value === "object" && Number.isInteger(value.id)) return value.id;
  return null;
};

const relationDocumentId = (value: any): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && typeof value.documentId === "string") {
    return value.documentId;
  }
  return null;
};

const parseBoolean = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
};

const parseList = (value: unknown): string[] => {
  if (value === null || value === undefined) return [];

  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => parseList(entry))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [String(value)].filter(Boolean);
};

const parseNumberParam = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);

const parseDateInput = (value: unknown, endOfDay = false): Date | null => {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value !== "string") {
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(
      endOfDay ? `${trimmed}T23:59:59.999Z` : `${trimmed}T00:00:00.000Z`,
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const toMonthKey = (value: Date) => value.toISOString().slice(0, 7);

const PAYMENT_TYPES = [
  "Cash",
  "Debit Card",
  "Credit Card",
  "Transfer",
  "Voucher",
  "Mobile Payment",
];

const TRANSACTION_KINDS = ["income", "expense", "transfer"] as const;

const LOAN_STATUSES = ["Active", "Paid Off", "Defaulted"];
const PAYROLL_STATUSES = ["draft", "processed"];

type TransactionKind = (typeof TRANSACTION_KINDS)[number];

type NormalizedTransaction = {
  id: number;
  documentId: string | null;
  date: Date;
  dateKey: string;
  monthKey: string;
  note: string;
  paymentType: string;
  kind: TransactionKind;
  incomeAmount: number;
  expenseAmount: number;
  transferOutAmount: number;
  transferInAmount: number;
  primaryAmount: number;
  accountIds: number[];
  accountDocumentIds: string[];
  currencyIds: number[];
  currencyDocumentIds: string[];
  currencyCodes: string[];
  contactId: number | null;
  contactDocumentId: string | null;
  contactName: string;
  categoryId: number | null;
  categoryDocumentId: string | null;
  categoryName: string;
  projectId: number | null;
  projectDocumentId: string | null;
  projectName: string;
  department: string | null;
};

type AggregatedAmount = {
  total: number;
  count: number;
};

type AccountAggregate = {
  account_id: number;
  account_document_id: string;
  account_name: string;
  currency_id: number | null;
  currency_document_id: string | null;
  currency_code: string;
  currency_symbol: string;
  excluded_from_statistics: boolean;
  income: number;
  expense: number;
  transfer_in: number;
  transfer_out: number;
  net: number;
  transaction_count: number;
};

type CurrencyAggregate = {
  currency_id: number | null;
  currency_document_id: string | null;
  code: string;
  symbol: string;
  name: string;
  income: number;
  expense: number;
  transfer_in: number;
  transfer_out: number;
  net: number;
  transaction_count: number;
};

type AccountBalancePoint = {
  account_id: number;
  account_document_id: string;
  account_name: string;
  currency_id: number | null;
  currency_document_id: string | null;
  currency_code: string;
  currency_symbol: string;
  excluded_from_statistics: boolean;
  balance: number;
};

const initAmountAggregate = (): AggregatedAmount => ({
  total: 0,
  count: 0,
});

const addAmount = (bucket: AggregatedAmount, amount: number) => {
  bucket.total = round2(bucket.total + amount);
  bucket.count += 1;
};

const getEmployeeComponent = (contact: any) =>
  asArray<any>(contact?.contact_type).find(
    (entry) => entry?.__component === "contact-type.employee",
  ) || null;

const loadAll = async (strapi: any, uid: string, params: Record<string, any>) => {
  const pageSize = 200;
  let start = 0;
  let keepLoading = true;
  const items: any[] = [];

  while (keepLoading) {
    const chunk = await strapi.entityService.findMany(uid, {
      ...params,
      start,
      limit: pageSize,
    } as any);

    const rows = asArray<any>(chunk);
    items.push(...rows);

    if (rows.length < pageSize) {
      keepLoading = false;
    } else {
      start += pageSize;
    }

    if (start > 100000) {
      keepLoading = false;
    }
  }

  return items;
};

const extractNormalizedTransaction = (
  tx: any,
  accountById: Map<number, any>,
): NormalizedTransaction | null => {
  const component = asArray<any>(tx?.type)[0];
  if (!component || typeof component !== "object") return null;

  const rawDate = new Date(String(tx?.date_time || ""));
  if (Number.isNaN(rawDate.getTime())) return null;

  let kind: TransactionKind;
  if (component.__component === "type.income") {
    kind = "income";
  } else if (component.__component === "type.expense") {
    kind = "expense";
  } else {
    kind = "transfer";
  }

  const accountIds: number[] = [];
  const accountDocumentIds: string[] = [];
  const currencyIds: number[] = [];
  const currencyDocumentIds: string[] = [];
  const currencyCodes: string[] = [];

  const pushAccount = (account: any) => {
    const accountId = relationId(account);
    if (accountId !== null && !accountIds.includes(accountId)) {
      accountIds.push(accountId);
    }

    const accountDocumentId = relationDocumentId(account);
    if (accountDocumentId && !accountDocumentIds.includes(accountDocumentId)) {
      accountDocumentIds.push(accountDocumentId);
    }

    const linkedAccount = accountId !== null ? accountById.get(accountId) : null;
    const currency = account?.currency || linkedAccount?.currency || null;
    const currencyId = relationId(currency);
    const currencyDocumentId = relationDocumentId(currency);

    if (currencyId !== null && !currencyIds.includes(currencyId)) {
      currencyIds.push(currencyId);
    }

    if (currencyDocumentId && !currencyDocumentIds.includes(currencyDocumentId)) {
      currencyDocumentIds.push(currencyDocumentId);
    }

    const code = String(currency?.code || currency?.Code || "").trim();
    if (code && !currencyCodes.includes(code)) {
      currencyCodes.push(code);
    }
  };

  const pushCurrency = (currency: any) => {
    if (!currency) return;
    const currencyId = relationId(currency);
    const currencyDocumentId = relationDocumentId(currency);
    const code = String(currency?.code || currency?.Code || "").trim();

    if (currencyId !== null && !currencyIds.includes(currencyId)) {
      currencyIds.push(currencyId);
    }

    if (currencyDocumentId && !currencyDocumentIds.includes(currencyDocumentId)) {
      currencyDocumentIds.push(currencyDocumentId);
    }

    if (code && !currencyCodes.includes(code)) {
      currencyCodes.push(code);
    }
  };

  let incomeAmount = 0;
  let expenseAmount = 0;
  let transferOutAmount = 0;
  let transferInAmount = 0;
  let primaryAmount = 0;

  if (kind === "income") {
    incomeAmount = round2(toNumber(component.amount));
    primaryAmount = incomeAmount;
    pushAccount(component.account);
    pushCurrency(component.currency);
  }

  if (kind === "expense") {
    expenseAmount = round2(toNumber(component.amount));
    primaryAmount = expenseAmount;
    pushAccount(component.account);
    pushCurrency(component.currency);
  }

  if (kind === "transfer") {
    transferOutAmount = round2(toNumber(component.from_amount));
    transferInAmount = round2(toNumber(component.to_amount));
    primaryAmount = transferOutAmount;
    pushAccount(component.from_account);
    pushAccount(component.to_account);
  }

  const contact = tx?.contact || null;
  const category = tx?.category || null;
  const project = tx?.project || null;
  const noteText = String(tx?.note || "").toLowerCase();
  const inferredLoanCategory =
    Boolean(tx?.loan_disbursement) ||
    Boolean(tx?.loan_repayment) ||
    noteText.includes("loan");

  const employeeComponent = getEmployeeComponent(contact);

  return {
    id: Number(tx?.id),
    documentId: relationDocumentId(tx),
    date: rawDate,
    dateKey: toIsoDate(rawDate),
    monthKey: toMonthKey(rawDate),
    note: String(tx?.note || ""),
    paymentType: String(tx?.payment_type || "Unknown"),
    kind,
    incomeAmount,
    expenseAmount,
    transferOutAmount,
    transferInAmount,
    primaryAmount,
    accountIds,
    accountDocumentIds,
    currencyIds,
    currencyDocumentIds,
    currencyCodes,
    contactId: relationId(contact),
    contactDocumentId: relationDocumentId(contact),
    contactName: String(contact?.name || "Unknown"),
    categoryId: relationId(category),
    categoryDocumentId: relationDocumentId(category),
    categoryName: String(category?.name || (inferredLoanCategory ? "Loan" : "Uncategorized")),
    projectId: relationId(project),
    projectDocumentId: relationDocumentId(project),
    projectName: String(project?.name || "No Project"),
    department:
      typeof employeeComponent?.department === "string"
        ? employeeComponent.department
        : null,
  };
};

export default factories.createCoreController(
  "api::transaction.transaction",
  ({ strapi }) => ({
    async find(ctx) {
      const query = (ctx.query ?? {}) as Record<string, unknown>;
      const hasLedgerSpecificParams =
        query.sortField !== undefined ||
        query.paymentFilter !== undefined ||
        query.categoryFilter !== undefined ||
        query.accountFilter !== undefined;

      if (hasLedgerSpecificParams) {
        return await this.ledgerList(ctx, undefined as any);
      }

      return await super.find(ctx);
    },

    async findOne(ctx) {
      return await super.findOne(ctx);
    },

    async create(ctx) {
      return await super.create(ctx);
    },

    async update(ctx) {
      return await super.update(ctx);
    },

    async delete(ctx) {
      return await super.delete(ctx);
    },

    async ledgerList(ctx, _next) {
      const q = (ctx.query ?? {}) as Record<string, unknown>;

      const page = Math.max(1, Number.parseInt(String(q.page || 1), 10) || 1);
      const pageSize = Math.max(
        1,
        Math.min(200, Number.parseInt(String(q.pageSize || 10), 10) || 10),
      );

      const search = normalizeText(q.search);
      const paymentFilter = String(q.paymentFilter || "all").trim();
      const categoryFilter = String(q.categoryFilter || "all").trim();
      const accountFilter = String(q.accountFilter || "all").trim();
      const accountIdFilter =
        parseNumberParam(q.accountId) !== null
          ? Number(parseNumberParam(q.accountId))
          : null;

      const sortFieldRaw = String(q.sortField || "date_time").trim();
      const sortField: "date_time" | "payment_type" | "note" =
        sortFieldRaw === "payment_type" || sortFieldRaw === "note"
          ? sortFieldRaw
          : "date_time";

      const sortDirectionRaw = String(q.sortDirection || "desc").trim().toLowerCase();
      const sortDirection: "asc" | "desc" =
        sortDirectionRaw === "asc" ? "asc" : "desc";

      const transactions = await loadAll(strapi, "api::transaction.transaction", {
        populate: [
          "contact",
          "project",
          "category",
          "type",
          "type.account",
          "type.currency",
          "type.from_account",
          "type.to_account",
        ],
      });

      const textMatches = (tx: any) => {
        if (!search) return true;

        const component = asArray<any>(tx?.type)[0] || null;
        const haystack = normalizeText(
          [
            tx?.note,
            tx?.payment_type,
            tx?.contact?.name,
            tx?.project?.name,
            tx?.category?.name,
            component?.account?.name,
            component?.from_account?.name,
            component?.to_account?.name,
          ].join(" "),
        );

        return haystack.includes(search);
      };

      const accountMatches = (tx: any) => {
        if (
          (!accountFilter || accountFilter === "all") &&
          accountIdFilter === null
        ) {
          return true;
        }

        const component = asArray<any>(tx?.type)[0] || null;
        if (!component) return false;

        const matchByDocument = (candidate: any) =>
          accountFilter &&
          accountFilter !== "all" &&
          relationDocumentId(candidate) === accountFilter;
        const matchById = (candidate: any) =>
          accountIdFilter !== null && relationId(candidate) === accountIdFilter;

        if (component.__component === "type.income" || component.__component === "type.expense") {
          return (
            matchByDocument(component.account) || matchById(component.account)
          );
        }

        return (
          matchByDocument(component.from_account) ||
          matchById(component.from_account) ||
          matchByDocument(component.to_account) ||
          matchById(component.to_account)
        );
      };

      const filtered = asArray<any>(transactions).filter((tx) => {
        if (paymentFilter !== "all" && tx?.payment_type !== paymentFilter) {
          return false;
        }

        if (
          categoryFilter !== "all" &&
          relationDocumentId(tx?.category) !== categoryFilter
        ) {
          return false;
        }

        if (!accountMatches(tx)) {
          return false;
        }

        return textMatches(tx);
      });

      const collator = new Intl.Collator(undefined, {
        sensitivity: "base",
        numeric: true,
      });

      const sorted = [...filtered].sort((left, right) => {
        let compare = 0;

        if (sortField === "date_time") {
          compare =
            new Date(String(left?.date_time || 0)).getTime() -
            new Date(String(right?.date_time || 0)).getTime();
        } else if (sortField === "payment_type") {
          compare = collator.compare(
            String(left?.payment_type || ""),
            String(right?.payment_type || ""),
          );
        } else {
          compare = collator.compare(
            String(left?.note || ""),
            String(right?.note || ""),
          );
        }

        if (compare === 0) {
          compare = Number(left?.id || 0) - Number(right?.id || 0);
        }

        return sortDirection === "asc" ? compare : -compare;
      });

      const total = sorted.length;
      const pageCount = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, pageCount);
      const start = (safePage - 1) * pageSize;
      const data = sorted.slice(start, start + pageSize);

      return {
        data,
        meta: {
          pagination: {
            page: safePage,
            pageSize,
            pageCount,
            total,
          },
        },
      };
    },

    async dashboardReport(ctx) {
      const q = (ctx.query ?? {}) as Record<string, unknown>;

      const dateFrom = parseDateInput(q.date_from || q.dateFrom);
      const dateTo = parseDateInput(q.date_to || q.dateTo, true);

      if ((q.date_from || q.dateFrom) && !dateFrom) {
        return ctx.badRequest("Invalid date_from");
      }

      if ((q.date_to || q.dateTo) && !dateTo) {
        return ctx.badRequest("Invalid date_to");
      }

      if (dateFrom && dateTo && dateFrom.getTime() > dateTo.getTime()) {
        return ctx.badRequest("date_from cannot be later than date_to");
      }

      const minAmount = parseNumberParam(q.min_amount || q.minAmount);
      const maxAmount = parseNumberParam(q.max_amount || q.maxAmount);

      if (minAmount !== null && maxAmount !== null && minAmount > maxAmount) {
        return ctx.badRequest("min_amount cannot be greater than max_amount");
      }

      const accountIdSet = new Set(
        parseList(q.account_ids || q.accountIds)
          .map((value) => Number.parseInt(value, 10))
          .filter((value) => Number.isInteger(value)),
      );
      const accountDocumentIdSet = new Set(parseList(q.account_document_ids || q.accountDocumentIds));

      const currencyIdSet = new Set(
        parseList(q.currency_ids || q.currencyIds)
          .map((value) => Number.parseInt(value, 10))
          .filter((value) => Number.isInteger(value)),
      );
      const currencyDocumentIdSet = new Set(
        parseList(q.currency_document_ids || q.currencyDocumentIds),
      );

      const contactIdSet = new Set(
        parseList(q.contact_ids || q.contactIds)
          .map((value) => Number.parseInt(value, 10))
          .filter((value) => Number.isInteger(value)),
      );
      const contactDocumentIdSet = new Set(parseList(q.contact_document_ids || q.contactDocumentIds));

      const categoryIdSet = new Set(
        parseList(q.category_ids || q.categoryIds)
          .map((value) => Number.parseInt(value, 10))
          .filter((value) => Number.isInteger(value)),
      );
      const categoryDocumentIdSet = new Set(
        parseList(q.category_document_ids || q.categoryDocumentIds),
      );

      const projectIdSet = new Set(
        parseList(q.project_ids || q.projectIds)
          .map((value) => Number.parseInt(value, 10))
          .filter((value) => Number.isInteger(value)),
      );
      const projectDocumentIdSet = new Set(parseList(q.project_document_ids || q.projectDocumentIds));

      const paymentTypeSet = new Set(parseList(q.payment_types || q.paymentTypes));
      const transactionKindSet = new Set(
        parseList(q.transaction_kinds || q.transactionKinds).filter((value) =>
          TRANSACTION_KINDS.includes(value as TransactionKind),
        ),
      );

      const departmentSet = new Set(parseList(q.departments));
      const loanStatusSet = new Set(
        parseList(q.loan_statuses || q.loanStatuses).filter((status) =>
          LOAN_STATUSES.includes(status),
        ),
      );
      const payrollStatusSet = new Set(
        parseList(q.payroll_statuses || q.payrollStatuses).filter((status) =>
          PAYROLL_STATUSES.includes(status),
        ),
      );

      const includeExcludedAccounts = parseBoolean(
        q.include_excluded_accounts ?? q.includeExcludedAccounts,
        false,
      );

      const search = normalizeText(q.search);
      const topLimit = Math.max(3, Math.min(50, Number.parseInt(String(q.top || 10), 10) || 10));

      const [
        accounts,
        currencies,
        categories,
        contacts,
        projects,
        loans,
        payrolls,
        transactions,
      ] = await Promise.all([
        loadAll(strapi, "api::account.account", {
          populate: ["currency"],
          sort: ["name:asc"],
        }),
        loadAll(strapi, "api::currency.currency", {
          sort: ["name:asc"],
        }),
        loadAll(strapi, "api::category.category", {
          sort: ["name:asc"],
        }),
        loadAll(strapi, "api::contact.contact", {
          populate: ["contact_type", "contact_type.currency"],
          sort: ["name:asc"],
        }),
        loadAll(strapi, "api::project.project", {
          populate: ["contact"],
          sort: ["name:asc"],
        }),
        loadAll(strapi, "api::loan.loan", {
          sort: ["updatedAt:desc"],
        }),
        loadAll(strapi, "api::payroll.payroll", {
          populate: [
            "employee_details",
            "employee_details.contact",
            "employee_details.contact.contact_type",
            "employee_details.contact.contact_type.currency",
            "employee_details.payee_account",
            "employee_details.payee_account.currency",
            "employee_details.loan_ref",
          ],
          sort: ["pay_date:desc", "createdAt:desc"],
        }),
        loadAll(strapi, "api::transaction.transaction", {
          populate: [
            "contact",
            "contact.contact_type",
            "project",
            "category",
            "type",
            "type.account",
            "type.currency",
            "type.from_account",
            "type.to_account",
            "type.from_account.currency",
            "type.to_account.currency",
          ],
          sort: ["date_time:asc"],
        }),
      ]);

      const accountById = new Map<number, any>();
      asArray<any>(accounts).forEach((account) => {
        const accountId = relationId(account);
        if (accountId !== null) {
          accountById.set(accountId, account);
        }
      });

      const contactById = new Map<number, any>();
      asArray<any>(contacts).forEach((contact) => {
        const contactId = relationId(contact);
        if (contactId !== null) {
          contactById.set(contactId, contact);
        }
      });

      const categoryById = new Map<number, any>();
      asArray<any>(categories).forEach((category) => {
        const categoryId = relationId(category);
        if (categoryId !== null) {
          categoryById.set(categoryId, category);
        }
      });

      const transactionCategoryLinkRows = await strapi.db.connection(
        "transactions_category_lnk",
      )
        .select("transaction_id", "category_id")
        .catch(() => []);
      const transactionCategoryByTransactionId = new Map<number, number>();
      asArray<any>(transactionCategoryLinkRows).forEach((row) => {
        const transactionId = Number(row?.transaction_id);
        const categoryId = Number(row?.category_id);
        if (
          Number.isInteger(transactionId) &&
          Number.isInteger(categoryId) &&
          !transactionCategoryByTransactionId.has(transactionId)
        ) {
          transactionCategoryByTransactionId.set(transactionId, categoryId);
        }
      });

      const transactionContactLinkRows = await strapi.db.connection
        .raw('SELECT transaction_id, contact_id FROM "transactions_contact_lnk"')
        .then((result: any) => result?.rows || [])
        .catch(() => []);
      const transactionContactByTransactionId = new Map<number, number>();
      asArray<any>(transactionContactLinkRows).forEach((row) => {
        const transactionId = Number(row?.transaction_id);
        const contactId = Number(row?.contact_id);
        if (
          Number.isInteger(transactionId) &&
          Number.isInteger(contactId) &&
          !transactionContactByTransactionId.has(transactionId)
        ) {
          transactionContactByTransactionId.set(transactionId, contactId);
        }
      });

      const dbContactRows = await strapi.db.connection
        .raw('SELECT id, document_id, name FROM "contacts"')
        .then((result: any) => result?.rows || [])
        .catch(() => []);
      const dbContactById = new Map<number, { id: number; document_id: string | null; name: string | null }>();
      asArray<any>(dbContactRows).forEach((row) => {
        const id = Number(row?.id);
        if (!Number.isInteger(id)) return;
        dbContactById.set(id, {
          id,
          document_id:
            typeof row?.document_id === "string" ? row.document_id : null,
          name: typeof row?.name === "string" ? row.name : null,
        });
      });

      const normalizedTransactions = asArray<any>(transactions)
        .map((tx) => extractNormalizedTransaction(tx, accountById))
        .filter((tx): tx is NormalizedTransaction => tx !== null)
        .map((tx) => {
          const fallbackContactId =
            tx.contactId ?? transactionContactByTransactionId.get(tx.id) ?? null;
          if (tx.contactId === null && fallbackContactId !== null) {
            const resolvedContact = contactById.get(fallbackContactId);
            if (resolvedContact) {
              tx = {
                ...tx,
                contactId: fallbackContactId,
                contactDocumentId:
                  tx.contactDocumentId || relationDocumentId(resolvedContact),
                contactName: String(resolvedContact?.name || tx.contactName || "Unknown"),
              };
            } else {
              const dbContact = dbContactById.get(fallbackContactId);
              if (dbContact?.name) {
                tx = {
                  ...tx,
                  contactId: fallbackContactId,
                  contactDocumentId: tx.contactDocumentId || dbContact.document_id,
                  contactName: dbContact.name,
                };
              }
            }
          }

          const fallbackCategoryId =
            tx.categoryId ?? transactionCategoryByTransactionId.get(tx.id) ?? null;
          if (tx.categoryName !== "Uncategorized" && tx.categoryId !== null) return tx;
          if (fallbackCategoryId === null) return tx;

          const resolvedCategory = categoryById.get(fallbackCategoryId);
          if (!resolvedCategory) return tx;

          const resolvedName = String(resolvedCategory?.name || "").trim();
          if (!resolvedName) return tx;

          return {
            ...tx,
            categoryId: fallbackCategoryId,
            categoryName: resolvedName,
            categoryDocumentId:
              tx.categoryDocumentId || relationDocumentId(resolvedCategory),
          };
        });

      const accountBalanceMap = new Map<number, AccountBalancePoint>();
      const accountBalanceByDocumentId = new Map<string, AccountBalancePoint>();
      asArray<any>(accounts).forEach((account) => {
        const accountId = relationId(account);
        if (accountId === null) return;

        const excludedFromStatistics = Boolean(account?.exclude_from_statistics);

        const currency = account?.currency || null;
        const point: AccountBalancePoint = {
          account_id: accountId,
          account_document_id: relationDocumentId(account) || "",
          account_name: String(account?.name || "Unknown Account"),
          currency_id: relationId(currency),
          currency_document_id: relationDocumentId(currency),
          currency_code: String(currency?.code || currency?.Code || ""),
          currency_symbol: String(currency?.symbol || currency?.Symbol || ""),
          excluded_from_statistics: excludedFromStatistics,
          balance: round2(toNumber(account?.initial_amount)),
        };
        accountBalanceMap.set(accountId, point);
        if (point.account_document_id) {
          accountBalanceByDocumentId.set(point.account_document_id, point);
        }
      });

      const resolveBalancePoint = (accountRelation: any): AccountBalancePoint | null => {
        const accountId = relationId(accountRelation);
        if (accountId !== null) {
          const byId = accountBalanceMap.get(accountId);
          if (byId) return byId;
        }

        const documentId = relationDocumentId(accountRelation);
        if (documentId) {
          const byDocumentId = accountBalanceByDocumentId.get(documentId);
          if (byDocumentId) return byDocumentId;
        }

        return null;
      };

      asArray<any>(transactions).forEach((tx) => {
        const component = asArray<any>(tx?.type)[0];
        if (!component || typeof component !== "object") return;

        if (component.__component === "type.income") {
          const balance = resolveBalancePoint(component?.account);
          if (!balance) return;
          balance.balance = round2(balance.balance + toNumber(component?.amount));
          return;
        }

        if (component.__component === "type.expense") {
          const balance = resolveBalancePoint(component?.account);
          if (!balance) return;
          balance.balance = round2(balance.balance - toNumber(component?.amount));
          return;
        }

        const fromBalance = resolveBalancePoint(component?.from_account);
        if (fromBalance) {
          fromBalance.balance = round2(
            fromBalance.balance - toNumber(component?.from_amount),
          );
        }

        const toBalance = resolveBalancePoint(component?.to_account);
        if (toBalance) {
          toBalance.balance = round2(toBalance.balance + toNumber(component?.to_amount));
        }
      });

      const filteredTransactions = normalizedTransactions.filter((tx) => {
        if (dateFrom && tx.date.getTime() < dateFrom.getTime()) {
          return false;
        }

        if (dateTo && tx.date.getTime() > dateTo.getTime()) {
          return false;
        }

        if (transactionKindSet.size > 0 && !transactionKindSet.has(tx.kind)) {
          return false;
        }

        if (paymentTypeSet.size > 0 && !paymentTypeSet.has(tx.paymentType)) {
          return false;
        }

        if (accountIdSet.size > 0) {
          const hasAccountMatch = tx.accountIds.some((id) => accountIdSet.has(id));
          if (!hasAccountMatch) {
            return false;
          }
        }

        if (accountDocumentIdSet.size > 0) {
          const hasAccountDocumentMatch = tx.accountDocumentIds.some((documentId) =>
            accountDocumentIdSet.has(documentId),
          );
          if (!hasAccountDocumentMatch) {
            return false;
          }
        }

        if (currencyIdSet.size > 0) {
          const hasCurrencyMatch = tx.currencyIds.some((id) => currencyIdSet.has(id));
          if (!hasCurrencyMatch) {
            return false;
          }
        }

        if (currencyDocumentIdSet.size > 0) {
          const hasCurrencyDocumentMatch = tx.currencyDocumentIds.some((documentId) =>
            currencyDocumentIdSet.has(documentId),
          );
          if (!hasCurrencyDocumentMatch) {
            return false;
          }
        }

        if (contactIdSet.size > 0) {
          if (tx.contactId === null || !contactIdSet.has(tx.contactId)) {
            return false;
          }
        }

        if (contactDocumentIdSet.size > 0) {
          if (!tx.contactDocumentId || !contactDocumentIdSet.has(tx.contactDocumentId)) {
            return false;
          }
        }

        if (categoryIdSet.size > 0) {
          if (tx.categoryId === null || !categoryIdSet.has(tx.categoryId)) {
            return false;
          }
        }

        if (categoryDocumentIdSet.size > 0) {
          if (!tx.categoryDocumentId || !categoryDocumentIdSet.has(tx.categoryDocumentId)) {
            return false;
          }
        }

        if (projectIdSet.size > 0) {
          if (tx.projectId === null || !projectIdSet.has(tx.projectId)) {
            return false;
          }
        }

        if (projectDocumentIdSet.size > 0) {
          if (!tx.projectDocumentId || !projectDocumentIdSet.has(tx.projectDocumentId)) {
            return false;
          }
        }

        if (departmentSet.size > 0) {
          if (!tx.department || !departmentSet.has(tx.department)) {
            return false;
          }
        }

        if (minAmount !== null && tx.primaryAmount < minAmount) {
          return false;
        }

        if (maxAmount !== null && tx.primaryAmount > maxAmount) {
          return false;
        }

        if (!includeExcludedAccounts && tx.accountIds.length > 0) {
          const accountFlags = tx.accountIds
            .map((accountId) => accountById.get(accountId))
            .filter(Boolean)
            .map((account) => Boolean(account.exclude_from_statistics));

          if (accountFlags.length > 0 && accountFlags.every(Boolean)) {
            return false;
          }

          if (
            tx.kind !== "transfer" &&
            accountFlags.length > 0 &&
            accountFlags[0]
          ) {
            return false;
          }
        }

        if (search) {
          const haystack = normalizeText(
            [
              tx.note,
              tx.paymentType,
              tx.contactName,
              tx.categoryName,
              tx.projectName,
              tx.kind,
              tx.accountDocumentIds.join(" "),
              tx.currencyCodes.join(" "),
              tx.department,
            ].join(" "),
          );

          if (!haystack.includes(search)) {
            return false;
          }
        }

        return true;
      });

      const totals = {
        transaction_count: 0,
        income_total: 0,
        expense_total: 0,
        transfer_in_total: 0,
        transfer_out_total: 0,
        net_total: 0,
        average_transaction_amount: 0,
        payroll_gross_total: 0,
        payroll_net_total: 0,
        payroll_loan_deduction_total: 0,
        payroll_employee_count: 0,
        loan_outstanding_total: 0,
        active_loans: 0,
        paid_off_loans: 0,
        defaulted_loans: 0,
      };

      const dailyMap = new Map<
        string,
        {
          date: string;
          income: number;
          expense: number;
          transfer_in: number;
          transfer_out: number;
          net: number;
          transaction_count: number;
        }
      >();
      const monthlyMap = new Map<
        string,
        {
          month: string;
          income: number;
          expense: number;
          transfer_in: number;
          transfer_out: number;
          net: number;
          transaction_count: number;
        }
      >();
      const expenseCategoryMap = new Map<string, { category: string; total: number; count: number }>();
      const incomeCategoryMap = new Map<string, { category: string; total: number; count: number }>();
      const accountAggregateMap = new Map<number, AccountAggregate>();
      const paymentMap = new Map<string, AggregatedAmount>();
      const contactMap = new Map<
        string,
        {
          contact_id: number | null;
          contact_document_id: string | null;
          contact_name: string;
          income: number;
          expense: number;
          transfer: number;
          net: number;
          transaction_count: number;
        }
      >();
      const projectMap = new Map<
        string,
        {
          project_id: number | null;
          project_document_id: string | null;
          project_name: string;
          income: number;
          expense: number;
          transfer: number;
          net: number;
          transaction_count: number;
        }
      >();
      const currencyMap = new Map<string, CurrencyAggregate>();

      const ensureDay = (key: string) => {
        const existing = dailyMap.get(key);
        if (existing) return existing;
        const created = {
          date: key,
          income: 0,
          expense: 0,
          transfer_in: 0,
          transfer_out: 0,
          net: 0,
          transaction_count: 0,
        };
        dailyMap.set(key, created);
        return created;
      };

      const ensureMonth = (key: string) => {
        const existing = monthlyMap.get(key);
        if (existing) return existing;
        const created = {
          month: key,
          income: 0,
          expense: 0,
          transfer_in: 0,
          transfer_out: 0,
          net: 0,
          transaction_count: 0,
        };
        monthlyMap.set(key, created);
        return created;
      };

      const ensureAccountAggregate = (accountId: number) => {
        const existing = accountAggregateMap.get(accountId);
        if (existing) return existing;

        const account = accountById.get(accountId);
        const currency = account?.currency || null;

        const created: AccountAggregate = {
          account_id: accountId,
          account_document_id: relationDocumentId(account) || "",
          account_name: String(account?.name || "Unknown Account"),
          currency_id: relationId(currency),
          currency_document_id: relationDocumentId(currency),
          currency_code: String(currency?.code || currency?.Code || ""),
          currency_symbol: String(currency?.symbol || currency?.Symbol || ""),
          excluded_from_statistics: Boolean(account?.exclude_from_statistics),
          income: 0,
          expense: 0,
          transfer_in: 0,
          transfer_out: 0,
          net: 0,
          transaction_count: 0,
        };

        accountAggregateMap.set(accountId, created);
        return created;
      };

      const ensurePayment = (paymentType: string) => {
        const key = paymentType || "Unknown";
        const existing = paymentMap.get(key);
        if (existing) return existing;
        const created = initAmountAggregate();
        paymentMap.set(key, created);
        return created;
      };

      const ensureContact = (tx: NormalizedTransaction) => {
        const key = tx.contactDocumentId || String(tx.contactId || "unknown");
        const existing = contactMap.get(key);
        if (existing) return existing;
        const created = {
          contact_id: tx.contactId,
          contact_document_id: tx.contactDocumentId,
          contact_name: tx.contactName || "Unknown",
          income: 0,
          expense: 0,
          transfer: 0,
          net: 0,
          transaction_count: 0,
        };
        contactMap.set(key, created);
        return created;
      };

      const ensureProject = (tx: NormalizedTransaction) => {
        const key = tx.projectDocumentId || String(tx.projectId || "none");
        const existing = projectMap.get(key);
        if (existing) return existing;
        const created = {
          project_id: tx.projectId,
          project_document_id: tx.projectDocumentId,
          project_name: tx.projectName || "No Project",
          income: 0,
          expense: 0,
          transfer: 0,
          net: 0,
          transaction_count: 0,
        };
        projectMap.set(key, created);
        return created;
      };

      const ensureCurrency = (
        key: string,
        currency: {
          currency_id: number | null;
          currency_document_id: string | null;
          code: string;
          symbol: string;
          name: string;
        },
      ) => {
        const existing = currencyMap.get(key);
        if (existing) return existing;

        const created: CurrencyAggregate = {
          currency_id: currency.currency_id,
          currency_document_id: currency.currency_document_id,
          code: currency.code,
          symbol: currency.symbol,
          name: currency.name,
          income: 0,
          expense: 0,
          transfer_in: 0,
          transfer_out: 0,
          net: 0,
          transaction_count: 0,
        };

        currencyMap.set(key, created);
        return created;
      };

      const applyCurrencyMovement = (
        tx: NormalizedTransaction,
        movement: {
          income: number;
          expense: number;
          transfer_in: number;
          transfer_out: number;
        },
      ) => {
        const register = (currencyEntity: any) => {
          const currencyId = relationId(currencyEntity);
          const currencyDocumentId = relationDocumentId(currencyEntity);
          const code = String(currencyEntity?.code || currencyEntity?.Code || "");
          const symbol = String(currencyEntity?.symbol || currencyEntity?.Symbol || "");
          const name = String(currencyEntity?.name || currencyEntity?.Name || "");
          const key = `${currencyId ?? "none"}:${currencyDocumentId ?? "none"}:${code}:${symbol}`;

          const aggregate = ensureCurrency(key, {
            currency_id: currencyId,
            currency_document_id: currencyDocumentId,
            code,
            symbol,
            name,
          });

          aggregate.income = round2(aggregate.income + movement.income);
          aggregate.expense = round2(aggregate.expense + movement.expense);
          aggregate.transfer_in = round2(aggregate.transfer_in + movement.transfer_in);
          aggregate.transfer_out = round2(aggregate.transfer_out + movement.transfer_out);
          aggregate.net = round2(
            aggregate.income + aggregate.transfer_in - aggregate.expense - aggregate.transfer_out,
          );
          aggregate.transaction_count += 1;
        };

        if (tx.kind === "income" || tx.kind === "expense") {
          const original = asArray<any>(transactions).find((raw) => raw.id === tx.id);
          const component = asArray<any>(original?.type)[0] || null;
          const componentCurrency = component?.currency || null;

          if (componentCurrency) {
            register(componentCurrency);
            return;
          }

          const accountId = tx.accountIds[0];
          const account = typeof accountId === "number" ? accountById.get(accountId) : null;
          register(account?.currency || null);
          return;
        }

        tx.accountIds.forEach((accountId) => {
          const account = accountById.get(accountId);
          register(account?.currency || null);
        });
      };

      let amountAccumulator = 0;

      filteredTransactions.forEach((tx) => {
        totals.transaction_count += 1;
        totals.income_total = round2(totals.income_total + tx.incomeAmount);
        totals.expense_total = round2(totals.expense_total + tx.expenseAmount);
        totals.transfer_in_total = round2(totals.transfer_in_total + tx.transferInAmount);
        totals.transfer_out_total = round2(totals.transfer_out_total + tx.transferOutAmount);

        amountAccumulator += tx.primaryAmount;

        const day = ensureDay(tx.dateKey);
        day.income = round2(day.income + tx.incomeAmount);
        day.expense = round2(day.expense + tx.expenseAmount);
        day.transfer_in = round2(day.transfer_in + tx.transferInAmount);
        day.transfer_out = round2(day.transfer_out + tx.transferOutAmount);
        day.net = round2(day.income + day.transfer_in - day.expense - day.transfer_out);
        day.transaction_count += 1;

        const month = ensureMonth(tx.monthKey);
        month.income = round2(month.income + tx.incomeAmount);
        month.expense = round2(month.expense + tx.expenseAmount);
        month.transfer_in = round2(month.transfer_in + tx.transferInAmount);
        month.transfer_out = round2(month.transfer_out + tx.transferOutAmount);
        month.net = round2(
          month.income + month.transfer_in - month.expense - month.transfer_out,
        );
        month.transaction_count += 1;

        if (tx.kind === "expense") {
          const existing = expenseCategoryMap.get(tx.categoryName);
          if (existing) {
            existing.total = round2(existing.total + tx.expenseAmount);
            existing.count += 1;
          } else {
            expenseCategoryMap.set(tx.categoryName, {
              category: tx.categoryName,
              total: tx.expenseAmount,
              count: 1,
            });
          }
        }

        if (tx.kind === "income") {
          const existing = incomeCategoryMap.get(tx.categoryName);
          if (existing) {
            existing.total = round2(existing.total + tx.incomeAmount);
            existing.count += 1;
          } else {
            incomeCategoryMap.set(tx.categoryName, {
              category: tx.categoryName,
              total: tx.incomeAmount,
              count: 1,
            });
          }
        }

        tx.accountIds.forEach((accountId) => {
          const aggregate = ensureAccountAggregate(accountId);
          aggregate.income = round2(aggregate.income + tx.incomeAmount);
          aggregate.expense = round2(aggregate.expense + tx.expenseAmount);

          if (tx.kind === "transfer") {
            const firstAccountId = tx.accountIds[0];
            const secondAccountId = tx.accountIds[1];

            if (accountId === firstAccountId) {
              aggregate.transfer_out = round2(aggregate.transfer_out + tx.transferOutAmount);
            }

            if (accountId === secondAccountId) {
              aggregate.transfer_in = round2(aggregate.transfer_in + tx.transferInAmount);
            }
          }

          aggregate.net = round2(
            aggregate.income + aggregate.transfer_in - aggregate.expense - aggregate.transfer_out,
          );
          aggregate.transaction_count += 1;
        });

        const payment = ensurePayment(tx.paymentType);
        addAmount(payment, tx.primaryAmount);

        const contact = ensureContact(tx);
        contact.income = round2(contact.income + tx.incomeAmount);
        contact.expense = round2(contact.expense + tx.expenseAmount);
        contact.transfer = round2(contact.transfer + tx.transferOutAmount + tx.transferInAmount);
        contact.net = round2(contact.income - contact.expense);
        contact.transaction_count += 1;

        const project = ensureProject(tx);
        project.income = round2(project.income + tx.incomeAmount);
        project.expense = round2(project.expense + tx.expenseAmount);
        project.transfer = round2(project.transfer + tx.transferOutAmount + tx.transferInAmount);
        project.net = round2(project.income - project.expense);
        project.transaction_count += 1;

        applyCurrencyMovement(tx, {
          income: tx.incomeAmount,
          expense: tx.expenseAmount,
          transfer_in: tx.transferInAmount,
          transfer_out: tx.transferOutAmount,
        });
      });

      totals.net_total = round2(totals.income_total - totals.expense_total);
      totals.average_transaction_amount =
        totals.transaction_count > 0
          ? round2(amountAccumulator / totals.transaction_count)
          : 0;

      const payrollMonthlyMap = new Map<
        string,
        {
          month: string;
          gross: number;
          net: number;
          loan_deduction: number;
          employee_count: number;
          batch_count: number;
        }
      >();

      asArray<any>(payrolls).forEach((batch) => {
        const batchStatus = String(batch?.payroll_status || "draft");
        if (payrollStatusSet.size > 0 && !payrollStatusSet.has(batchStatus)) {
          return;
        }

        const batchPayDate = parseDateInput(batch?.pay_date, true);
        if (dateFrom && batchPayDate && batchPayDate.getTime() < dateFrom.getTime()) {
          return;
        }
        if (dateTo && batchPayDate && batchPayDate.getTime() > dateTo.getTime()) {
          return;
        }

        const slips = asArray<any>(batch?.employee_details);
        let includedInBatch = 0;

        slips.forEach((slip) => {
          const contact = slip?.contact || null;
          const employeeComponent = getEmployeeComponent(contact);
          const department =
            typeof employeeComponent?.department === "string"
              ? employeeComponent.department
              : null;

          if (departmentSet.size > 0 && (!department || !departmentSet.has(department))) {
            return;
          }

          const accountId = relationId(slip?.payee_account);
          const accountDocumentId = relationDocumentId(slip?.payee_account);

          if (accountIdSet.size > 0 && (accountId === null || !accountIdSet.has(accountId))) {
            return;
          }

          if (
            accountDocumentIdSet.size > 0 &&
            (!accountDocumentId || !accountDocumentIdSet.has(accountDocumentId))
          ) {
            return;
          }

          const currency =
            slip?.payee_account?.currency || employeeComponent?.currency || null;
          const currencyId = relationId(currency);
          const currencyDocumentId = relationDocumentId(currency);

          if (currencyIdSet.size > 0 && (currencyId === null || !currencyIdSet.has(currencyId))) {
            return;
          }

          if (
            currencyDocumentIdSet.size > 0 &&
            (!currencyDocumentId || !currencyDocumentIdSet.has(currencyDocumentId))
          ) {
            return;
          }

          const gross = round2(toNumber(slip?.gross_pay));
          const deduction = round2(
            toNullableNumber(slip?.converted_loan_deduction) ??
              toNumber(slip?.loan_amount_to_deduct),
          );
          const net = round2(
            toNullableNumber(slip?.converted_net_pay) ?? toNumber(slip?.net_pay),
          );

          if (minAmount !== null && net < minAmount) {
            return;
          }

          if (maxAmount !== null && net > maxAmount) {
            return;
          }

          totals.payroll_gross_total = round2(totals.payroll_gross_total + gross);
          totals.payroll_net_total = round2(totals.payroll_net_total + net);
          totals.payroll_loan_deduction_total = round2(
            totals.payroll_loan_deduction_total + deduction,
          );
          totals.payroll_employee_count += 1;
          includedInBatch += 1;

          const monthKey = batchPayDate ? toMonthKey(batchPayDate) : String(batch?.pay_date || "unknown");
          const existing = payrollMonthlyMap.get(monthKey);
          if (existing) {
            existing.gross = round2(existing.gross + gross);
            existing.net = round2(existing.net + net);
            existing.loan_deduction = round2(existing.loan_deduction + deduction);
            existing.employee_count += 1;
          } else {
            payrollMonthlyMap.set(monthKey, {
              month: monthKey,
              gross,
              net,
              loan_deduction: deduction,
              employee_count: 1,
              batch_count: 0,
            });
          }
        });

        if (includedInBatch > 0) {
          const monthKey = batchPayDate ? toMonthKey(batchPayDate) : String(batch?.pay_date || "unknown");
          const monthly = payrollMonthlyMap.get(monthKey);
          if (monthly) {
            monthly.batch_count += 1;
          }
        }
      });

      const loanStatusMap = new Map<
        string,
        {
          status: string;
          loan_count: number;
          outstanding_total: number;
          total_amount: number;
          monthly_installment_total: number;
        }
      >();

      asArray<any>(loans).forEach((loan) => {
        const status = String(loan?.status || "Active");
        if (loanStatusSet.size > 0 && !loanStatusSet.has(status)) {
          return;
        }

        const remaining = round2(toNumber(loan?.remaining_balance));
        const totalAmount = round2(toNumber(loan?.total_amount));
        const monthlyInstallment = round2(toNumber(loan?.monthly_installment));

        totals.loan_outstanding_total = round2(totals.loan_outstanding_total + remaining);

        if (status === "Active") totals.active_loans += 1;
        if (status === "Paid Off") totals.paid_off_loans += 1;
        if (status === "Defaulted") totals.defaulted_loans += 1;

        const existing = loanStatusMap.get(status);
        if (existing) {
          existing.loan_count += 1;
          existing.outstanding_total = round2(existing.outstanding_total + remaining);
          existing.total_amount = round2(existing.total_amount + totalAmount);
          existing.monthly_installment_total = round2(
            existing.monthly_installment_total + monthlyInstallment,
          );
        } else {
          loanStatusMap.set(status, {
            status,
            loan_count: 1,
            outstanding_total: remaining,
            total_amount: totalAmount,
            monthly_installment_total: monthlyInstallment,
          });
        }
      });

      const expenseByCategory = Array.from(expenseCategoryMap.values()).sort(
        (a, b) => b.total - a.total,
      );
      const incomeByCategory = Array.from(incomeCategoryMap.values()).sort(
        (a, b) => b.total - a.total,
      );

      const accountMovement = Array.from(accountAggregateMap.values())
        .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
        .slice(0, topLimit);

      const paymentBreakdown = Array.from(paymentMap.entries())
        .map(([payment_type, aggregate]) => ({
          payment_type,
          total: round2(aggregate.total),
          count: aggregate.count,
          average: aggregate.count > 0 ? round2(aggregate.total / aggregate.count) : 0,
        }))
        .sort((a, b) => b.total - a.total);

      const topContacts = Array.from(contactMap.values())
        .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
        .slice(0, topLimit);

      const topProjects = Array.from(projectMap.values())
        .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
        .slice(0, topLimit);

      const currencyBreakdown = Array.from(currencyMap.values()).sort(
        (a, b) => Math.abs(b.net) - Math.abs(a.net),
      );

      const dailyCashflow = Array.from(dailyMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date),
      );
      const monthlyCashflow = Array.from(monthlyMap.values()).sort((a, b) =>
        a.month.localeCompare(b.month),
      );
      const payrollMonthly = Array.from(payrollMonthlyMap.values()).sort((a, b) =>
        a.month.localeCompare(b.month),
      );
      const loanStatusSummary = Array.from(loanStatusMap.values()).sort((a, b) =>
        a.status.localeCompare(b.status),
      );
      const accountBalances = Array.from(accountBalanceMap.values()).sort(
        (a, b) => Math.abs(b.balance) - Math.abs(a.balance),
      );

      const options = {
        accounts: asArray<any>(accounts).map((account) => ({
          id: relationId(account),
          documentId: relationDocumentId(account),
          name: String(account?.name || ""),
          exclude_from_statistics: Boolean(account?.exclude_from_statistics),
          currency: {
            id: relationId(account?.currency),
            documentId: relationDocumentId(account?.currency),
            code: String(account?.currency?.code || account?.currency?.Code || ""),
            name: String(account?.currency?.name || account?.currency?.Name || ""),
            symbol: String(account?.currency?.symbol || account?.currency?.Symbol || ""),
          },
        })),
        currencies: asArray<any>(currencies).map((currency) => ({
          id: relationId(currency),
          documentId: relationDocumentId(currency),
          code: String(currency?.code || currency?.Code || ""),
          name: String(currency?.name || currency?.Name || ""),
          symbol: String(currency?.symbol || currency?.Symbol || ""),
          is_active:
            typeof currency?.is_active === "boolean" ? currency.is_active : true,
        })),
        categories: asArray<any>(categories).map((category) => ({
          id: relationId(category),
          documentId: relationDocumentId(category),
          name: String(category?.name || ""),
        })),
        contacts: asArray<any>(contacts).map((contact) => {
          const employeeComponent = getEmployeeComponent(contact);
          return {
            id: relationId(contact),
            documentId: relationDocumentId(contact),
            name: String(contact?.name || ""),
            email: String(contact?.email || ""),
            department:
              typeof employeeComponent?.department === "string"
                ? employeeComponent.department
                : null,
          };
        }),
        projects: asArray<any>(projects).map((project) => ({
          id: relationId(project),
          documentId: relationDocumentId(project),
          name: String(project?.name || ""),
          status: String(project?.status || ""),
          contact: {
            id: relationId(project?.contact),
            documentId: relationDocumentId(project?.contact),
            name: String(project?.contact?.name || ""),
          },
        })),
        payment_types: PAYMENT_TYPES,
        transaction_kinds: TRANSACTION_KINDS,
        departments: Array.from(
          new Set(
            asArray<any>(contacts)
              .map((contact) => getEmployeeComponent(contact)?.department)
              .filter((department): department is string => typeof department === "string"),
          ),
        ).sort((a, b) => a.localeCompare(b)),
        loan_statuses: LOAN_STATUSES,
        payroll_statuses: PAYROLL_STATUSES,
      };

      return {
        data: {
          generated_at: new Date().toISOString(),
          filters_applied: {
            date_from: dateFrom ? toIsoDate(dateFrom) : null,
            date_to: dateTo ? toIsoDate(dateTo) : null,
            min_amount: minAmount,
            max_amount: maxAmount,
            account_ids: Array.from(accountIdSet),
            account_document_ids: Array.from(accountDocumentIdSet),
            currency_ids: Array.from(currencyIdSet),
            currency_document_ids: Array.from(currencyDocumentIdSet),
            contact_ids: Array.from(contactIdSet),
            contact_document_ids: Array.from(contactDocumentIdSet),
            category_ids: Array.from(categoryIdSet),
            category_document_ids: Array.from(categoryDocumentIdSet),
            project_ids: Array.from(projectIdSet),
            project_document_ids: Array.from(projectDocumentIdSet),
            payment_types: Array.from(paymentTypeSet),
            transaction_kinds: Array.from(transactionKindSet),
            departments: Array.from(departmentSet),
            loan_statuses: Array.from(loanStatusSet),
            payroll_statuses: Array.from(payrollStatusSet),
            include_excluded_accounts: includeExcludedAccounts,
            search,
          },
          totals,
          series: {
            daily_cashflow: dailyCashflow,
            monthly_cashflow: monthlyCashflow,
            expense_by_category: expenseByCategory,
            income_by_category: incomeByCategory,
            account_movement: accountMovement,
            payment_breakdown: paymentBreakdown,
            top_contacts: topContacts,
            top_projects: topProjects,
            currency_breakdown: currencyBreakdown,
            payroll_by_month: payrollMonthly,
            loan_status_summary: loanStatusSummary,
            account_balances: accountBalances,
          },
          options,
        },
      };
    },
  }),
);
