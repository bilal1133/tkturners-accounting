import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "../lib/api";
import {
  currencyName,
  currencySymbol,
} from "../lib/currency";
import { X } from "lucide-react";

const parseNumber = (value: unknown) =>
  Number.parseFloat(String(value ?? "").trim());
const isFiniteNumber = (value: unknown) => Number.isFinite(parseNumber(value));
const isPositiveNumber = (value: unknown) => parseNumber(value) > 0;
const isNonNegativeNumber = (value: unknown) => parseNumber(value) >= 0;
const toFiniteNumberOrNull = (value: unknown) =>
  isFiniteNumber(value) ? parseNumber(value) : null;
const toIntegerOrNull = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};
const isValidDateValue = (value: string) =>
  !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
const isFutureDateValue = (value: string) => {
  const selected = new Date(`${value}T00:00:00`);
  if (Number.isNaN(selected.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return selected.getTime() > today.getTime();
};

const requiredNumericString = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine(isFiniteNumber, `${label} must be a valid number`);

const positiveNumericString = (label: string) =>
  requiredNumericString(label).refine(
    isPositiveNumber,
    `${label} must be greater than 0`,
  );

const optionalPositiveNumericString = (label: string) =>
  z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) =>
        !value || (isFiniteNumber(value) && isPositiveNumber(value)),
      `${label} must be greater than 0`,
    );

const baseLoanSchema = z
  .object({
    employeeId: z.string().min(1, "Employee is required"),
    amount: positiveNumericString("Total Loan Amount"),
    monthlyInstallment: positiveNumericString("Monthly Installment Deduction"),
  })
  .superRefine((data, ctx) => {
    const amount = parseNumber(data.amount);
    const monthlyInstallment = parseNumber(data.monthlyInstallment);
    if (monthlyInstallment > amount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["monthlyInstallment"],
        message: "Monthly Installment Deduction cannot exceed Total Loan Amount",
      });
    }
  });

const issueSchema = baseLoanSchema.extend({
  accountId: z.string().min(1, "Disbursement Account is required"),
  convertedAmount: optionalPositiveNumericString("Converted Amount"),
  date: z
    .string()
    .min(1, "Disbursement Date is required")
    .refine(isValidDateValue, "Invalid disbursement date"),
  payment_type: z.string().optional().or(z.literal("")),
  note: z.string().optional().or(z.literal("")),
});

const editSchema = baseLoanSchema
  .extend({
    remainingBalance: requiredNumericString("Remaining Balance").refine(
      isNonNegativeNumber,
      "Remaining Balance cannot be negative",
    ),
    status: z.enum(["Active", "Paid Off", "Defaulted"]),
  })
  .superRefine((data, ctx) => {
    const amount = parseNumber(data.amount);
    const remainingBalance = parseNumber(data.remainingBalance);

    if (remainingBalance > amount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["remainingBalance"],
        message: "Remaining Balance cannot exceed Total Loan Amount",
      });
    }

    if (data.status === "Paid Off" && remainingBalance !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["remainingBalance"],
        message: "Remaining Balance must be 0 when status is Paid Off",
      });
    }

    if (remainingBalance === 0 && data.status !== "Paid Off") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "Status must be Paid Off when Remaining Balance is 0",
      });
    }
  });

const buildRepaySchema = (remainingBalance: number | null) =>
  z
    .object({
      employeeId: z.string().optional().or(z.literal("")),
      accountId: z.string().min(1, "Receiving Account is required"),
      amount: positiveNumericString("Repayment Amount"),
      convertedAmount: optionalPositiveNumericString("Converted Amount"),
      date: z
        .string()
        .min(1, "Date is required")
        .refine(isValidDateValue, "Invalid repayment date")
        .refine(
          (value) => !isFutureDateValue(value),
          "Repayment date cannot be in the future",
        ),
      payment_type: z.string().optional().or(z.literal("")),
      note: z.string().optional().or(z.literal("")),
    })
    .superRefine((data, ctx) => {
      if (!isFiniteNumber(data.amount) || remainingBalance === null) return;

      if (remainingBalance <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["amount"],
          message: "This loan is already fully paid",
        });
        return;
      }

      if (parseNumber(data.amount) > remainingBalance) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["amount"],
          message: "Repayment Amount cannot exceed remaining balance",
        });
      }
    });

type LoanModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: "issue" | "edit" | "repay";
  defaultContactId?: string;
  loanData?: any;
};

