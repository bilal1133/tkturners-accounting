import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { api } from "../lib/api";
import { currencyLabel } from "../lib/currency";
import { X } from "lucide-react";

type AddTransactionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export const AddTransactionModal = ({
  isOpen,
  onClose,
  onSuccess,
}: AddTransactionModalProps) => {
  const { register, handleSubmit, reset, watch } = useForm();
  const [loading, setLoading] = useState(false);

  // Lookups data
  const [contacts, setContacts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadLookups();
    }
  }, [isOpen]);

  const loadLookups = async () => {
    try {
      const [conRes, projRes, catRes, accRes, curRes] = await Promise.all([
        api.get("/contacts"),
        api.get("/projects"),
        api.get("/categories"),
        api.get("/accounts"),
        api.get("/currencies"),
      ]);
      setContacts(conRes.data.data);
      setProjects(projRes.data.data);
      setCategories(catRes.data.data);
      setAccounts(accRes.data.data);
      setCurrencies(curRes.data.data);
    } catch (e) {
      console.error("Failed to load lookups", e);
    }
  };

  const transactionType = watch("transactionType", "expense");

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      // Build dynamic zone based on transaction type
      let dynZone: any = {};
      if (data.transactionType === "expense") {
        dynZone = {
          __component: "type.expense",
          amount: parseFloat(data.amount),
          currency: parseInt(data.currencyId),
          account: parseInt(data.accountId),
        };
      } else if (data.transactionType === "income") {
        dynZone = {
          __component: "type.income",
          amount: parseFloat(data.amount),
          currency: parseInt(data.currencyId),
          account: parseInt(data.accountId),
        };
      } else if (data.transactionType === "transfer") {
        dynZone = {
          __component: "type.transfer",
          from_amount: parseFloat(data.amount),
          to_amount: parseFloat(data.amount), // assume 1:1 for basic transfer
          from_account: parseInt(data.fromAccountId),
          to_account: parseInt(data.toAccountId),
        };
      }

      const payload = {
        data: {
          date_time: new Date(data.date).toISOString(),
          note: data.note,
          payment_type: data.payment_type,
          type: [dynZone],
          contact: data.contactId ? parseInt(data.contactId) : null,
          project: data.projectId ? parseInt(data.projectId) : null,
          category: data.categoryId ? parseInt(data.categoryId) : null,
        },
      };

      await api.post("/transactions", payload);
      reset();
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      alert("Failed to save transaction. Check console.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center p-6 border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
          <h2 className="text-xl font-semibold text-white">Add Transaction</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <label
              className={`cursor-pointer border rounded-lg p-3 text-center transition-colors ${transactionType === "income" ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 font-medium" : "bg-slate-800 border-slate-700 text-slate-400"}`}
            >
              <input
                type="radio"
                value="income"
                {...register("transactionType")}
                className="sr-only"
              />
              Income
            </label>
            <label
              className={`cursor-pointer border rounded-lg p-3 text-center transition-colors ${transactionType === "expense" ? "bg-red-500/10 border-red-500 text-red-400 font-medium" : "bg-slate-800 border-slate-700 text-slate-400"}`}
            >
              <input
                type="radio"
                value="expense"
                {...register("transactionType")}
                className="sr-only"
              />
              Expense
            </label>
            <label
              className={`cursor-pointer border rounded-lg p-3 text-center transition-colors ${transactionType === "transfer" ? "bg-blue-500/10 border-blue-500 text-blue-400 font-medium" : "bg-slate-800 border-slate-700 text-slate-400"}`}
            >
              <input
                type="radio"
                value="transfer"
                {...register("transactionType")}
                className="sr-only"
              />
              Transfer
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Date
              </label>
              <input
                type="date"
                required
                {...register("date")}
                defaultValue={new Date().toISOString().split("T")[0]}
                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Amount
              </label>
              <input
                type="number"
                step="0.01"
                required
                {...register("amount")}
                placeholder="0.00"
                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {transactionType !== "transfer" ? (
            <div className="grid grid-cols-2 gap-4">
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
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Account
                </label>
                <select
                  required
                  {...register("accountId")}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">Select Account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 border p-4 border-blue-500/30 bg-blue-500/5 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-blue-400 mb-1">
                  From Account
                </label>
                <select
                  required
                  {...register("fromAccountId")}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">Select Account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-400 mb-1">
                  To Account
                </label>
                <select
                  required
                  {...register("toAccountId")}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">Select Account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Contact
              </label>
              <select
                {...register("contactId")}
                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">No Contact</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Project
              </label>
              <select
                {...register("projectId")}
                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">No Project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Category
              </label>
              <select
                {...register("categoryId")}
                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">No Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Payment Method
              </label>
              <select
                required
                {...register("payment_type")}
                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="Cash">Cash</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Transfer">Transfer</option>
                <option value="Voucher">Voucher</option>
                <option value="Mobile Payment">Mobile Payment</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Notes
            </label>
            <textarea
              {...register("note")}
              rows={2}
              placeholder="Description of the transaction..."
              className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            ></textarea>
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
              {loading ? "Saving..." : "Save Transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
