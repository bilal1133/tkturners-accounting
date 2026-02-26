import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import {
  Activity,
  ArrowUpRight,
  Building2,
  Landmark,
  Plus,
  Wallet,
} from "lucide-react";
import { AddAccountModal } from "../components/AddAccountModal";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { currencyName, currencySymbol } from "../lib/currency";

type Currency = {
  name?: string | null;
  symbol?: string | null;
  Name?: string | null;
  Symbol?: string | null;
};

type Account = {
  id: number;
  documentId: string;
  name: string;
  initial_amount: number | string;
  exclude_from_statistics?: boolean | null;
  currency?: Currency | null;
};

type AccountRef = {
  documentId?: string | null;
};

type IncomeComponent = {
  __component: "type.income";
  amount?: number | string | null;
  account?: AccountRef | null;
};

type ExpenseComponent = {
  __component: "type.expense";
  amount?: number | string | null;
  account?: AccountRef | null;
};

type TransferComponent = {
  __component: "type.transfer";
  from_amount?: number | string | null;
  to_amount?: number | string | null;
  from_account?: AccountRef | null;
  to_account?: AccountRef | null;
};

type TransactionComponent = IncomeComponent | ExpenseComponent | TransferComponent;

type Transaction = {
  id: number;
  date_time?: string | null;
  type?: TransactionComponent[];
};

type AccountMetrics = {
  inflow: number;
  outflow: number;
  transferIn: number;
  transferOut: number;
  txCount: number;
  lastActivity: string | null;
};

type AccountSummary = {
  account: Account;
  symbol: string;
  currencyLabel: string;
  initial: number;
  current: number;
  netChange: number;
  inflow: number;
  outflow: number;
  transferIn: number;
  transferOut: number;
  txCount: number;
  lastActivity: string | null;
};

type CurrencyBucket = {
  key: string;
  label: string;
  symbol: string;
  total: number;
  accountCount: number;
};

const EMPTY_METRICS: AccountMetrics = {
  inflow: 0,
  outflow: 0,
  transferIn: 0,
  transferOut: 0,
  txCount: 0,
  lastActivity: null,
};

const toNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatAmount = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatMoney = (symbol: string, amount: number) =>
  symbol ? `${symbol} ${formatAmount(amount)}` : formatAmount(amount);

const toDisplayDate = (value: string | null) => {
  if (!value) return "No activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No activity";
  return format(date, "MMM dd, yyyy");
};