export const LoanModal = ({
  isOpen,
  onClose,
  onSuccess,
  mode,
  defaultContactId,
  loanData,
}: LoanModalProps) => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const todayIso = new Date().toISOString().split("T")[0];
  const repayRemainingBalance = toFiniteNumberOrNull(
    loanData?.remaining_balance ?? loanData?.total_amount,
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors },
  } = useForm<any>({
    resolver: zodResolver(
      mode === "issue"
        ? issueSchema
        : mode === "repay"
          ? buildRepaySchema(repayRemainingBalance)
          : editSchema,
    ),
    defaultValues: {
      employeeId: defaultContactId || "",
      accountId: "",
      amount: "",
      monthlyInstallment: "",
      convertedAmount: "",
      date: todayIso,
      remainingBalance: "",
      status: "Active",
      payment_type: "Transfer",
      note: "",
    },
  });

  const selectedEmployeeId = watch("employeeId");
  const selectedAccountId = watch("accountId");

  const selectedEmployee = employees.find(
    (e) => String(e.id) === String(selectedEmployeeId),
  );
  const selectedEmployeeConfig = selectedEmployee?.contact_type?.find(
    (c: any) => c.__component === "contact-type.employee",
  );
  const selectedEmployeeCurrencyId = toIntegerOrNull(
    typeof selectedEmployeeConfig?.currency === "object"
      ? selectedEmployeeConfig?.currency?.id
      : selectedEmployeeConfig?.currency,
  );
  const selectedEmployeeCurrency =
    currencySymbol(selectedEmployeeConfig?.currency) ||
    currencyName(selectedEmployeeConfig?.currency) ||
    "";

  const selectedAccount = accounts.find(
    (a) => String(a.id) === String(selectedAccountId),
  );
  const selectedAccountCurrencyId = toIntegerOrNull(selectedAccount?.currency?.id);
  const selectedAccountCurrency =
    currencySymbol(selectedAccount?.currency) ||
    currencyName(selectedAccount?.currency) ||
    "";

  const requiresConvertedAmount =
    mode === "repay" &&
    selectedEmployeeCurrencyId !== null &&
    selectedAccountCurrencyId !== null &&
    selectedEmployeeCurrencyId !== selectedAccountCurrencyId;

  useEffect(() => {
    if (isOpen) {
      if (mode === "issue") {
        fetchDependencies();
        reset({
          employeeId: defaultContactId || "",
          accountId: "",
          amount: "",
          monthlyInstallment: "",
          convertedAmount: "",
          date: todayIso,
          remainingBalance: "",
          status: "Active",
          payment_type: "Transfer",
          note: "",
        });
      } else if (mode === "edit" && loanData) {
        fetchDependencies();
        reset({
          employeeId:
            defaultContactId ||
            loanData.employee?.id?.toString() ||
            loanData.disbursement_transaction?.contact?.id?.toString() ||
            "",
          accountId: "",
          amount: loanData.total_amount?.toString() || "",
          monthlyInstallment: loanData.monthly_installment?.toString() || "",
          convertedAmount: "",
          date: todayIso,
          remainingBalance: loanData.remaining_balance?.toString() || "",
          status: loanData.status || "Active",
        });
      } else if (mode === "repay" && loanData) {
        fetchDependencies();
        reset({
          employeeId:
            defaultContactId ||
            loanData.employee?.id?.toString() ||
            loanData.disbursement_transaction?.contact?.id?.toString() ||
            "",
          accountId: "",
          amount: "",
          monthlyInstallment: "",
          convertedAmount: "",
          date: todayIso,
          remainingBalance: loanData.remaining_balance?.toString() || "",
          status: loanData.status || "Active",
          payment_type: "Transfer",
          note: "",
        });
      }
    }
  }, [isOpen, defaultContactId, loanData, mode, reset, todayIso]);

  const fetchDependencies = async () => {
    setFetching(true);
    try {
      const [empRes, accRes, txRes] = await Promise.all([
        // Fetch all contacts, we will manual filter the employees
        api.get("/contacts?populate[0]=contact_type&populate[1]=contact_type.currency"),
        api.get("/accounts?populate=*"),
        api.get(
          "/transactions?populate[0]=type.account&populate[1]=type.to_account&populate[2]=type.from_account&pagination[pageSize]=1000",
        ),
      ]);

      const fetchedContacts = empRes.data.data || [];
      const fetchedAccounts = accRes.data.data || [];
      const allTxs = txRes.data.data || [];

      // Calculate true current balances
      const enrichedAccounts = fetchedAccounts.map((acc: any) => {
        let balance = parseFloat(acc.initial_amount) || 0;
        const accDocId = acc.documentId;
        allTxs.forEach((tx: any) => {
          const comp = tx.type?.[0];
          if (!comp) return;

          if (
            comp.__component === "type.income" &&
            comp.account?.documentId === accDocId
          ) {
            balance += parseFloat(comp.amount) || 0;
          } else if (
            comp.__component === "type.expense" &&
            comp.account?.documentId === accDocId
          ) {
            balance -= parseFloat(comp.amount) || 0;
          } else if (comp.__component === "type.transfer") {
            if (comp.from_account?.documentId === accDocId)
              balance -= parseFloat(comp.from_amount) || 0;
            if (comp.to_account?.documentId === accDocId)
              balance += parseFloat(comp.to_amount) || 0;
          }
        });
        return { ...acc, currentBalance: balance };
      });

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
      setAccounts(enrichedAccounts);
    } catch (err) {
      console.error("Failed to load dependencies", err);
    } finally {
      setFetching(false);
    }
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      if (mode === "issue") {
        await api.post("/loans/issue", {
          data: {
            employeeId: Number(data.employeeId),
            accountId: Number(data.accountId),
            amount: parseFloat(data.amount),
            monthlyInstallment: parseFloat(data.monthlyInstallment),
            convertedAmount: data.convertedAmount
              ? parseFloat(data.convertedAmount)
              : undefined,
            date: data.date,
            note: data.note || undefined,
            payment_type: data.payment_type || undefined,
          },
        });
      } else if (mode === "repay") {
        if (!loanData?.id) {
          setError("amount", {
            type: "manual",
            message: "Loan reference is missing. Please refresh and try again.",
          });
          return;
        }

        if (repayRemainingBalance === null) {
          setError("amount", {
            type: "manual",
            message:
              "Remaining balance is unavailable. Please refresh and try again.",
          });
          return;
        }

        if (repayRemainingBalance <= 0) {
          setError("amount", {
            type: "manual",
            message: "This loan is already fully paid",
          });
          return;
        }

        const repaymentAmount = parseNumber(data.amount);
        if (repaymentAmount > repayRemainingBalance) {
          setError("amount", {
            type: "manual",
            message: "Repayment Amount cannot exceed remaining balance",
          });
          return;
        }

        if (requiresConvertedAmount && !String(data.convertedAmount || "").trim()) {
          setError("convertedAmount", {
            type: "manual",
            message:
              "Converted Amount is required when account currency differs from loan currency",
          });
          return;
        }

        await api.post("/loans/repay", {
          data: {
            loanId: loanData.id,
            employeeId: Number(data.employeeId),
            accountId: Number(data.accountId),
            amount: parseFloat(data.amount),
            convertedAmount: data.convertedAmount
              ? parseFloat(data.convertedAmount)
              : undefined,
            date: data.date,
            note: data.note || undefined,
            payment_type: data.payment_type || undefined,
          },
        });
      } else {
        await api.put(`/loans/${loanData.documentId}`, {
          data: {
            total_amount: parseFloat(data.amount),
            monthly_installment: parseFloat(data.monthlyInstallment),
            remaining_balance: parseFloat(data.remainingBalance),
            status: data.status,
          },
        });
      }

      reset();
      onSuccess();
      onClose();
    } catch (e: any) {
      console.error(e);
      alert(e.response?.data?.error?.message || `Failed to ${mode} loan.`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {mode === "issue"
              ? "Issue Employee Loan"
              : mode === "repay"
                ? "Repay Loan"
                : "Edit Loan Details"}
          </h2>
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
                    disabled={
                      mode === "edit" || mode === "repay" || !!defaultContactId
                    }
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

                {mode !== "repay" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">
                        Total Loan Amount{selectedEmployeeCurrency ? ` (${selectedEmployeeCurrency})` : ""}
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
                        Monthly Installment Deduction{selectedEmployeeCurrency ? ` (${selectedEmployeeCurrency})` : ""}
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
                  </>
                )}

                {mode === "repay" && (
                  <>
                    {repayRemainingBalance !== null && (
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm flex items-center justify-between">
                        <span className="text-amber-400 font-medium">Remaining Balance</span>
                        <span className="text-white font-mono font-semibold">
                          {selectedEmployeeCurrency}
                          {repayRemainingBalance.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">
                        Repayment Amount{selectedEmployeeCurrency ? ` (${selectedEmployeeCurrency})` : ""}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={
                          mode === "repay" && repayRemainingBalance !== null
                            ? repayRemainingBalance.toString()
                            : undefined
                        }
                        {...register("amount")}
                        className={`w-full bg-slate-800 border ${errors.amount ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                      />
                      {errors.amount && (
                        <p className="text-red-400 text-xs mt-1">
                          {errors.amount.message as string}
                        </p>
                      )}
                    </div>
                  </>
                )}

                {(mode === "issue" || mode === "repay") && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">
                        {mode === "issue"
                          ? "Disbursement Account"
                          : "Receiving Account"}
                      </label>
                      <select
                        {...register("accountId")}
                        className={`w-full bg-slate-800 border ${errors.accountId ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                      >
                        <option value="">Select Account...</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} - Balance:{" "}
                            {currencySymbol(acc.currency) || currencyName(acc.currency) || "$"}
                            {parseFloat(acc.currentBalance || 0).toFixed(2)}
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
                        Converted Amount{selectedAccountCurrency ? ` (${selectedAccountCurrency})` : ""}{" "}
                        <span className="font-normal text-slate-500">
                          {requiresConvertedAmount
                            ? "— required because account currency differs from loan currency"
                            : "— leave empty if same currency as loan"}
                        </span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        {...register("convertedAmount")}
                        placeholder={
                          requiresConvertedAmount
                            ? "Enter converted amount"
                            : "Leave empty if same currency"
                        }
                        className={`w-full bg-slate-800 border ${errors.convertedAmount ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                      />
                      {errors.convertedAmount && (
                        <p className="text-red-400 text-xs mt-1">
                          {errors.convertedAmount.message as string}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">
                        {mode === "issue"
                          ? "Disbursement Date"
                          : "Deposit Date"}
                      </label>
                      <input
                        type="date"
                        max={mode === "repay" ? todayIso : undefined}
                        {...register("date")}
                        className={`w-full bg-slate-800 border ${errors.date ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                      />
                      {errors.date && (
                        <p className="text-red-400 text-xs mt-1">
                          {errors.date.message as string}
                        </p>
                      )}
                    </div>

                    {(mode === "issue" || mode === "repay") && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-slate-400 mb-1">
                            Payment Mode
                          </label>
                          <select
                            {...register("payment_type")}
                            className={`w-full bg-slate-800 border ${errors.payment_type ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                          >
                            <option value="Transfer">Transfer</option>
                            <option value="Cash">Cash</option>
                            <option value="Debit Card">Debit Card</option>
                            <option value="Credit Card">Credit Card</option>
                            <option value="Voucher">Voucher</option>
                            <option value="Mobile Payment">Mobile Payment</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-400 mb-1">
                            Note <span className="font-normal text-slate-500">(optional)</span>
                          </label>
                          <input
                            type="text"
                            {...register("note")}
                            placeholder={mode === "repay" ? "e.g. January installment" : "e.g. Advance for project"}
                            className={`w-full bg-slate-800 border ${errors.note ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                          />
                        </div>
                      </>
                    )}
                  </>
                )}

                {mode === "edit" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">
                        Remaining Balance{selectedEmployeeCurrency ? ` (${selectedEmployeeCurrency})` : ""}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        {...register("remainingBalance")}
                        className={`w-full bg-slate-800 border ${errors.remainingBalance ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                      />
                      {errors.remainingBalance && (
                        <p className="text-red-400 text-xs mt-1">
                          {errors.remainingBalance.message as string}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">
                        Status
                      </label>
                      <select
                        {...register("status")}
                        className={`w-full bg-slate-800 border ${errors.status ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                      >
                        <option value="Active">Active</option>
                        <option value="Paid Off">Paid Off</option>
                        <option value="Defaulted">Defaulted</option>
                      </select>
                      {errors.status && (
                        <p className="text-red-400 text-xs mt-1">
                          {errors.status.message as string}
                        </p>
                      )}
                    </div>
                  </>
                )}
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
            {loading
              ? "Processing..."
              : mode === "issue"
                ? "Issue Loan"
                : mode === "repay"
                  ? "Process Repayment"
                  : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};
