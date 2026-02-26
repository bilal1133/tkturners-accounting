import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "../lib/api";
import { X } from "lucide-react";

const loanSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  accountId: z.string().min(1, "Disbursement Account is required"),
  amount: z.string().min(1, "Loan Amount is required"),
  monthlyInstallment: z.string().min(1, "Monthly Installment is required"),
  date: z.string().min(1, "Disbursement Date is required"),
});

type IssueLoanModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultContactId?: string;
};

export const IssueLoanModal = ({
  isOpen,
  onClose,
  onSuccess,
  defaultContactId,
}: IssueLoanModalProps) => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      employeeId: defaultContactId || "",
      accountId: "",
      amount: "",
      monthlyInstallment: "",
      date: new Date().toISOString().split("T")[0],
    },
  });

  useEffect(() => {
    if (isOpen) {
      fetchDependencies();
      reset({
        employeeId: defaultContactId || "",
        accountId: "",
        amount: "",
        monthlyInstallment: "",
        date: new Date().toISOString().split("T")[0],
      });
    }
  }, [isOpen, defaultContactId, reset]);

  const fetchDependencies = async () => {
    setFetching(true);
    try {
      const [empRes, accRes] = await Promise.all([
        // Fetch all contacts, we will manual filter the employees
        api.get("/contacts?populate=*"),
        api.get("/accounts"),
      ]);

      const fetchedContacts = empRes.data.data || [];
      const fetchedAccounts = accRes.data.data || [];

      // Filter only active employees out of the contacts
      const activeEmployees = fetchedContacts.filter((emp: any) => {
        if (!emp.contact_type || emp.contact_type.length === 0) return false;
        const empConfig = emp.contact_type.find(
          (c: any) => c.__component === "contact-type.employee",
        );
        if (!empConfig) return false;
        return empConfig.active !== false;
      });

      setEmployees(activeEmployees);
      setAccounts(fetchedAccounts);
    } catch (err) {
      console.error("Failed to load dependencies", err);
    } finally {
      setFetching(false);
    }
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      await api.post("/loans/issue", {
        data: {
          employeeId: Number(data.employeeId),
          accountId: Number(data.accountId),
          amount: parseFloat(data.amount),
          monthlyInstallment: parseFloat(data.monthlyInstallment),
          date: data.date,
        },
      });

      reset();
      onSuccess();
      onClose();
    } catch (e: any) {
      console.error(e);
      alert(e.response?.data?.error?.message || "Failed to issue loan.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Issue Employee Loan</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(100vh-200px)]">
          {fetching ? (
            <div className="text-slate-400 text-center py-8">
              Loading configurations...
            </div>
          ) : (
            <form
              id="issue-loan-form"
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Employee Name
                  </label>
                  <select
                    {...register("employeeId")}
                    disabled={!!defaultContactId}
                    className={`w-full bg-slate-800 border ${errors.employeeId ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-60`}
                  >
                    <option value="">Select Employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                  {errors.employeeId && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.employeeId.message as string}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Disbursement Account
                  </label>
                  <select
                    {...register("accountId")}
                    className={`w-full bg-slate-800 border ${errors.accountId ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                  >
                    <option value="">Select Account...</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} - ${parseFloat(acc.balance).toFixed(2)}
                      </option>
                    ))}
                  </select>
                  {errors.accountId && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.accountId.message as string}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Total Loan Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("amount")}
                    className={`w-full bg-slate-800 border ${errors.amount ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                  />
                  {errors.amount && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.amount.message as string}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Monthly Installment Deduction ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("monthlyInstallment")}
                    className={`w-full bg-slate-800 border ${errors.monthlyInstallment ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                  />
                  {errors.monthlyInstallment && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.monthlyInstallment.message as string}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Disbursement Date
                  </label>
                  <input
                    type="date"
                    {...register("date")}
                    className={`w-full bg-slate-800 border ${errors.date ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                  />
                  {errors.date && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.date.message as string}
                    </p>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="issue-loan-form"
            disabled={loading || fetching}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? "Processing..." : "Issue Loan"}
          </button>
        </div>
      </div>
    </div>
  );
};
