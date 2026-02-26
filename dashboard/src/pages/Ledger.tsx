import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCcw,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { AddTransactionModal } from "../components/AddTransactionModal";
import { currencySymbol } from "../lib/currency";

type TransactionComponent = {
  __component?: string;
  amount?: number | string | null;
  from_amount?: number | string | null;
  to_amount?: number | string | null;
  account?: {
    documentId?: string | null;
    name?: string | null;
  } | null;
  from_account?: {
    documentId?: string | null;
    name?: string | null;
  } | null;
  to_account?: {
    documentId?: string | null;
    name?: string | null;
  } | null;
  currency?: {
    symbol?: string | null;
    name?: string | null;
    Symbol?: string | null;
    Name?: string | null;
  } | null;
};

type Transaction = {
  id: number;
  documentId: string;
  date_time: string;
  note?: string | null;
  payment_type?: string | null;
  type?: TransactionComponent[];
  contact?: { name?: string | null } | null;
  project?: { name?: string | null } | null;
  category?: { name?: string | null } | null;
};

type CategoryOption = {
  documentId: string;
  name: string;
};

type AccountOption = {
  documentId: string;
  name: string;
};

type PaginationMeta = {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
};

type SortField = "date_time" | "payment_type" | "note";
type SortDirection = "asc" | "desc";

const CATEGORY_FETCH_PAGE_SIZE = 100;
const ACCOUNT_FETCH_PAGE_SIZE = 100;
const PAYMENT_OPTIONS = [
  "Cash",
  "Debit Card",
  "Credit Card",
  "Transfer",
  "Voucher",
  "Mobile Payment",
];
const SORT_FIELD_MAP: Record<SortField, string> = {
  date_time: "date_time",
  payment_type: "payment_type",
  note: "note",
};

const TypeIcon = ({ type }: { type?: string }) => {
  if (type === "type.income")
    return <ArrowUpRight className="text-emerald-500" size={18} />;
  if (type === "type.expense")
    return <ArrowDownRight className="text-red-500" size={18} />;
  return <RefreshCcw className="text-blue-500" size={18} />;
};

const toNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getComponent = (tx: Transaction) => tx.type?.[0];

const getTypeKey = (tx: Transaction) => {
  const type = getComponent(tx)?.__component;
  if (type === "type.income") return "income";
  if (type === "type.expense") return "expense";
  return "transfer";
};

const getTypeLabel = (tx: Transaction) => {
  const typeKey = getTypeKey(tx);
  if (typeKey === "income") return "Income";
  if (typeKey === "expense") return "Expense";
  return "Transfer";
};

