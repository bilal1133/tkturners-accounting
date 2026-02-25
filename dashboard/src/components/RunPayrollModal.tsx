import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { api } from "../lib/api";
import { X } from "lucide-react";

type RunPayrollModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export const RunPayrollModal = ({
  isOpen,
  onClose,
  onSuccess,
}: RunPayrollModalProps) => {
  const { register, handleSubmit, reset } = useForm();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [empRes, loanRes] = await Promise.all([
        api.get("/contacts?filters[type][$eq]=Employee"),
        api.get("/loans?filters[status][$eq]=Active"),
      ]);
      setEmployees(empRes.data.data);
      setActiveLoans(loanRes.data.data);
    } catch (e) {
      console.error(e);
    }
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const baseRaw = parseFloat(data.base_salary) || 0;
      const bonRaw = parseFloat(data.bonuses) || 0;
      const dedRaw = parseFloat(data.standard_deductions) || 0;
      const loanDedRaw = parseFloat(data.loan_deduction) || 0;

      const netPay = baseRaw + bonRaw - dedRaw - loanDedRaw;

      // Construct the payload for the new Batch Payroll Architecture
      await api.post("/payrolls", {
        data: {
          pay_period_start: data.pay_period_start,
          pay_period_end: data.pay_period_end,
          payroll_status: data.status === "Draft" ? "draft" : "processed",
          employee_details: [
            {
              __component: "employee.employee",
              contact: parseInt(data.employeeId),
              bonus: bonRaw,
              loan_amount_to_deduct: loanDedRaw,
              loan_ref: data.loanId ? parseInt(data.loanId) : null,
              amount_to_transfer: netPay,
              payroll_status: data.status === "Paid" ? "sent" : "draft",
            },
          ],
        },
      });

      reset();
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      alert("Failed to run payroll.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-xl shadow-xl">
        <div className="flex justify-between items-center p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-white">Run Payroll</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Employee
            </label>
            <select
              required
              {...register("employeeId")}
              className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">Select Employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} (Base: {e.base_salary || "N/A"})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Period Start
              </label>
              <input
                type="date"
                required
                {...register("pay_period_start")}
                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Period End
              </label>
              <input
                type="date"
                required
                {...register("pay_period_end")}
                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Base Salary
              </label>
              <input
                type="number"
                step="0.01"
                required
                {...register("base_salary")}
                placeholder="0.00"
                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-emerald-400 mb-1">
                Bonuses
              </label>
              <input
                type="number"
                step="0.01"
                {...register("bonuses")}
                placeholder="0.00"
                className="w-full bg-emerald-500/5 border border-emerald-500/30 rounded-md p-2.5 text-emerald-400 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-red-400 mb-1">
                Standard Deductions
              </label>
              <input
                type="number"
                step="0.01"
                {...register("standard_deductions")}
                placeholder="0.00"
                className="w-full bg-red-500/5 border border-red-500/30 rounded-md p-2.5 text-red-400 focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-red-400 mb-1">
                Loan Deduction (Installment)
              </label>
              <input
                type="number"
                step="0.01"
                {...register("loan_deduction")}
                placeholder="0.00"
                className="w-full bg-red-500/5 border border-red-500/30 rounded-md p-2.5 text-red-400 focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Link to Active Loan (Optional)
              </label>
              <select
                {...register("loanId")}
                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">No Loan</option>
                {activeLoans.map((l) => (
                  <option key={l.id} value={l.id}>
                    Loan #{l.id} - Bal: {l.remaining_balance}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Status
              </label>
              <select
                required
                {...register("status")}
                defaultValue="Draft"
                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="Draft">Draft</option>
                <option value="Approved">Approved</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-medium text-slate-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {loading ? "Saving..." : "Generate Slip"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
