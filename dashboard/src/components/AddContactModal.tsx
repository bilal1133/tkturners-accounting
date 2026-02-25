import { useState } from "react";
import { useForm } from "react-hook-form";
import { api } from "../lib/api";
import { X } from "lucide-react";

type AddContactModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export const AddContactModal = ({
  isOpen,
  onClose,
  onSuccess,
}: AddContactModalProps) => {
  const { register, handleSubmit, reset } = useForm();
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      await api.post("/contacts", {
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          type: data.type,
          base_salary: data.base_salary ? parseFloat(data.base_salary) : null,
        },
      });
      reset();
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      alert("Failed to save contact.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex justify-between items-center p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-white">Add Contact</h2>
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
              Name
            </label>
            <input
              required
              {...register("name")}
              className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Email
              </label>
              <input
                type="email"
                {...register("email")}
                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Phone
              </label>
              <input
                type="tel"
                {...register("phone")}
                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Type
              </label>
              <select
                required
                {...register("type")}
                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="Customer">Customer</option>
                <option value="Vendor">Vendor</option>
                <option value="Employee">Employee</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Base Salary (Employees)
              </label>
              <input
                type="number"
                step="0.01"
                {...register("base_salary")}
                placeholder="0.00"
                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
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
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
