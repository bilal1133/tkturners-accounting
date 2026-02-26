import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
  Banknote,
  CreditCard,
  Plus,
  CheckCircle,
  Clock,
  Pencil,
  RefreshCw,
  AlertTriangle,
  Trash2,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { LoanModal } from "../components/LoanModal";
import { currencySymbol } from "../lib/currency";

type PayrollSummary = {
  id: number;
  documentId: string;
  pay_period_start: string;
  pay_period_end: string;
  pay_date: string;
  payroll_status: "draft" | "processed";
  ledger_synced?: boolean;
  total_employees?: number;
  total_net_pay?: number;
  totals_by_currency?: Array<{
    symbol?: string;
    total_net?: number;
    employee_count?: number;
  }>;
};

type LoanRecord = {
  id: number;
  status?: string;
  total_amount?: number | string;
  remaining_balance?: number | string;
  monthly_installment?: number | string;
  employee?: {
    name?: string;
    currency?: any;
  } | null;
  disbursement_transaction?: {
    contact?: {
      name?: string;
      contact_type?: any[];
    } | null;
  } | null;
};

type LoanView = {
  loan: LoanRecord;
  employeeName: string;
  symbol: string;
  total: number;
  remaining: number;
  monthly: number;
  percentPaid: number;
  status: string;
  searchableText: string;
};

const formatAmount = (amount: number) =>
  amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const toNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseDate = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const getTotalNetPay = (batch: PayrollSummary) => {
  const totals = batch.totals_by_currency || [];
  if (totals.length > 0) {
    return totals.reduce((sum, entry) => sum + toNumber(entry.total_net), 0);
  }
  return toNumber(batch.total_net_pay);
};

const getLoanView = (loan: LoanRecord): LoanView => {
  const fallbackContact = loan.disbursement_transaction?.contact || null;
  const fallbackEmployeeCurrency = fallbackContact?.contact_type?.find(
    (entry: any) => entry.__component === "contact-type.employee",
  )?.currency;

  const employeeName = loan.employee?.name || fallbackContact?.name || "Unknown";
  const symbol =
    currencySymbol(loan.employee?.currency) || currencySymbol(fallbackEmployeeCurrency);

  const total = toNumber(loan.total_amount);
  const remaining = toNumber(loan.remaining_balance);
  const monthly = toNumber(loan.monthly_installment);
  const percentPaid = total > 0 ? ((total - remaining) / total) * 100 : 0;
  const status = String(loan.status || "Active");

  return {
    loan,
    employeeName,
    symbol,
    total,
    remaining,
    monthly,
    percentPaid,
    status,
    searchableText: `${employeeName} ${status}`.toLowerCase(),
  };
};

