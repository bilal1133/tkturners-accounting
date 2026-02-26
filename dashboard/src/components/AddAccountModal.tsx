import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { api } from "../lib/api";
import { currencyLabel } from "../lib/currency";
import { X } from "lucide-react";

type AddAccountModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export const AddAccountModal = ({
  isOpen,
  onClose,
  onSuccess,
}: AddAccountModalProps) => {
  const { register, handleSubmit, reset } = useForm();
  const [loading, setLoading] = useState(false);
  const [currencies, setCurrencies] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      api
        .get("/currencies")
        .then((res) => {
          if (res.data && res.data.data) {
            setCurrencies(res.data.data);
          } else {
            console.error("Unexpected currency data structure:", res.data);
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      await api.post("/accounts", {
        data: {
          name: data.name,
          initial_amount: parseFloat(data.initial_amount),
          currency: parseInt(data.currencyId),
          exclude_from_statistics: data.exclude_from_statistics,
        },
      });
      reset();
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      alert("Failed to save account.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex justify-between items-center p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-white">
            Add Bank/Cash Account
          </h2>
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
              Account Name
            </label>
            <input
              required
              {...register("name")}
              placeholder="e.g. Chase Business Checking"
              className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Initial Balance
              </label>
              <input
                type="number"
                step="0.01"
                required
                {...register("initial_amount")}
                placeholder="0.00"
                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Currency
              </label>
              <select
                required
                {...register("currencyId")}
                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">Select Currency</option>
                {currencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {currencyLabel(c)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register("exclude_from_statistics")}
                className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-600 bg-slate-800"
              />
              <span className="text-sm font-medium text-slate-400">
                Exclude from overall statistics / net worth
              </span>
            </label>
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
              {loading ? "Saving..." : "Save Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
