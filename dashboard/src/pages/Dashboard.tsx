import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  Briefcase,
  Building2,
  CalendarCheck2,
  Clock3,
  Coins,
  Filter,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { api } from "../lib/api";

type FilterState = {
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
  search: string;
  includeExcludedAccounts: boolean;
  accountIds: string[];
  currencyIds: string[];
  paymentTypes: string[];
  transactionKinds: string[];
  categoryIds: string[];
  contactIds: string[];
  projectIds: string[];
  departments: string[];
  loanStatuses: string[];
  payrollStatuses: string[];
};

type OptionValue = {
  value: string;
  label: string;
};

type DashboardTotals = {
  transaction_count: number;
  income_total: number;
  expense_total: number;
  transfer_in_total: number;
  transfer_out_total: number;
  net_total: number;
  average_transaction_amount: number;
  payroll_gross_total: number;
  payroll_net_total: number;
  payroll_loan_deduction_total: number;
  payroll_employee_count: number;
  loan_outstanding_total: number;
  active_loans: number;
  paid_off_loans: number;
  defaulted_loans: number;
};

type DailyCashflowPoint = {
  date: string;
  income: number;
  expense: number;
  transfer_in: number;
  transfer_out: number;
  net: number;
  transaction_count: number;
};

type MonthlyCashflowPoint = {
  month: string;
  income: number;
  expense: number;
  transfer_in: number;
  transfer_out: number;
  net: number;
  transaction_count: number;
};

type CategoryPoint = {
  category: string;
  total: number;
  count: number;
};

