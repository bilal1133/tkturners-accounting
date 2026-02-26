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

const formatAmount = (amount: number) =>
  amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const PayrollPage = () => {
  const navigate = useNavigate();
  const [payrolls, setPayrolls] = useState<PayrollSummary[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingBatchId, setDeletingBatchId] = useState<string | number | null>(null);

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
      setPayrolls(payRes.data?.data || []);
      setLoans(loanRes.data?.data || []);
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
          <div className="p-4 flex-1">
            {loading ? (
              <p className="text-slate-500">Loading...</p>
            ) : sortedPayrolls.length === 0 ? (
              <p className="text-slate-500">No payroll batches found.</p>
            ) : (
              <div className="space-y-3">
                {sortedPayrolls.map((batch) => {
                  const totals = batch.totals_by_currency || [];
                  const totalEmployees = batch.total_employees || 0;

                  return (
                    <div
                      key={batch.documentId || batch.id}
                      className="p-4 rounded-lg bg-slate-800/50 border border-slate-800 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-3 gap-2">
                        <div>
                          <h3 className="font-semibold text-slate-200">
                            Payroll Batch #{batch.id}
                          </h3>
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
                              {formatAmount(Number(batch.total_net_pay || 0))}
                            </div>
                          </>
                        ) : (
                          totals.map((entry, index) => (
                            <div key={`row-${batch.id}-${index}`} className="contents">
                              <div className="font-medium text-slate-200">
                                Net Pay ({entry.symbol || ""})
                              </div>
                              <div className="text-right font-bold text-indigo-400 font-mono">
                                {entry.symbol || ""}{formatAmount(Number(entry.total_net || 0))}
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
              Active Loans
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
          <div className="p-4 flex-1">
            {loading ? (
              <p className="text-slate-500">Loading...</p>
            ) : (
              <div className="space-y-4">
                {loans.map((loan) => {
                  const fallbackContact = loan.disbursement_transaction?.contact || null;
                  const fallbackEmployeeCurrency = fallbackContact?.contact_type?.find(
                    (entry: any) => entry.__component === "contact-type.employee",
                  )?.currency;

                  const employeeName = loan.employee?.name || fallbackContact?.name || "Unknown";
                  const symbol =
                    currencySymbol(loan.employee?.currency) ||
                    currencySymbol(fallbackEmployeeCurrency);

                  const total = Number(loan.total_amount || 0);
                  const remaining = Number(loan.remaining_balance || 0);
                  const monthly = Number(loan.monthly_installment || 0);
                  const percentPaid = total > 0 ? ((total - remaining) / total) * 100 : 0;

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
                          {getStatusIcon(loan.status)}
                          {loan.status}
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