export const AccountsPage = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [accountsRes, txRes] = await Promise.all([
        api.get("/accounts?populate=*"),
        api.get(
          "/transactions?populate[0]=type.account&populate[1]=type.from_account&populate[2]=type.to_account&sort=date_time:desc",
        ),
      ]);
      setAccounts(accountsRes.data.data ?? []);
      setTransactions(txRes.data.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const metricsByAccount = useMemo(() => {
    const map = new Map<string, AccountMetrics>();

    const ensureMetrics = (documentId: string) => {
      const existing = map.get(documentId);
      if (existing) return existing;

      const created: AccountMetrics = { ...EMPTY_METRICS };
      map.set(documentId, created);
      return created;
    };

    const registerActivity = (
      metrics: AccountMetrics,
      dateTime?: string | null,
    ) => {
      metrics.txCount += 1;

      if (!dateTime) return;
      if (!metrics.lastActivity) {
        metrics.lastActivity = dateTime;
        return;
      }

      const currentTime = new Date(metrics.lastActivity).getTime();
      const nextTime = new Date(dateTime).getTime();
      if (!Number.isNaN(nextTime) && nextTime > currentTime) {
        metrics.lastActivity = dateTime;
      }
    };

    transactions.forEach((tx) => {
      const component = tx.type?.[0];
      if (!component) return;

      if (component.__component === "type.income") {
        const accountId = component.account?.documentId;
        if (!accountId) return;
        const metrics = ensureMetrics(accountId);
        metrics.inflow += toNumber(component.amount);
        registerActivity(metrics, tx.date_time);
        return;
      }

      if (component.__component === "type.expense") {
        const accountId = component.account?.documentId;
        if (!accountId) return;
        const metrics = ensureMetrics(accountId);
        metrics.outflow += toNumber(component.amount);
        registerActivity(metrics, tx.date_time);
        return;
      }

      const fromAccountId = component.from_account?.documentId;
      if (fromAccountId) {
        const metrics = ensureMetrics(fromAccountId);
        metrics.transferOut += toNumber(component.from_amount);
        registerActivity(metrics, tx.date_time);
      }

      const toAccountId = component.to_account?.documentId;
      if (toAccountId) {
        const metrics = ensureMetrics(toAccountId);
        metrics.transferIn += toNumber(component.to_amount);
        registerActivity(metrics, tx.date_time);
      }
    });

    return map;
  }, [transactions]);

  const accountSummaries = useMemo<AccountSummary[]>(() => {
    return accounts
      .map((account) => {
        const metrics = metricsByAccount.get(account.documentId) ?? EMPTY_METRICS;
        const initial = toNumber(account.initial_amount);
        const current =
          initial +
          metrics.inflow +
          metrics.transferIn -
          metrics.outflow -
          metrics.transferOut;
        const symbol = currencySymbol(account.currency) || "";
        const currencyLabel = currencyName(account.currency) || "Unknown currency";

        return {
          account,
          symbol,
          currencyLabel,
          initial,
          current,
          netChange: current - initial,
          inflow: metrics.inflow,
          outflow: metrics.outflow,
          transferIn: metrics.transferIn,
          transferOut: metrics.transferOut,
          txCount: metrics.txCount,
          lastActivity: metrics.lastActivity,
        };
      })
      .sort((a, b) => b.current - a.current);
  }, [accounts, metricsByAccount]);

  const currencyTotals = useMemo<CurrencyBucket[]>(() => {
    const buckets = new Map<string, CurrencyBucket>();

    accountSummaries.forEach((summary) => {
      const key = `${summary.symbol}:${summary.currencyLabel}`;
      const existing = buckets.get(key);

      if (existing) {
        existing.total += summary.current;
        existing.accountCount += 1;
        return;
      }

      buckets.set(key, {
        key,
        label: summary.currencyLabel,
        symbol: summary.symbol,
        total: summary.current,
        accountCount: 1,
      });
    });

    return Array.from(buckets.values()).sort((a, b) => b.total - a.total);
  }, [accountSummaries]);

  const includedCount = accountSummaries.filter(
    (summary) => !summary.account.exclude_from_statistics,
  ).length;
  const excludedCount = accountSummaries.length - includedCount;
  const activeInLast30Days = accountSummaries.filter((summary) => {
    if (!summary.lastActivity) return false;
    const diff = Date.now() - new Date(summary.lastActivity).getTime();
    return diff <= 1000 * 60 * 60 * 24 * 30;
  }).length;
  const topAccount = accountSummaries[0];

  return (
    <div className="space-y-8 text-slate-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Accounts & Books</h1>
          <p className="mt-1 text-slate-400">
            Manage balances, monitor movement, and open any account ledger in
            one click.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700"
        >
          <Plus size={18} /> Add Account
        </button>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <Wallet size={16} className="text-indigo-400" />
          Current balance by currency
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {currencyTotals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-500">
              Add your first account to see currency totals.
            </div>
          ) : (
            currencyTotals.map((bucket) => (
              <div
                key={bucket.key}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {bucket.label}
                </p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {formatMoney(bucket.symbol, bucket.total)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {bucket.accountCount}{" "}
                  {bucket.accountCount === 1 ? "account" : "accounts"}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Accounts
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {accountSummaries.length}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {includedCount} included in statistics
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Excluded
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {excludedCount}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Hidden from global net worth
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Active in 30 Days
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {activeInLast30Days}
          </p>
          <p className="mt-1 text-xs text-slate-400">Based on last activity</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Top Account
          </p>
          <p className="mt-2 truncate text-base font-semibold text-white">
            {topAccount?.account.name || "N/A"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {topAccount
              ? formatMoney(topAccount.symbol, topAccount.current)
              : "No balance data"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="col-span-full rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center text-slate-500">
            Loading accounts...
          </div>
        ) : (
          accountSummaries.map((summary) => {
            const incoming = summary.inflow + summary.transferIn;
            const outgoing = summary.outflow + summary.transferOut;
            const changeClass =
              summary.netChange >= 0
                ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                : "border-rose-500/20 bg-rose-500/5 text-rose-400";

            return (
              <Link
                to={`/accounts/${summary.account.documentId}`}
                key={summary.account.id}
                className="group relative block overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-500/50 hover:bg-slate-900"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-3 inline-flex rounded-lg bg-indigo-500/10 p-2 text-indigo-300">
                      <Building2 size={20} />
                    </div>
                    <h3
                      className="truncate text-lg font-semibold text-white"
                      title={summary.account.name}
                    >
                      {summary.account.name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {summary.currencyLabel}
                    </p>
                  </div>
                  <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs font-medium text-slate-300">
                    {summary.symbol || "N/A"}
                  </span>
                </div>

                <div className="mt-5">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Current Balance
                  </p>
                  <p className="mt-1 text-3xl font-bold text-white">
                    {formatMoney(summary.symbol, summary.current)}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                    <p className="text-xs text-slate-500">Initial</p>
                    <p className="mt-1 font-medium text-slate-200">
                      {formatMoney(summary.symbol, summary.initial)}
                    </p>
                  </div>
                  <div className={`rounded-lg border p-3 ${changeClass}`}>
                    <p className="text-xs text-slate-500">Net Change</p>
                    <p className="mt-1 font-semibold">
                      {summary.netChange >= 0 ? "+" : "-"}
                      {formatMoney(summary.symbol, Math.abs(summary.netChange))}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-emerald-400">
                    <ArrowUpRight size={14} />
                    {formatMoney(summary.symbol, incoming)}
                  </div>
                  <div className="flex items-center gap-1 text-rose-400">
                    <ArrowUpRight size={14} className="rotate-90" />
                    {formatMoney(summary.symbol, outgoing)}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-4 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Activity size={12} />
                    {summary.txCount}{" "}
                    {summary.txCount === 1 ? "transaction" : "transactions"}
                  </span>
                  <span>Last: {toDisplayDate(summary.lastActivity)}</span>
                </div>

                {summary.account.exclude_from_statistics && (
                  <span className="mt-3 inline-block rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                    Excluded from stats
                  </span>
                )}
              </Link>
            );
          })
        )}

        {!loading && accountSummaries.length === 0 && (
          <div className="col-span-full rounded-xl border-2 border-dashed border-slate-800 p-12 text-center">
            <Landmark size={48} className="mx-auto mb-4 text-slate-600" />
            <h3 className="mb-2 text-lg font-medium text-white">
              No accounts found
            </h3>
            <p className="mx-auto mb-6 max-w-sm text-slate-400">
              Create your first bank account or cash wallet to start tracking
              transactions.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 font-medium text-white transition-colors hover:bg-slate-700"
            >
              <Plus size={18} /> Add Account
            </button>
          </div>
        )}
      </div>

      <AddAccountModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => loadData()}
      />
    </div>
  );
};