type AccountMovement = {
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

type PaymentPoint = {
  payment_type: string;
  total: number;
  count: number;
  average: number;
};

type TopContact = {
  contact_id: number | null;
  contact_document_id: string | null;
  contact_name: string;
  income: number;
  expense: number;
  transfer: number;
  net: number;
  transaction_count: number;
};

type TopProject = {
  project_id: number | null;
  project_document_id: string | null;
  project_name: string;
  income: number;
  expense: number;
  transfer: number;
  net: number;
  transaction_count: number;
};

type CurrencyPoint = {
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

type PayrollMonthPoint = {
  month: string;
  gross: number;
  net: number;
  loan_deduction: number;
  employee_count: number;
  batch_count: number;
};

type LoanStatusPoint = {
  status: string;
  loan_count: number;
  outstanding_total: number;
  total_amount: number;
  monthly_installment_total: number;
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

type DashboardSeries = {
  daily_cashflow: DailyCashflowPoint[];
  monthly_cashflow: MonthlyCashflowPoint[];
  expense_by_category: CategoryPoint[];
  income_by_category: CategoryPoint[];
  account_movement: AccountMovement[];
  payment_breakdown: PaymentPoint[];
  top_contacts: TopContact[];
  top_projects: TopProject[];
  currency_breakdown: CurrencyPoint[];
  payroll_by_month: PayrollMonthPoint[];
  loan_status_summary: LoanStatusPoint[];
  account_balances: AccountBalancePoint[];
};

type DashboardOptions = {
  accounts: Array<{
    id: number | null;
    documentId: string | null;
    name: string;
    exclude_from_statistics: boolean;
    currency: {
      id: number | null;
      documentId: string | null;
      code: string;
      name: string;
      symbol: string;
    };
  }>;
  currencies: Array<{
    id: number | null;
    documentId: string | null;
    code: string;
    name: string;
    symbol: string;
    is_active: boolean;
  }>;
  categories: Array<{
    id: number | null;
    documentId: string | null;
    name: string;
  }>;
  contacts: Array<{
    id: number | null;
    documentId: string | null;
    name: string;
    email: string;
    department: string | null;
  }>;
  projects: Array<{
    id: number | null;
    documentId: string | null;
    name: string;
    status: string;
    contact: {
      id: number | null;
      documentId: string | null;
      name: string;
    };
  }>;
  payment_types: string[];
  transaction_kinds: string[];
  departments: string[];
  loan_statuses: string[];
  payroll_statuses: string[];
};

type DashboardData = {
  generated_at: string;
  totals: DashboardTotals;
  series: DashboardSeries;
  options: DashboardOptions;
};

const EMPTY_FILTERS: FilterState = {
  dateFrom: "",
  dateTo: "",
  minAmount: "",
  maxAmount: "",
  search: "",
  includeExcludedAccounts: false,
  accountIds: [],
  currencyIds: [],
  paymentTypes: [],
  transactionKinds: [],
  categoryIds: [],
  contactIds: [],
  projectIds: [],
  departments: [],
  loanStatuses: [],
  payrollStatuses: [],
};

const toMoney = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const toInt = (value: number) => value.toLocaleString();

const formatMonth = (month: string) => {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return month;
  const date = new Date(`${month}-01T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
};

const formatDate = (dateText: string) => {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return dateText;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const inferCurrencyFromAccount = (account: {
  currency_code?: string;
  account_name?: string;
}) => {
  const direct = String(account.currency_code || "").toUpperCase().trim();
  if (direct) return direct;

  const name = String(account.account_name || "");
  const matches = name.match(/[A-Z]{3}/g);
  if (!matches || matches.length === 0) return "";
  return matches[matches.length - 1];
};

const serializeFilters = (filters: FilterState) => {
  const params = new URLSearchParams();

  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (filters.minAmount) params.set("min_amount", filters.minAmount);
  if (filters.maxAmount) params.set("max_amount", filters.maxAmount);
  if (filters.search.trim()) params.set("search", filters.search.trim());

  if (filters.accountIds.length > 0) {
    params.set("account_ids", filters.accountIds.join(","));
  }
  if (filters.currencyIds.length > 0) {
    params.set("currency_ids", filters.currencyIds.join(","));
  }
  if (filters.paymentTypes.length > 0) {
    params.set("payment_types", filters.paymentTypes.join(","));
  }
  if (filters.transactionKinds.length > 0) {
    params.set("transaction_kinds", filters.transactionKinds.join(","));
  }
  if (filters.categoryIds.length > 0) {
    params.set("category_ids", filters.categoryIds.join(","));
  }
  if (filters.contactIds.length > 0) {
    params.set("contact_ids", filters.contactIds.join(","));
  }
  if (filters.projectIds.length > 0) {
    params.set("project_ids", filters.projectIds.join(","));
  }
  if (filters.departments.length > 0) {
    params.set("departments", filters.departments.join(","));
  }
  if (filters.loanStatuses.length > 0) {
    params.set("loan_statuses", filters.loanStatuses.join(","));
  }
  if (filters.payrollStatuses.length > 0) {
    params.set("payroll_statuses", filters.payrollStatuses.join(","));
  }

  params.set(
    "include_excluded_accounts",
    filters.includeExcludedAccounts ? "true" : "false",
  );
  params.set("top", "12");

  return params;
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-6 text-sm text-slate-500">
    {message}
  </div>
);

const Panel = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) => (
  <section className="rounded-2xl border border-cyan-900/30 bg-slate-950/70 p-5 shadow-[0_8px_30px_rgba(2,6,23,0.45)]">
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {subtitle ? <p className="text-sm text-slate-400 mt-1">{subtitle}</p> : null}
    </div>
    {children}
  </section>
);

const MetricCard = ({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) => (
  <article className="rounded-xl border border-cyan-900/25 bg-slate-950/85 p-4 shadow-[inset_0_1px_0_rgba(148,163,184,0.05)]">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-white md:text-[1.7rem]">{value}</p>
      </div>
      <div className="rounded-lg border border-cyan-900/40 bg-slate-900/80 p-2 text-cyan-200">
        {icon}
      </div>
    </div>
    <p className="mt-3 text-xs text-slate-400">{hint}</p>
  </article>
);

const MultiSelect = ({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: OptionValue[];
  value: string[];
  onChange: (next: string[]) => void;
}) => (
  <div>
    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
      {label}
    </label>
    <select
      multiple
      value={value}
      onChange={(event) => {
        const next = Array.from(event.target.selectedOptions).map((option) => option.value);
        onChange(next);
      }}
      className="scroll-thin h-28 w-full rounded-lg border border-cyan-900/35 bg-slate-950/90 px-3 py-2 text-sm text-slate-200 focus:border-cyan-400 focus:outline-none"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    <p className="mt-1 text-xs text-slate-500">{value.length} selected</p>
  </div>
);

const TrendChart = ({ points }: { points: Array<{ label: string; value: number }> }) => {
  if (points.length === 0) {
    return <EmptyState message="No trend data available for the selected filters." />;
  }

  const width = 720;
  const height = 240;
  const paddingX = 40;
  const paddingY = 24;

  const values = points.map((point) => point.value);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = maxValue - minValue || 1;

  const toX = (index: number) => {
    if (points.length === 1) return width / 2;
    const usableWidth = width - paddingX * 2;
    return paddingX + (index / (points.length - 1)) * usableWidth;
  };

  const toY = (value: number) => {
    const usableHeight = height - paddingY * 2;
    return paddingY + ((maxValue - value) / range) * usableHeight;
  };

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${toX(index)},${toY(point.value)}`)
    .join(" ");

  const baselineY = toY(0);

  return (
    <div className="space-y-3">
      <div className="h-64 w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
          <line
            x1={paddingX}
            y1={baselineY}
            x2={width - paddingX}
            y2={baselineY}
            stroke="#334155"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <path d={path} fill="none" stroke="#6366f1" strokeWidth={3} />
          {points.map((point, index) => (
            <circle
              key={`${point.label}-${index}`}
              cx={toX(index)}
              cy={toY(point.value)}
              r={3}
              fill="#818cf8"
            />
          ))}
        </svg>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs text-slate-500 sm:grid-cols-6">
        {points.slice(-6).map((point) => (
          <div key={point.label} className="truncate">
            <span className="text-slate-400">{point.label}</span>
            <div className="text-slate-300">{toMoney(point.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const HorizontalBars = ({
  items,
  labelKey,
  valueKey,
}: {
  items: Array<Record<string, string | number>>;
  labelKey: string;
  valueKey: string;
}) => {
  if (items.length === 0) {
    return <EmptyState message="No matching rows." />;
  }

  const maxValue = Math.max(
    ...items.map((item) => Math.abs(Number(item[valueKey] ?? 0))),
    1,
  );

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const label = String(item[labelKey] ?? "-");
        const value = Number(item[valueKey] ?? 0);
        const ratio = Math.min(100, (Math.abs(value) / maxValue) * 100);

        return (
          <div key={`${label}-${value}`}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="truncate text-slate-300">{label}</span>
              <span className="font-medium text-slate-100">{toMoney(value)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800">
              <div
                className={`h-2 rounded-full ${value >= 0 ? "bg-indigo-500" : "bg-rose-500"}`}
                style={{ width: `${Math.max(ratio, 2)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const PIE_COLORS = [
  "#22d3ee",
  "#818cf8",
  "#34d399",
  "#f59e0b",
  "#f472b6",
  "#fb7185",
  "#60a5fa",
  "#a78bfa",
  "#2dd4bf",
];

const ExpensePieChart = ({ data }: { data: CategoryPoint[] }) => {
  if (data.length === 0) {
    return <EmptyState message="No category expense rows." />;
  }

  const normalized = data
    .map((item) => ({
      ...item,
      value: Math.abs(Number(item.total || 0)),
    }))
    .filter((item) => item.value > 0);

  if (normalized.length === 0) {
    return <EmptyState message="No category expense rows." />;
  }

  const total = normalized.reduce((sum, item) => sum + item.value, 0);
  const radius = 56;
  const stroke = 20;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr] md:items-center">
      <div className="mx-auto h-[160px] w-[160px]">
        <svg viewBox="0 0 160 160" className="h-full w-full">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="#1e293b" strokeWidth={stroke} />
          {normalized.map((item, index) => {
            const ratio = item.value / total;
            const dash = ratio * circumference;
            const offset = -cumulative * circumference;
            cumulative += ratio;

            return (
              <circle
                key={`${item.category}-${index}`}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={PIE_COLORS[index % PIE_COLORS.length]}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
                transform="rotate(-90 80 80)"
              />
            );
          })}
          <text x="80" y="76" textAnchor="middle" className="fill-slate-400 text-[10px] uppercase tracking-wide">
            Total
          </text>
          <text x="80" y="94" textAnchor="middle" className="fill-slate-100 text-[12px] font-semibold">
            {toMoney(total)}
          </text>
        </svg>
      </div>

      <div className="scroll-surface scroll-thin max-h-[16rem] space-y-2 overflow-y-auto pr-2">
        {normalized.map((item, index) => {
          const share = (item.value / total) * 100;
          return (
            <div
              key={`${item.category}-${item.value}-${index}`}
              className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                  />
                  <span className="truncate text-sm text-slate-200">{item.category}</span>
                </div>
                <span className="text-xs text-slate-400">{share.toFixed(1)}%</span>
              </div>
              <div className="text-xs text-slate-400">{toMoney(item.value)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const DashboardPage = () => {
  const [report, setReport] = useState<DashboardData | null>(null);
  const [draftFilters, setDraftFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [isFilterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [targetCurrency, setTargetCurrency] = useState("PKR");
  const [usdRates, setUsdRates] = useState<Record<string, number> | null>(null);
  const [fxTimestamp, setFxTimestamp] = useState<string | null>(null);
  const [fxLoading, setFxLoading] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const params = serializeFilters(appliedFilters);
      const res = await api.get(`/reports/dashboard?${params.toString()}`);
      setReport((res.data?.data ?? null) as DashboardData | null);
    } catch (error) {
      console.error(error);
      setReport(null);
      setErrorMessage("Failed to load dashboard report.");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    void loadReport();
  }, [loadReport, refreshTick]);

  const loadFxRates = useCallback(async () => {
    setFxLoading(true);
    const urls = [
      "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
      "https://latest.currency-api.pages.dev/v1/currencies/usd.json",
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const data = await res.json();
        const rates = data?.usd;
        if (!rates || typeof rates !== "object") continue;

        setUsdRates(rates as Record<string, number>);
        setFxTimestamp(typeof data?.date === "string" ? data.date : null);
        setFxLoading(false);
        return;
      } catch (error) {
        console.error("Failed to fetch FX rates from", url, error);
      }
    }

    setUsdRates(null);
    setFxLoading(false);
  }, []);

  useEffect(() => {
    void loadFxRates();
  }, [loadFxRates]);

  const options = report?.options;

  const accountOptions = useMemo<OptionValue[]>(() => {
    return (options?.accounts ?? []).map((account) => {
      const suffix = account.currency?.code ? ` (${account.currency.code})` : "";
      return {
        value: String(account.id ?? ""),
        label: `${account.name}${suffix}`,
      };
    });
  }, [options?.accounts]);

  const currencyOptions = useMemo<OptionValue[]>(() => {
    return (options?.currencies ?? []).map((currency) => ({
      value: String(currency.id ?? ""),
      label: `${currency.code || currency.name}${currency.symbol ? ` (${currency.symbol})` : ""}`,
    }));
  }, [options?.currencies]);

  const categoryOptions = useMemo<OptionValue[]>(() => {
    return (options?.categories ?? []).map((category) => ({
      value: String(category.id ?? ""),
      label: category.name,
    }));
  }, [options?.categories]);

  const contactOptions = useMemo<OptionValue[]>(() => {
    return (options?.contacts ?? []).map((contact) => ({
      value: String(contact.id ?? ""),
      label: contact.department ? `${contact.name} (${contact.department})` : contact.name,
    }));
  }, [options?.contacts]);

  const projectOptions = useMemo<OptionValue[]>(() => {
    return (options?.projects ?? []).map((project) => ({
      value: String(project.id ?? ""),
      label: project.name,
    }));
  }, [options?.projects]);

  const paymentOptions = useMemo<OptionValue[]>(() => {
    return (options?.payment_types ?? []).map((entry) => ({
      value: entry,
      label: entry,
    }));
  }, [options?.payment_types]);

  const transactionKindOptions = useMemo<OptionValue[]>(() => {
    return (options?.transaction_kinds ?? []).map((entry) => ({
      value: entry,
      label: entry,
    }));
  }, [options?.transaction_kinds]);

  const departmentOptions = useMemo<OptionValue[]>(() => {
    return (options?.departments ?? []).map((entry) => ({
      value: entry,
      label: entry,
    }));
  }, [options?.departments]);

  const loanStatusOptions = useMemo<OptionValue[]>(() => {
    return (options?.loan_statuses ?? []).map((entry) => ({
      value: entry,
      label: entry,
    }));
  }, [options?.loan_statuses]);

  const payrollStatusOptions = useMemo<OptionValue[]>(() => {
    return (options?.payroll_statuses ?? []).map((entry) => ({
      value: entry,
      label: entry,
    }));
  }, [options?.payroll_statuses]);

  const dailyTrendPoints = useMemo(
    () =>
      (report?.series.daily_cashflow ?? []).map((point) => ({
        label: formatDate(point.date),
        value: point.net,
      })),
    [report?.series.daily_cashflow],
  );

  const hasData = Boolean(report);
  const pendingLoanTotal = useMemo(
    () =>
      (report?.series.loan_status_summary ?? [])
        .filter((entry) => entry.status !== "Paid Off")
        .reduce((sum, entry) => sum + entry.outstanding_total, 0),
    [report?.series.loan_status_summary],
  );
  const pendingLoanCount = useMemo(
    () =>
      (report?.series.loan_status_summary ?? [])
        .filter((entry) => entry.status !== "Paid Off")
        .reduce((sum, entry) => sum + entry.loan_count, 0),
    [report?.series.loan_status_summary],
  );

  const holdingsCurrencyOptions = useMemo(() => {
    const set = new Set<string>(["PKR"]);
    (report?.options.currencies ?? []).forEach((currency) => {
      const code = String(currency.code || "").toUpperCase().trim();
      if (code) set.add(code);
    });
    (report?.series.account_balances ?? []).forEach((account) => {
      const code = inferCurrencyFromAccount(account);
      if (code) set.add(code);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [report?.options.currencies, report?.series.account_balances]);

  const currencyMetaByCode = useMemo(() => {
    const map = new Map<string, { symbol: string; name: string }>();
    (report?.options.currencies ?? []).forEach((currency) => {
      const code = String(currency.code || "").toUpperCase().trim();
      if (!code) return;
      map.set(code, {
        symbol: String(currency.symbol || ""),
        name: String(currency.name || currency.code || ""),
      });
    });
    return map;
  }, [report?.options.currencies]);

  const holdingsSummary = useMemo(() => {
    const balances = (report?.series.account_balances ?? []).filter(
      (entry) => !entry.excluded_from_statistics,
    );
    if (balances.length === 0) {
      return { total: 0, convertedCount: 0, missingCount: 0 };
    }

    const target = targetCurrency.toLowerCase();
    const rates = usdRates;
    let total = 0;
    let convertedCount = 0;
    let missingCount = 0;

    balances.forEach((entry) => {
      const amount = Number(entry.balance || 0);
      const from = inferCurrencyFromAccount(entry).toLowerCase();
      if (!Number.isFinite(amount) || !from) {
        missingCount += 1;
        return;
      }

      if (from === target) {
        total += amount;
        convertedCount += 1;
        return;
      }

      if (!rates) {
        missingCount += 1;
        return;
      }

      const fromRate = from === "usd" ? 1 : Number(rates[from]);
      const targetRate = target === "usd" ? 1 : Number(rates[target]);
      if (!Number.isFinite(fromRate) || fromRate <= 0 || !Number.isFinite(targetRate) || targetRate <= 0) {
        missingCount += 1;
        return;
      }

      const usdAmount = amount / fromRate;
      total += usdAmount * targetRate;
      convertedCount += 1;
    });

    return {
      total,
      convertedCount,
      missingCount,
    };
  }, [report?.series.account_balances, targetCurrency, usdRates]);
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (appliedFilters.dateFrom) count += 1;
    if (appliedFilters.dateTo) count += 1;
    if (appliedFilters.minAmount) count += 1;
    if (appliedFilters.maxAmount) count += 1;
    if (appliedFilters.search.trim()) count += 1;
    if (appliedFilters.includeExcludedAccounts) count += 1;
    count += appliedFilters.accountIds.length > 0 ? 1 : 0;
    count += appliedFilters.currencyIds.length > 0 ? 1 : 0;
    count += appliedFilters.paymentTypes.length > 0 ? 1 : 0;
    count += appliedFilters.transactionKinds.length > 0 ? 1 : 0;
    count += appliedFilters.categoryIds.length > 0 ? 1 : 0;
    count += appliedFilters.contactIds.length > 0 ? 1 : 0;
    count += appliedFilters.projectIds.length > 0 ? 1 : 0;
    count += appliedFilters.departments.length > 0 ? 1 : 0;
    count += appliedFilters.loanStatuses.length > 0 ? 1 : 0;
    count += appliedFilters.payrollStatuses.length > 0 ? 1 : 0;
    return count;
  }, [appliedFilters]);

  return (
    <div className="space-y-6 text-slate-200">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white md:text-4xl">Financial Dashboard</h1>
          <p className="mt-1 text-slate-400">
            Comprehensive reporting across ledger, payroll, loans, accounts, contacts,
            categories, projects, and currencies.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRefreshTick((prev) => prev + 1)}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-900/40 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setDraftFilters(EMPTY_FILTERS);
              setAppliedFilters(EMPTY_FILTERS);
              setFilterDrawerOpen(false);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-900/40 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            Clear Filters
          </button>
          <button
            type="button"
            onClick={() => setFilterDrawerOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
          >
            <Filter size={16} /> Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
          </button>
        </div>
      </div>

      {isFilterDrawerOpen ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            aria-label="Close filter drawer"
            onClick={() => setFilterDrawerOpen(false)}
          />
          <aside className="scroll-surface scroll-thin absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto border-l border-cyan-900/40 bg-slate-950 p-5 md:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Global Filters</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Filter by bank accounts, date range, value range, entities, and dimensions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFilterDrawerOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-900/40 bg-slate-900 text-slate-200 hover:bg-slate-800"
                aria-label="Close filter drawer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Date From
            </label>
            <input
              type="date"
              value={draftFilters.dateFrom}
              onChange={(event) =>
                setDraftFilters((prev) => ({ ...prev, dateFrom: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Date To
            </label>
            <input
              type="date"
              value={draftFilters.dateTo}
              onChange={(event) =>
                setDraftFilters((prev) => ({ ...prev, dateTo: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Min Amount
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={draftFilters.minAmount}
              onChange={(event) =>
                setDraftFilters((prev) => ({ ...prev, minAmount: event.target.value }))
              }
              className="w-full rounded-lg border border-cyan-900/35 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-cyan-400 focus:outline-none"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Max Amount
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={draftFilters.maxAmount}
              onChange={(event) =>
                setDraftFilters((prev) => ({ ...prev, maxAmount: event.target.value }))
              }
              className="w-full rounded-lg border border-cyan-900/35 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-cyan-400 focus:outline-none"
              placeholder="10000.00"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Search
            </label>
            <input
              type="text"
              value={draftFilters.search}
              onChange={(event) =>
                setDraftFilters((prev) => ({ ...prev, search: event.target.value }))
              }
              className="w-full rounded-lg border border-cyan-900/35 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-cyan-400 focus:outline-none"
              placeholder="note, contact, category..."
            />
          </div>
        </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <MultiSelect
            label="Bank Accounts"
            options={accountOptions}
            value={draftFilters.accountIds}
            onChange={(next) => setDraftFilters((prev) => ({ ...prev, accountIds: next }))}
          />
          <MultiSelect
            label="Currencies"
            options={currencyOptions}
            value={draftFilters.currencyIds}
            onChange={(next) => setDraftFilters((prev) => ({ ...prev, currencyIds: next }))}
          />
          <MultiSelect
            label="Categories"
            options={categoryOptions}
            value={draftFilters.categoryIds}
            onChange={(next) => setDraftFilters((prev) => ({ ...prev, categoryIds: next }))}
          />
          <MultiSelect
            label="Contacts"
            options={contactOptions}
            value={draftFilters.contactIds}
            onChange={(next) => setDraftFilters((prev) => ({ ...prev, contactIds: next }))}
          />
          <MultiSelect
            label="Projects"
            options={projectOptions}
            value={draftFilters.projectIds}
            onChange={(next) => setDraftFilters((prev) => ({ ...prev, projectIds: next }))}
          />
          <MultiSelect
            label="Payment Types"
            options={paymentOptions}
            value={draftFilters.paymentTypes}
            onChange={(next) => setDraftFilters((prev) => ({ ...prev, paymentTypes: next }))}
          />
          <MultiSelect
            label="Transaction Kinds"
            options={transactionKindOptions}
            value={draftFilters.transactionKinds}
            onChange={(next) =>
              setDraftFilters((prev) => ({ ...prev, transactionKinds: next }))
            }
          />
          <MultiSelect
            label="Departments"
            options={departmentOptions}
            value={draftFilters.departments}
            onChange={(next) => setDraftFilters((prev) => ({ ...prev, departments: next }))}
          />
          <MultiSelect
            label="Loan Status"
            options={loanStatusOptions}
            value={draftFilters.loanStatuses}
            onChange={(next) => setDraftFilters((prev) => ({ ...prev, loanStatuses: next }))}
          />
          <MultiSelect
            label="Payroll Status"
            options={payrollStatusOptions}
            value={draftFilters.payrollStatuses}
            onChange={(next) =>
              setDraftFilters((prev) => ({ ...prev, payrollStatuses: next }))
            }
          />

          <div className="rounded-lg border border-cyan-900/35 bg-slate-950 px-4 py-3 text-sm text-slate-300">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={draftFilters.includeExcludedAccounts}
                onChange={(event) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    includeExcludedAccounts: event.target.checked,
                  }))
                }
                className="mt-0.5"
              />
              <span>
                Include accounts excluded from statistics
                <span className="mt-1 block text-xs text-slate-500">
                  Toggle this when you want reports to include bookkeeping-only accounts.
                </span>
              </span>
            </label>
          </div>
            </div>

            <div className="sticky bottom-0 mt-6 border-t border-cyan-900/30 bg-slate-950/95 pt-4">
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDraftFilters(EMPTY_FILTERS)}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-900/40 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
                >
                  Reset Draft
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedFilters(draftFilters);
                    setFilterDrawerOpen(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
                >
                  <Filter size={16} /> Apply Filters
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-xl border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
          {errorMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-cyan-900/30 bg-slate-900/50 p-6 text-sm text-slate-400">
          Loading dashboard report...
        </div>
      ) : null}

      {!loading && !hasData ? (
        <EmptyState message="No report data returned from API." />
      ) : null}

      {!loading && hasData && report ? (
        <>
          <div className="rounded-xl border border-amber-800/60 bg-amber-950/30 px-4 py-3 text-xs text-amber-200">
            Totals combine values from multiple currencies without FX conversion. Use the
            currency breakdown panel for exact per-currency visibility.
          </div>

          <div className="rounded-xl border border-cyan-900/30 bg-slate-950/80 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Total Holdings (Live FX)
                </p>
                <p className="mt-1 text-3xl font-semibold text-white">
                  {(currencyMetaByCode.get(targetCurrency)?.symbol || `${targetCurrency} `) +
                    toMoney(holdingsSummary.total)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {holdingsSummary.convertedCount} accounts converted
                  {holdingsSummary.missingCount > 0
                    ? ` • ${holdingsSummary.missingCount} missing rates`
                    : ""}
                  {fxTimestamp ? ` • FX as of ${fxTimestamp}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs uppercase tracking-wide text-slate-500">
                  Currency
                </label>
                <select
                  value={targetCurrency}
                  onChange={(event) => setTargetCurrency(event.target.value)}
                  className="rounded-lg border border-cyan-900/35 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-cyan-400 focus:outline-none"
                >
                  {holdingsCurrencyOptions.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void loadFxRates()}
                  className="rounded-lg border border-cyan-900/35 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
                  title="Refresh live FX rates"
                >
                  Refresh FX
                </button>
              </div>
            </div>
            {fxLoading ? (
              <p className="mt-2 text-xs text-slate-500">Updating live FX rates...</p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={<BarChart3 size={18} />}
              label="Transactions"
              value={toInt(report.totals.transaction_count)}
              hint={`Avg amount ${toMoney(report.totals.average_transaction_amount)}`}
            />
            <MetricCard
              icon={<TrendingUp size={18} />}
              label="Income"
              value={toMoney(report.totals.income_total)}
              hint="Filtered ledger income"
            />
            <MetricCard
              icon={<TrendingDown size={18} />}
              label="Expense"
              value={toMoney(report.totals.expense_total)}
              hint="Filtered ledger expense"
            />
            <MetricCard
              icon={<Wallet size={18} />}
              label="Net"
              value={toMoney(report.totals.net_total)}
              hint="Income minus expense"
            />
            <MetricCard
              icon={<ArrowLeftRight size={18} />}
              label="Transfer In"
              value={toMoney(report.totals.transfer_in_total)}
              hint="Incoming account transfers"
            />
            <MetricCard
              icon={<ArrowLeftRight size={18} />}
              label="Transfer Out"
              value={toMoney(report.totals.transfer_out_total)}
              hint="Outgoing account transfers"
            />
            <MetricCard
              icon={<CalendarCheck2 size={18} />}
              label="Payroll Net"
              value={toMoney(report.totals.payroll_net_total)}
              hint={`${toInt(report.totals.payroll_employee_count)} employees in filtered payroll`}
            />
            <MetricCard
              icon={<Coins size={18} />}
              label="Loan Outstanding"
              value={toMoney(report.totals.loan_outstanding_total)}
              hint={`${toInt(report.totals.active_loans)} active, ${toInt(report.totals.paid_off_loans)} paid off`}
            />
            <MetricCard
              icon={<Clock3 size={18} />}
              label="Pending Loans Amount"
              value={toMoney(pendingLoanTotal)}
              hint={`${toInt(pendingLoanCount)} unpaid loans (active/defaulted)`}
            />
            <MetricCard
              icon={<Building2 size={18} />}
              label="Payroll Gross"
              value={toMoney(report.totals.payroll_gross_total)}
              hint="Total gross for filtered payroll slips"
            />
            <MetricCard
              icon={<Users size={18} />}
              label="Payroll Loan Deduction"
              value={toMoney(report.totals.payroll_loan_deduction_total)}
              hint="Loan repayments recovered via payroll"
            />
            <MetricCard
              icon={<Briefcase size={18} />}
              label="Defaulted Loans"
              value={toInt(report.totals.defaulted_loans)}
              hint="Loan status = Defaulted"
            />
            <MetricCard
              icon={<Coins size={18} />}
              label="Active Loans"
              value={toInt(report.totals.active_loans)}
              hint="Loan status = Active"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Panel
              title="Daily Net Cashflow"
              subtitle="Net movement trend after applying all active filters."
            >
              <TrendChart points={dailyTrendPoints} />
            </Panel>

            <Panel
              title="Monthly Income vs Expense"
              subtitle="Compare monthly totals and net performance."
            >
              {report.series.monthly_cashflow.length === 0 ? (
                <EmptyState message="No monthly cashflow data for the selected filters." />
              ) : (
                <div className="scroll-surface scroll-thin max-h-[34rem] space-y-3 overflow-y-auto pr-2">
                  {report.series.monthly_cashflow.map((row) => {
                    const largest = Math.max(
                      Math.abs(row.income),
                      Math.abs(row.expense),
                      Math.abs(row.net),
                      1,
                    );

                    return (
                      <div key={row.month} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-200">{formatMonth(row.month)}</span>
                          <span className="text-slate-400">{row.transaction_count} tx</span>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div>
                            <div className="mb-1 flex justify-between text-slate-300">
                              <span>Income</span>
                              <span>{toMoney(row.income)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-800">
                              <div
                                className="h-2 rounded-full bg-emerald-500"
                                style={{ width: `${(Math.abs(row.income) / largest) * 100}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="mb-1 flex justify-between text-slate-300">
                              <span>Expense</span>
                              <span>{toMoney(row.expense)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-800">
                              <div
                                className="h-2 rounded-full bg-rose-500"
                                style={{ width: `${(Math.abs(row.expense) / largest) * 100}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="mb-1 flex justify-between text-slate-300">
                              <span>Net</span>
                              <span className={row.net >= 0 ? "text-emerald-300" : "text-rose-300"}>
                                {toMoney(row.net)}
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-800">
                              <div
                                className={`h-2 rounded-full ${row.net >= 0 ? "bg-indigo-500" : "bg-rose-500"}`}
                                style={{ width: `${(Math.abs(row.net) / largest) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Panel title="Expense by Category">
              <ExpensePieChart data={report.series.expense_by_category} />
            </Panel>

            <Panel title="Income by Category">
              <HorizontalBars
                items={report.series.income_by_category.map((entry) => ({
                  label: entry.category,
                  value: entry.total,
                }))}
                labelKey="label"
                valueKey="value"
              />
            </Panel>

            <Panel title="Payment Type Distribution">
              <HorizontalBars
                items={report.series.payment_breakdown.map((entry) => ({
                  label: `${entry.payment_type} (${entry.count})`,
                  value: entry.total,
                }))}
                labelKey="label"
                valueKey="value"
              />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Panel
              title="Account Movement"
              subtitle="Bank account-level inflow, outflow, transfer, and net movement."
            >
              {report.series.account_movement.length === 0 ? (
                <EmptyState message="No account movement found." />
              ) : (
                <div className="scroll-surface scroll-thin overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-2 pr-3">Account</th>
                        <th className="py-2 pr-3">Income</th>
                        <th className="py-2 pr-3">Expense</th>
                        <th className="py-2 pr-3">Transfer In</th>
                        <th className="py-2 pr-3">Transfer Out</th>
                        <th className="py-2 pr-3">Net</th>
                        <th className="py-2">Tx</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.series.account_movement.map((entry) => (
                        <tr key={`${entry.account_id}-${entry.account_document_id}`} className="border-b border-slate-900">
                          <td className="py-2 pr-3">
                            <div className="font-medium text-slate-200">{entry.account_name}</div>
                            <div className="text-xs text-slate-500">
                              {entry.currency_code || "No currency"}
                              {entry.excluded_from_statistics ? " • excluded" : ""}
                            </div>
                          </td>
                          <td className="py-2 pr-3 text-emerald-300">{toMoney(entry.income)}</td>
                          <td className="py-2 pr-3 text-rose-300">{toMoney(entry.expense)}</td>
                          <td className="py-2 pr-3 text-indigo-300">{toMoney(entry.transfer_in)}</td>
                          <td className="py-2 pr-3 text-indigo-300">{toMoney(entry.transfer_out)}</td>
                          <td className={`py-2 pr-3 font-semibold ${entry.net >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                            {toMoney(entry.net)}
                          </td>
                          <td className="py-2 text-slate-300">{toInt(entry.transaction_count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel
              title="Currency Breakdown"
              subtitle="Per-currency movement without FX conversion."
            >
              {report.series.currency_breakdown.length === 0 ? (
                <EmptyState message="No currency movement found." />
              ) : (
                <div className="scroll-surface scroll-thin max-h-[28rem] space-y-3 overflow-y-auto pr-2">
                  {report.series.currency_breakdown.map((entry) => (
                    <div
                      key={`${entry.currency_id ?? "none"}-${entry.code}-${entry.symbol}`}
                      className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-200">
                          {entry.code || entry.name || "Unknown"}
                          {entry.symbol ? ` (${entry.symbol})` : ""}
                        </span>
                        <span className="text-xs text-slate-500">{entry.transaction_count} tx</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <div>
                          <p className="text-slate-500">Income</p>
                          <p className="text-emerald-300">{toMoney(entry.income)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Expense</p>
                          <p className="text-rose-300">{toMoney(entry.expense)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Transfer In</p>
                          <p className="text-indigo-300">{toMoney(entry.transfer_in)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Net</p>
                          <p className={entry.net >= 0 ? "text-emerald-300" : "text-rose-300"}>
                            {toMoney(entry.net)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Panel title="Top Contacts" subtitle="Contacts with the biggest absolute net movement.">
              {report.series.top_contacts.length === 0 ? (
                <EmptyState message="No contact data in this filter scope." />
              ) : (
                <div className="scroll-surface scroll-thin max-h-[24rem] space-y-2 overflow-y-auto pr-2">
                  {report.series.top_contacts.map((entry) => (
                    <div
                      key={`${entry.contact_id ?? "none"}-${entry.contact_document_id ?? "none"}`}
                      className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-200">{entry.contact_name}</p>
                          <p className="text-xs text-slate-500">{entry.transaction_count} transactions</p>
                        </div>
                        <p className={`text-sm font-semibold ${entry.net >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                          {toMoney(entry.net)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Top Projects" subtitle="Project-level contribution across transactions.">
              {report.series.top_projects.length === 0 ? (
                <EmptyState message="No project data in this filter scope." />
              ) : (
                <div className="scroll-surface scroll-thin max-h-[24rem] space-y-2 overflow-y-auto pr-2">
                  {report.series.top_projects.map((entry) => (
                    <div
                      key={`${entry.project_id ?? "none"}-${entry.project_document_id ?? "none"}`}
                      className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-200">{entry.project_name}</p>
                          <p className="text-xs text-slate-500">{entry.transaction_count} transactions</p>
                        </div>
                        <p className={`text-sm font-semibold ${entry.net >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                          {toMoney(entry.net)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Panel
              title="Payroll Monthly Rollup"
              subtitle="Gross, net, and loan deductions per payroll month."
            >
              {report.series.payroll_by_month.length === 0 ? (
                <EmptyState message="No payroll rows for the selected filters." />
              ) : (
                <div className="scroll-surface scroll-thin max-h-[28rem] space-y-3 overflow-y-auto pr-2">
                  {report.series.payroll_by_month.map((entry) => {
                    const largest = Math.max(entry.gross, entry.net, entry.loan_deduction, 1);

                    return (
                      <div key={entry.month} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-200">{formatMonth(entry.month)}</span>
                          <span className="text-slate-500">
                            {entry.employee_count} employees • {entry.batch_count} batches
                          </span>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div>
                            <div className="mb-1 flex justify-between text-slate-300">
                              <span>Gross</span>
                              <span>{toMoney(entry.gross)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-800">
                              <div
                                className="h-2 rounded-full bg-indigo-500"
                                style={{ width: `${(entry.gross / largest) * 100}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="mb-1 flex justify-between text-slate-300">
                              <span>Net</span>
                              <span>{toMoney(entry.net)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-800">
                              <div
                                className="h-2 rounded-full bg-emerald-500"
                                style={{ width: `${(entry.net / largest) * 100}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="mb-1 flex justify-between text-slate-300">
                              <span>Loan Deduction</span>
                              <span>{toMoney(entry.loan_deduction)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-800">
                              <div
                                className="h-2 rounded-full bg-amber-500"
                                style={{ width: `${(entry.loan_deduction / largest) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel title="Loan Portfolio" subtitle="Outstanding and status split for all filtered loans.">
              {report.series.loan_status_summary.length === 0 ? (
                <EmptyState message="No loan rows for the selected filters." />
              ) : (
                <div className="scroll-surface scroll-thin max-h-[28rem] space-y-3 overflow-y-auto pr-2">
                  {report.series.loan_status_summary.map((entry) => (
                    <div key={entry.status} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="font-medium text-slate-200">{entry.status}</p>
                        <p className="text-sm text-slate-400">{entry.loan_count} loans</p>
                      </div>
                      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                        <div>
                          <p className="text-slate-500">Outstanding</p>
                          <p className="text-slate-200">{toMoney(entry.outstanding_total)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Total Principal</p>
                          <p className="text-slate-200">{toMoney(entry.total_amount)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Monthly Installment</p>
                          <p className="text-slate-200">{toMoney(entry.monthly_installment_total)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <div className="text-xs text-slate-500">
            Last generated: {new Date(report.generated_at).toLocaleString()}
          </div>
        </>
      ) : null}
    </div>
  );
};