const getAmountDisplay = (tx: Transaction) => {
  const component = getComponent(tx);
  if (!component) return "-";

  const symbol = currencySymbol(component.currency);
  if (component.__component === "type.transfer") {
    const from = toNumber(component.from_amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const to = toNumber(component.to_amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `From: ${from} | To: ${to}`;
  }

  const amount = toNumber(component.amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return symbol ? `${symbol} ${amount}` : amount;
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return format(parsed, "MMM dd, yyyy h:mm a");
};

const buildTransactionQueryString = ({
  page,
  pageSize,
  search,
  paymentFilter,
  categoryFilter,
  accountFilter,
  sortField,
  sortDirection,
}: {
  page: number;
  pageSize: number;
  search: string;
  paymentFilter: string;
  categoryFilter: string;
  accountFilter: string;
  sortField: SortField;
  sortDirection: SortDirection;
}) => {
  const params = new URLSearchParams();

  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  params.set("sortField", SORT_FIELD_MAP[sortField]);
  params.set("sortDirection", sortDirection);

  if (paymentFilter !== "all") {
    params.set("paymentFilter", paymentFilter);
  }

  if (categoryFilter !== "all") {
    params.set("categoryFilter", categoryFilter);
  }

  if (accountFilter !== "all") {
    params.set("accountFilter", accountFilter);
  }

  if (search) {
    params.set("search", search);
  }

  return params.toString();
};

export const LedgerPage = () => {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("date_time");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 10,
    pageCount: 1,
    total: 0,
  });
  const [refreshNonce, setRefreshNonce] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  useEffect(() => {
    let isCancelled = false;

    const loadCategories = async () => {
      setLoadingCategories(true);
      try {
        const loaded: CategoryOption[] = [];
        let currentPage = 1;
        let hasMore = true;

        while (hasMore) {
          const res = await api.get(
            `/categories?sort=name:asc&pagination[page]=${currentPage}&pagination[pageSize]=${CATEGORY_FETCH_PAGE_SIZE}`,
          );
          const pageData = (res.data?.data ?? []) as Array<{
            documentId?: string;
            name?: string;
          }>;
          pageData.forEach((item) => {
            if (item.documentId && item.name) {
              loaded.push({ documentId: item.documentId, name: item.name });
            }
          });

          const pageCount = Number(res.data?.meta?.pagination?.pageCount ?? 1);
          hasMore = currentPage < pageCount;
          currentPage += 1;
        }

        if (!isCancelled) {
          setCategories(loaded);
        }
      } catch (e) {
        console.error("Failed to load categories", e);
      } finally {
        if (!isCancelled) {
          setLoadingCategories(false);
        }
      }
    };

    const loadAccounts = async () => {
      setLoadingAccounts(true);
      try {
        const loaded: AccountOption[] = [];
        let currentPage = 1;
        let hasMore = true;

        while (hasMore) {
          const res = await api.get(
            `/accounts?sort=name:asc&pagination[page]=${currentPage}&pagination[pageSize]=${ACCOUNT_FETCH_PAGE_SIZE}`,
          );
          const pageData = (res.data?.data ?? []) as Array<{
            documentId?: string;
            name?: string;
          }>;
          pageData.forEach((item) => {
            if (item.documentId && item.name) {
              loaded.push({ documentId: item.documentId, name: item.name });
            }
          });

          const pageCount = Number(res.data?.meta?.pagination?.pageCount ?? 1);
          hasMore = currentPage < pageCount;
          currentPage += 1;
        }

        if (!isCancelled) {
          setAccounts(loaded);
        }
      } catch (e) {
        console.error("Failed to load accounts", e);
      } finally {
        if (!isCancelled) {
          setLoadingAccounts(false);
        }
      }
    };

    void loadCategories();
    void loadAccounts();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearchQuery,
    paymentFilter,
    categoryFilter,
    accountFilter,
    sortField,
    sortDirection,
    pageSize,
  ]);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setLoading(true);
    setErrorMessage(null);

    const loadTransactions = async () => {
      try {
        const queryString = buildTransactionQueryString({
          page,
          pageSize,
          search: debouncedSearchQuery,
          paymentFilter,
          categoryFilter,
          accountFilter,
          sortField,
          sortDirection,
        });
        const res = await api.get(
          `/transactions?${queryString}`,
        );

        if (requestId !== requestIdRef.current) {
          return;
        }

        const data = (res.data?.data ?? []) as Transaction[];
        const rawPagination = res.data?.meta?.pagination;
        const normalizedPagination: PaginationMeta = {
          page: Number(rawPagination?.page ?? page) || page,
          pageSize: Number(rawPagination?.pageSize ?? pageSize) || pageSize,
          pageCount: Math.max(1, Number(rawPagination?.pageCount ?? 1) || 1),
          total: Number(rawPagination?.total ?? 0) || 0,
        };

        setTxs(data);
        setPagination(normalizedPagination);
      } catch (e) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        console.error(e);
        setTxs([]);
        setPagination({
          page,
          pageSize,
          pageCount: 1,
          total: 0,
        });
        setErrorMessage("Failed to load ledger data.");
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    };

    void loadTransactions();
  }, [
    page,
    pageSize,
    debouncedSearchQuery,
    paymentFilter,
    categoryFilter,
    accountFilter,
    sortField,
    sortDirection,
    refreshNonce,
  ]);

  useEffect(() => {
    if (page > pagination.pageCount) {
      setPage(pagination.pageCount);
    }
  }, [page, pagination.pageCount]);

  const totalItems = pagination.total;
  const totalPages = pagination.pageCount;
  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = totalItems === 0 ? 0 : Math.min(page * pageSize, totalItems);

  const clearFilters = () => {
    setSearchQuery("");
    setPaymentFilter("all");
    setCategoryFilter("all");
    setAccountFilter("all");
    setSortField("date_time");
    setSortDirection("desc");
    setPage(1);
  };

  return (
    <div className="space-y-6 text-slate-200">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Transactions Ledger</h1>
          <p className="text-slate-400 mt-1">
            Manage and view all cash flow records.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium"
        >
          <Plus size={18} />
          New Transaction
        </button>
      </div>

      <AddTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setPage(1);
          setRefreshNonce((prev) => prev + 1);
        }}
      />

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes, contacts, project, category..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-9 pr-3 text-sm text-slate-200 outline-none transition-colors focus:border-indigo-500"
            />
          </div>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none transition-colors focus:border-indigo-500"
          >
            <option value="all">All Payment Methods</option>
            {PAYMENT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none transition-colors focus:border-indigo-500"
          >
            <option value="all">All Categories</option>
            {categories.map((category) => (
              <option key={category.documentId} value={category.documentId}>
                {category.name}
              </option>
            ))}
          </select>

          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none transition-colors focus:border-indigo-500"
          >
            <option value="all">All Accounts</option>
            {accounts.map((account) => (
              <option key={account.documentId} value={account.documentId}>
                {account.name}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none transition-colors focus:border-indigo-500"
            >
              <option value="date_time">Sort: Date</option>
              <option value="payment_type">Sort: Payment Method</option>
              <option value="note">Sort: Note</option>
            </select>
            <button
              type="button"
              onClick={() =>
                setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
              }
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
            >
              {sortDirection === "asc" ? "Asc" : "Desc"}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <span>
              {loading
                ? "Loading transactions..."
                : `${totalItems} matching transaction${totalItems === 1 ? "" : "s"}`}
            </span>
            {loadingCategories && (
              <span className="text-xs text-slate-500">
                Loading category filters...
              </span>
            )}
            {loadingAccounts && (
              <span className="text-xs text-slate-500">
                Loading account filters...
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="text-left text-indigo-400 transition-colors hover:text-indigo-300 sm:text-right"
          >
            Reset filters
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800 border-b border-slate-700 text-slate-300 text-sm">
              <th className="p-4 font-medium">Date & Time</th>
              <th className="p-4 font-medium">Type</th>
              <th className="p-4 font-medium">Category / Project</th>
              <th className="p-4 font-medium">Contact</th>
              <th className="p-4 font-medium">Payment Method</th>
              <th className="p-4 font-medium">Amount</th>
              <th className="p-4 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  Loading transactions...
                </td>
              </tr>
            ) : errorMessage ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-red-400">
                  {errorMessage}
                </td>
              </tr>
            ) : txs.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  No transactions match the selected filters.
                </td>
              </tr>
            ) : (
              txs.map((tx) => (
                <tr
                  key={tx.id}
                  className="hover:bg-slate-800/50 transition-colors"
                >
                  <td className="p-4 whitespace-nowrap">
                    {formatDate(tx.date_time)}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <TypeIcon type={getComponent(tx)?.__component} />
                      <span>{getTypeLabel(tx)}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm">
                      <div className="text-slate-200">
                        {tx.category?.name || "Uncategorized"}
                      </div>
                      <div className="text-slate-500 text-xs">
                        {tx.project?.name || "-"}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">{tx.contact?.name || "-"}</td>
                  <td className="p-4 text-sm text-slate-400">
                    {tx.payment_type || "Unspecified"}
                  </td>
                  <td className="p-4 font-medium font-mono text-slate-200">
                    {getAmountDisplay(tx)}
                  </td>
                  <td className="p-4 text-right">
                    <Link
                      to={`/ledger/${tx.documentId}`}
                      className="inline-flex items-center gap-1 text-indigo-400 font-medium hover:text-indigo-300 transition-colors"
                    >
                      View <ArrowUpRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="border-t border-slate-800 px-4 py-3">
          <div className="flex flex-col gap-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <div>
              Showing {startItem}-{endItem} of {totalItems}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="ledger-page-size">Rows</label>
              <select
                id="ledger-page-size"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-200 outline-none focus:border-indigo-500"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>

              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-slate-300 transition-colors hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={14} />
                Prev
              </button>

              <span className="px-1">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                disabled={loading || page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-slate-300 transition-colors hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