export const PayrollPage = () => {
  const navigate = useNavigate();
  const [payrolls, setPayrolls] = useState<PayrollSummary[]>([]);
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingBatchId, setDeletingBatchId] = useState<string | number | null>(null);

  const [payrollSearch, setPayrollSearch] = useState("");
  const [payrollStatusFilter, setPayrollStatusFilter] = useState("all");
  const [payrollLedgerFilter, setPayrollLedgerFilter] = useState("all");
  const [payrollDateFrom, setPayrollDateFrom] = useState("");
  const [payrollDateTo, setPayrollDateTo] = useState("");
  const [payrollMinNet, setPayrollMinNet] = useState("");
  const [payrollMaxNet, setPayrollMaxNet] = useState("");

  const [loanSearch, setLoanSearch] = useState("");
  const [loanStatusFilter, setLoanStatusFilter] = useState("all");
  const [loanMinRemaining, setLoanMinRemaining] = useState("");
  const [loanMaxRemaining, setLoanMaxRemaining] = useState("");
  const [loanMinMonthly, setLoanMinMonthly] = useState("");
  const [loanMaxMonthly, setLoanMaxMonthly] = useState("");

  const [isLoanModalOpen, setLoanModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [loanModalMode, setLoanModalMode] = useState<"issue" | "edit" | "repay">("issue");

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [payRes, loanRes] = await Promise.all([
        api.get("/payrolls"),
        api.get(
          "/loans?populate[0]=disbursement_transaction&populate[1]=disbursement_transaction.contact&populate[2]=disbursement_transaction.contact.contact_type&populate[3]=disbursement_transaction.contact.contact_type.currency",
        ),
      ]);
      setPayrolls((payRes.data?.data || []) as PayrollSummary[]);
      setLoans((loanRes.data?.data || []) as LoanRecord[]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === "processed" || status === "Paid Off") {
      return <CheckCircle size={16} className="text-emerald-500" />;
    }
    return <Clock size={16} className="text-amber-500" />;
  };

  const sortedPayrolls = useMemo(
    () =>
      [...payrolls].sort(
        (left, right) =>
          new Date(right.pay_period_start).getTime() -
          new Date(left.pay_period_start).getTime(),
      ),
    [payrolls],
  );

  const filteredPayrolls = useMemo(() => {
    const search = payrollSearch.trim().toLowerCase();
    const minNet = payrollMinNet.trim() ? toNumber(payrollMinNet) : null;
    const maxNet = payrollMaxNet.trim() ? toNumber(payrollMaxNet) : null;
    const dateFrom = parseDate(payrollDateFrom);
    const dateTo = parseDate(payrollDateTo);

    return sortedPayrolls.filter((batch) => {
      if (payrollStatusFilter !== "all" && batch.payroll_status !== payrollStatusFilter) {
        return false;
      }

      if (payrollLedgerFilter === "synced" && batch.ledger_synced === false) {
        return false;
      }

      if (payrollLedgerFilter === "unsynced" && batch.ledger_synced !== false) {
        return false;
      }

      const payDate = parseDate(batch.pay_date);
      if (dateFrom && (!payDate || payDate < dateFrom)) {
        return false;
      }
      if (dateTo && (!payDate || payDate > dateTo)) {
        return false;
      }

      const net = getTotalNetPay(batch);
      if (minNet !== null && net < minNet) {
        return false;
      }
      if (maxNet !== null && net > maxNet) {
        return false;
      }

      if (search) {
        const haystack = [
          `Payroll Batch ${batch.id}`,
          batch.payroll_status,
          batch.pay_period_start,
          batch.pay_period_end,
          batch.pay_date,
          String(batch.total_employees || ""),
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(search)) {
          return false;
        }
      }

      return true;
    });
  }, [
    sortedPayrolls,
    payrollSearch,
    payrollStatusFilter,
    payrollLedgerFilter,
    payrollDateFrom,
    payrollDateTo,
    payrollMinNet,
    payrollMaxNet,
  ]);

  const loanViews = useMemo(() => loans.map((loan) => getLoanView(loan)), [loans]);

  const filteredLoanViews = useMemo(() => {
    const search = loanSearch.trim().toLowerCase();
    const minRemaining = loanMinRemaining.trim() ? toNumber(loanMinRemaining) : null;
    const maxRemaining = loanMaxRemaining.trim() ? toNumber(loanMaxRemaining) : null;
    const minMonthly = loanMinMonthly.trim() ? toNumber(loanMinMonthly) : null;
    const maxMonthly = loanMaxMonthly.trim() ? toNumber(loanMaxMonthly) : null;

    return [...loanViews]
      .filter((entry) => {
        if (loanStatusFilter !== "all" && entry.status !== loanStatusFilter) {
          return false;
        }

        if (minRemaining !== null && entry.remaining < minRemaining) {
          return false;
        }

        if (maxRemaining !== null && entry.remaining > maxRemaining) {
          return false;
        }

        if (minMonthly !== null && entry.monthly < minMonthly) {
          return false;
        }

        if (maxMonthly !== null && entry.monthly > maxMonthly) {
          return false;
        }

        if (search && !entry.searchableText.includes(search)) {
          return false;
        }

        return true;
      })
      .sort((left, right) => right.remaining - left.remaining);
  }, [
    loanViews,
    loanSearch,
    loanStatusFilter,
    loanMinRemaining,
    loanMaxRemaining,
    loanMinMonthly,
    loanMaxMonthly,
  ]);

  const deleteDraftBatch = async (batch: PayrollSummary) => {
    const targetId = batch.documentId || batch.id;
    if (!targetId || batch.payroll_status !== "draft") return;

    const confirmed = window.confirm(
      `Delete draft payroll batch #${batch.id}? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingBatchId(targetId);
    try {
      await api.delete(`/payrolls/${targetId}`);
      await loadData();
    } catch (error: any) {
      console.error(error);
      alert(error?.response?.data?.error?.message || "Failed to delete payroll batch.");
    } finally {
      setDeletingBatchId(null);
    }
  };

  const resetPayrollFilters = () => {
    setPayrollSearch("");
    setPayrollStatusFilter("all");
    setPayrollLedgerFilter("all");
    setPayrollDateFrom("");
    setPayrollDateTo("");
    setPayrollMinNet("");
    setPayrollMaxNet("");
  };

  const resetLoanFilters = () => {
    setLoanSearch("");
    setLoanStatusFilter("all");
    setLoanMinRemaining("");
    setLoanMaxRemaining("");
    setLoanMinMonthly("");
    setLoanMaxMonthly("");
  };

  const loanStatuses = useMemo(() => {
    const statusSet = new Set(loanViews.map((entry) => entry.status));
    return Array.from(statusSet).sort();
  }, [loanViews]);

  return (
    <div className="space-y-8 text-slate-200">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Payroll & Loans</h1>
          <p className="text-slate-400 mt-1">
            Manage payroll batches, processing state, and employee loans.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Banknote size={18} className="text-blue-400" />
              Payroll Batches
            </h2>
            <button
              onClick={() => navigate("/payrolls/generate")}
              className="text-sm bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-md flex items-center gap-1 font-medium text-white transition-colors"
            >
              <Plus size={16} /> Create Draft
            </button>
          </div>

          <div className="p-4 border-b border-slate-800 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative sm:col-span-2">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  value={payrollSearch}
                  onChange={(event) => setPayrollSearch(event.target.value)}
                  placeholder="Search by batch id, date, status..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-9 pr-3 text-sm text-slate-200 outline-none transition-colors focus:border-indigo-500"
                />
              </div>

              <select
                value={payrollStatusFilter}
                onChange={(event) => setPayrollStatusFilter(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="processed">Processed</option>
              </select>

              <select
                value={payrollLedgerFilter}
                onChange={(event) => setPayrollLedgerFilter(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
              >
                <option value="all">All Ledger States</option>
                <option value="synced">Ledger Synced</option>
                <option value="unsynced">Ledger Unsynced</option>
              </select>

              <input
                type="date"
                value={payrollDateFrom}
                onChange={(event) => setPayrollDateFrom(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
              />
              <input
                type="date"
                value={payrollDateTo}
                onChange={(event) => setPayrollDateTo(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
              />

              <input
                type="number"
                min="0"
                step="0.01"
                value={payrollMinNet}
                onChange={(event) => setPayrollMinNet(event.target.value)}
                placeholder="Min net pay"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={payrollMaxNet}
                onChange={(event) => setPayrollMaxNet(event.target.value)}
                placeholder="Max net pay"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{filteredPayrolls.length} payroll batch(es)</span>
              <button
                onClick={resetPayrollFilters}
                className="text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Reset payroll filters
              </button>
            </div>
          </div>

          <div className="p-4 flex-1">
            {loading ? (
              <p className="text-slate-500">Loading...</p>
            ) : filteredPayrolls.length === 0 ? (
              <p className="text-slate-500">No payroll batches match the current filters.</p>
            ) : (
              <div className="space-y-3 max-h-[68vh] overflow-y-auto pr-1">
                {filteredPayrolls.map((batch) => {
                  const totals = batch.totals_by_currency || [];
                  const totalEmployees = batch.total_employees || 0;

                  return (
                    <div
                      key={batch.documentId || batch.id}
                      className="p-4 rounded-lg bg-slate-800/50 border border-slate-800 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-3 gap-2">
                        <div>
                          <h3 className="font-semibold text-slate-200">Payroll Batch #{batch.id}</h3>
                          <p className="text-xs text-slate-500 mt-1">
                            {format(new Date(batch.pay_period_start), "MMM dd")} -{" "}
                            {format(new Date(batch.pay_period_end), "MMM dd, yyyy")}
                          </p>
                          {batch.pay_date && (
                            <p className="text-xs text-slate-500 mt-1">
                              Pay Date: {format(new Date(batch.pay_date), "MMM dd, yyyy")}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-slate-800 font-medium border border-slate-700">
                            {getStatusIcon(batch.payroll_status)}
                            <span className="capitalize">{batch.payroll_status || "draft"}</span>
                          </span>
                          {batch.ledger_synced === false && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-400">
                              <AlertTriangle size={12} /> Ledger not synced
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-slate-400">Total Employees:</div>
                        <div className="text-right font-mono text-slate-300">{totalEmployees}</div>

                        <div className="col-span-2 my-1 border-t border-slate-700/50"></div>

                        {totals.length === 0 ? (
                          <>
                            <div className="font-medium text-slate-200">Total Net Pay:</div>
                            <div className="text-right font-bold text-indigo-400 font-mono text-lg">
                              {formatAmount(toNumber(batch.total_net_pay))}
                            </div>
                          </>
                        ) : (
                          totals.map((entry, index) => (
                            <div key={`row-${batch.id}-${index}`} className="contents">
                              <div className="font-medium text-slate-200">Net Pay ({entry.symbol || ""})</div>
                              <div className="text-right font-bold text-indigo-400 font-mono">
                                {entry.symbol || ""}
                                {formatAmount(toNumber(entry.total_net))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="mt-4 flex justify-end">
                        <div className="flex items-center gap-2">
                          {batch.payroll_status === "draft" && (
                            <button
                              onClick={() => void deleteDraftBatch(batch)}
                              disabled={deletingBatchId === (batch.documentId || batch.id)}
                              className="text-xs bg-red-950/40 hover:bg-red-900/40 border border-red-900/40 px-3 py-1.5 rounded-md text-red-300 transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                            >
                              <Trash2 size={12} />
                              {deletingBatchId === (batch.documentId || batch.id)
                                ? "Deleting..."
                                : "Delete Draft"}
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/payrolls/${batch.documentId || batch.id}`)}
                            className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-md text-slate-300 transition-colors"
                          >
                            View / Edit Payslips
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CreditCard size={18} className="text-purple-400" />
              Loans
            </h2>
            <button
              onClick={() => {
                setSelectedLoan(null);
                setLoanModalMode("issue");
                setLoanModalOpen(true);
              }}
              className="text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-md flex items-center gap-1"
            >
              <Plus size={16} /> Disburse Loan
            </button>
          </div>

          <div className="p-4 border-b border-slate-800 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative sm:col-span-2">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  value={loanSearch}
                  onChange={(event) => setLoanSearch(event.target.value)}
                  placeholder="Search by employee or status..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-9 pr-3 text-sm text-slate-200 outline-none transition-colors focus:border-indigo-500"
                />
              </div>

              <select
                value={loanStatusFilter}
                onChange={(event) => setLoanStatusFilter(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
              >
                <option value="all">All Statuses</option>
                {loanStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min="0"
                step="0.01"
                value={loanMinRemaining}
                onChange={(event) => setLoanMinRemaining(event.target.value)}
                placeholder="Min remaining"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
              />

              <input
                type="number"
                min="0"
                step="0.01"
                value={loanMaxRemaining}
                onChange={(event) => setLoanMaxRemaining(event.target.value)}
                placeholder="Max remaining"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
              />

              <input
                type="number"
                min="0"
                step="0.01"
                value={loanMinMonthly}
                onChange={(event) => setLoanMinMonthly(event.target.value)}
                placeholder="Min monthly"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
              />

              <input
                type="number"
                min="0"
                step="0.01"
                value={loanMaxMonthly}
                onChange={(event) => setLoanMaxMonthly(event.target.value)}
                placeholder="Max monthly"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{filteredLoanViews.length} loan(s)</span>
              <button
                onClick={resetLoanFilters}
                className="text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Reset loan filters
              </button>
            </div>
          </div>

          <div className="p-4 flex-1">
            {loading ? (
              <p className="text-slate-500">Loading...</p>
            ) : filteredLoanViews.length === 0 ? (
              <p className="text-slate-500">No loans match the current filters.</p>
            ) : (
              <div className="space-y-4 max-h-[68vh] overflow-y-auto pr-1">
                {filteredLoanViews.map((entry) => {
                  const { loan, employeeName, symbol, total, remaining, monthly, percentPaid } =
                    entry;

                  return (
                    <div
                      key={loan.id}
                      className="p-4 rounded-lg bg-slate-800/50 border border-slate-800"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-200">{employeeName}</h3>
                          <button
                            onClick={() => {
                              setSelectedLoan(loan);
                              setLoanModalMode("repay");
                              setLoanModalOpen(true);
                            }}
                            className="p-1 text-slate-500 hover:bg-slate-800 hover:text-emerald-400 rounded transition-colors"
                            title="Repay Loan"
                          >
                            <RefreshCw size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedLoan(loan);
                              setLoanModalMode("edit");
                              setLoanModalOpen(true);
                            }}
                            className="p-1 text-slate-500 hover:bg-slate-800 hover:text-indigo-400 rounded transition-colors"
                            title="Edit Loan"
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                        <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-slate-800 font-medium border border-slate-700">
                          {getStatusIcon(entry.status)}
                          {entry.status}
                        </span>
                      </div>

                      <div className="flex justify-between text-sm mb-4">
                        <div className="text-slate-400">
                          Total: <span className="text-slate-200 font-mono">{symbol}{formatAmount(total)}</span>
                        </div>
                        <div className="text-slate-400">
                          Monthly: <span className="text-slate-200 font-mono">-{symbol}{formatAmount(monthly)}</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Progress</span>
                          <span className="font-medium text-purple-400 font-mono">
                            {symbol}{formatAmount(remaining)} left
                          </span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-2 border border-slate-800">
                          <div
                            className="bg-purple-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(0, percentPaid))}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <LoanModal
        isOpen={isLoanModalOpen}
        onClose={() => {
          setLoanModalOpen(false);
          setSelectedLoan(null);
        }}
        onSuccess={() => void loadData()}
        mode={loanModalMode}
        loanData={selectedLoan}
      />
    </div>
  );
};
