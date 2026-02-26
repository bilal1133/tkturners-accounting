import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Banknote, CreditCard, Plus, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { IssueLoanModal } from "../components/IssueLoanModal";

export const PayrollPage = () => {
  const navigate = useNavigate();
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isLoanModalOpen, setLoanModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [payRes, loanRes] = await Promise.all([
        api.get("/payrolls?populate=*"),
        api.get("/loans?populate=*"),
      ]);
      setPayrolls(payRes.data.data);
      setLoans(loanRes.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === "Paid" || status === "Paid Off")
      return <CheckCircle size={16} className="text-emerald-500" />;
    return <Clock size={16} className="text-amber-500" />;
  };

  return (
    <div className="space-y-8 text-slate-200">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Payroll & Loans</h1>
          <p className="text-slate-400 mt-1">
            Manage employee slips and active loans.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Payrolls Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Banknote size={18} className="text-blue-400" />
              Recent Payroll Batches
            </h2>
            <button
              onClick={() => navigate("/payrolls/generate")}
              className="text-sm bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-md flex items-center gap-1 font-medium text-white transition-colors"
            >
              <Plus size={16} /> Generate Batch
            </button>
          </div>
          <div className="p-4 flex-1">
            {loading ? (
              <p className="text-slate-500">Loading...</p>
            ) : (
              <div className="space-y-3">
                {payrolls.map((batch) => {
                  const employeeCount = batch.employee_details?.length || 0;
                  const totalNetPay =
                    batch.employee_details?.reduce(
                      (sum: number, emp: any) =>
                        sum + (parseFloat(emp.net_pay) || 0),
                      0,
                    ) || 0;

                  return (
                    <div
                      key={batch.id}
                      className="p-4 rounded-lg bg-slate-800/50 border border-slate-800 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-slate-200">
                            Payroll Batch #{batch.id}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">
                            {format(new Date(batch.pay_period_start), "MMM dd")}{" "}
                            -{" "}
                            {format(
                              new Date(batch.pay_period_end),
                              "MMM dd, yyyy",
                            )}
                          </p>
                        </div>
                        <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-slate-800 font-medium border border-slate-700">
                          {getStatusIcon(batch.payroll_status)}
                          <span className="capitalize">
                            {batch.payroll_status || "draft"}
                          </span>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-slate-400">Total Employees:</div>
                        <div className="text-right font-mono text-slate-300">
                          {employeeCount}
                        </div>

                        <div className="col-span-2 my-1 border-t border-slate-700/50"></div>

                        <div className="font-medium text-slate-200">
                          Total Net Pay:
                        </div>
                        <div className="text-right font-bold text-indigo-400 font-mono text-lg">
                          $
                          {totalNetPay.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-md text-slate-300 transition-colors">
                          View {employeeCount} Payslips
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Loans Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CreditCard size={18} className="text-purple-400" />
              Active Loans
            </h2>
            <button
              onClick={() => setLoanModalOpen(true)}
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
                {loans.map((l) => {
                  const percentPaid = Math.min(
                    100,
                    Math.max(
                      0,
                      ((l.total_amount - l.remaining_balance) /
                        l.total_amount) *
                        100,
                    ),
                  );

                  return (
                    <div
                      key={l.id}
                      className="p-4 rounded-lg bg-slate-800/50 border border-slate-800"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-slate-200">
                          {l.employee?.name || "Unknown"}
                        </h3>
                        <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-slate-800 font-medium border border-slate-700">
                          {getStatusIcon(l.status)}
                          {l.status}
                        </span>
                      </div>

                      <div className="flex justify-between text-sm mb-4">
                        <div className="text-slate-400">
                          Total:{" "}
                          <span className="text-slate-200 font-mono">
                            {l.total_amount}
                          </span>
                        </div>
                        <div className="text-slate-400">
                          Monthly:{" "}
                          <span className="text-slate-200 font-mono">
                            -{l.monthly_installment}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Progress</span>
                          <span className="font-medium text-purple-400 font-mono">
                            {l.remaining_balance} left
                          </span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-2 border border-slate-800">
                          <div
                            className="bg-purple-500 h-1.5 rounded-full"
                            style={{ width: `${percentPaid}%` }}
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

      <IssueLoanModal
        isOpen={isLoanModalOpen}
        onClose={() => setLoanModalOpen(false)}
        onSuccess={() => loadData()}
      />
    </div>
  );
};
