import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { api } from "../lib/api";
import { X } from "lucide-react";

type DisburseLoanModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export const DisburseLoanModal = ({
  isOpen,
  onClose,
  onSuccess,
}: DisburseLoanModalProps) => {
  const { register, handleSubmit, reset } = useForm();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      api
        .get("/contacts?filters[type][$eq]=Employee")
        .then((res) => setEmployees(res.data.data))
        .catch(console.error);
    }
  }, [isOpen]);

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      await api.post("/loans", {
        data: {
          employee: parseInt(data.employeeId),
          total_amount: parseFloat(data.total_amount),
          monthly_installment: parseFloat(data.monthly_installment),
          remaining_balance: parseFloat(data.total_amount), // Initial balance = total amount
          status: data.status,
        },
      });
      reset();
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      alert("Failed to save loan.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex justify-between items-center p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-white">Disburse Loan</h2>
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
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Total Amount Granted
              </label>
              <input
                type="number"
                step="0.01"
                required
                {...register("total_amount")}
                placeholder="0.00"
                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Monthly Installment
              </label>
              <input
                type="number"
                step="0.01"
                required
                {...register("monthly_installment")}
                placeholder="0.00"
                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Status
            </label>
            <select
              required
              {...register("status")}
              defaultValue="Active"
              className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="Active">Active</option>
              <option value="Paid Off">Paid Off</option>
              <option value="Defaulted">Defaulted</option>
            </select>
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
              {loading ? "Disbursing..." : "Disburse Loan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
