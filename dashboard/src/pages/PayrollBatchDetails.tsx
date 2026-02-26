import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Download, Save, Play, Trash2 } from "lucide-react";
import { API_URL, api } from "../lib/api";
import { currencyCode, currencyLabel, currencySymbol } from "../lib/currency";

type Account = {
  id: number;
  name: string;
  documentId?: string;
  currency?: any;
};

type LineEntry = {
  id: number;
  employee_name: string;
  contact: any;
  contact_id: number | null;
  contact_document_id: string | null;
  payee_account: number | null;
  payee_account_document_id: string | null;
  loan_ref: number | null;
  loan_ref_document_id: string | null;
  bonus: number;
  overtime_amount: number;
  fuel_allowance: number;
  gym_allowance: number;
  rental_allowance: number;
  gross_pay: number;
  loan_amount_to_deduct: number;
  net_pay: number;
  converted_gross_pay: string;
  converted_loan_deduction: string;
  converted_net_pay: string;
  salary_transaction?: any;
  loan_repayment_transaction?: any;
};

const toNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const openDatePicker = (event: { currentTarget: HTMLInputElement }) => {
  const input = event.currentTarget as HTMLInputElement & {
    showPicker?: () => void;
  };
  input.showPicker?.();
};

export const PayrollBatchDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [batch, setBatch] = useState<any>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<LineEntry[]>([]);
  const [payPeriodStart, setPayPeriodStart] = useState("");
  const [payPeriodEnd, setPayPeriodEnd] = useState("");
  const [payDate, setPayDate] = useState("");

  useEffect(() => {
    if (!id) return;
    void loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const [batchRes, accountRes] = await Promise.all([
        api.get(`/payrolls/${id}`),
        api.get("/accounts?populate=currency"),
      ]);

      const loadedBatch = batchRes.data?.data;
      setBatch(loadedBatch);
      setAccounts(accountRes.data?.data || []);

      setPayPeriodStart(loadedBatch?.pay_period_start || "");
      setPayPeriodEnd(loadedBatch?.pay_period_end || "");
      setPayDate(loadedBatch?.pay_date || "");

      const mappedEntries = (loadedBatch?.employee_details || []).map((entry: any) => ({
        id: entry.id,
        employee_name: entry.employee_name || entry.contact?.name || "",
        contact: entry.contact || null,
        contact_id: entry.contact?.id || null,
        contact_document_id: entry.contact?.documentId || null,
        payee_account:
          typeof entry.payee_account === "object"
            ? entry.payee_account?.id || null
            : entry.payee_account || null,
        payee_account_document_id:
          typeof entry.payee_account === "object"
            ? entry.payee_account?.documentId || null
            : null,
        loan_ref:
          typeof entry.loan_ref === "object"
            ? entry.loan_ref?.id || null
            : entry.loan_ref || null,
        loan_ref_document_id:
          typeof entry.loan_ref === "object"
            ? entry.loan_ref?.documentId || null
            : null,
        bonus: toNumber(entry.bonus),
        overtime_amount: toNumber(entry.overtime_amount),
        fuel_allowance: toNumber(entry.fuel_allowance),
        gym_allowance: toNumber(entry.gym_allowance),
        rental_allowance: toNumber(entry.rental_allowance),
        gross_pay: toNumber(entry.gross_pay),
        loan_amount_to_deduct: toNumber(entry.loan_amount_to_deduct),
        net_pay: toNumber(entry.net_pay),
        converted_gross_pay:
          entry.converted_gross_pay === null || entry.converted_gross_pay === undefined
            ? ""
            : String(entry.converted_gross_pay),
        converted_loan_deduction:
          entry.converted_loan_deduction === null ||
          entry.converted_loan_deduction === undefined
            ? ""
            : String(entry.converted_loan_deduction),
        converted_net_pay:
          entry.converted_net_pay === null || entry.converted_net_pay === undefined
            ? ""
            : String(entry.converted_net_pay),
        salary_transaction: entry.salary_transaction || null,
        loan_repayment_transaction: entry.loan_repayment_transaction || null,
      }));

      setEntries(mappedEntries);
    } catch (error) {
      console.error(error);
      alert("Failed to load payroll batch details.");
    } finally {
      setLoading(false);
    }
  };

  const totalNet = useMemo(
    () => entries.reduce((sum, entry) => sum + toNumber(entry.net_pay), 0),
    [entries],
  );

  const getAccount = (accountId: number | null) =>
    accounts.find((account) => account.id === accountId) || null;

  const handleEntryChange = (
    index: number,
    field: keyof LineEntry,
    value: string,
  ) => {
    setEntries((prev) => {
      const next = [...prev];
      const row = { ...next[index] };

      if (field === "payee_account" || field === "loan_ref" || field === "contact_id") {
        const parsed = Number.parseInt(value, 10);
        (row as any)[field] = Number.isInteger(parsed) ? parsed : null;
        if (field === "payee_account") {
          const selectedAccount = accounts.find((account) => account.id === parsed);
          row.payee_account_document_id = selectedAccount?.documentId || null;
        }
      } else if (
        field === "converted_gross_pay" ||
        field === "converted_loan_deduction" ||
        field === "converted_net_pay"
      ) {
        (row as any)[field] = value;
      } else {
        (row as any)[field] = round2(Math.max(0, toNumber(value)));
      }

      if (
        field === "bonus" ||
        field === "overtime_amount" ||
        field === "fuel_allowance" ||
        field === "gym_allowance" ||
        field === "rental_allowance"
      ) {
        const previous = toNumber(next[index][field] as any);
        const current = toNumber((row as any)[field]);
        row.gross_pay = round2(Math.max(0, row.gross_pay + (current - previous)));
      }

      if (
        field === "gross_pay" ||
        field === "loan_amount_to_deduct" ||
        field === "bonus" ||
        field === "overtime_amount" ||
        field === "fuel_allowance" ||
        field === "gym_allowance" ||
        field === "rental_allowance"
      ) {
        row.net_pay = round2(row.gross_pay - row.loan_amount_to_deduct);
      }

      next[index] = row;
      return next;
    });
  };

const toPayloadEntries = () =>
  entries.map((entry) => ({
      employee_name: entry.employee_name,
      contact: entry.contact_id,
      payee_account: entry.payee_account,
      loan_ref: entry.loan_ref,
      bonus: round2(entry.bonus),
      overtime_amount: round2(entry.overtime_amount),
      fuel_allowance: round2(entry.fuel_allowance),
      gym_allowance: round2(entry.gym_allowance),
      rental_allowance: round2(entry.rental_allowance),
      gross_pay: round2(entry.gross_pay),
      loan_amount_to_deduct: round2(entry.loan_amount_to_deduct),
      net_pay: round2(entry.net_pay),
      converted_gross_pay:
        entry.converted_gross_pay.trim() === ""
          ? null
          : round2(toNumber(entry.converted_gross_pay)),
      converted_loan_deduction:
        entry.converted_loan_deduction.trim() === ""
          ? null
          : round2(toNumber(entry.converted_loan_deduction)),
      converted_net_pay:
        entry.converted_net_pay.trim() === ""
          ? null
          : round2(toNumber(entry.converted_net_pay)),
      payroll_status: batch?.payroll_status === "processed" ? "processed" : "draft",
    }));

  const saveBatch = async (silent = false) => {
    if (!id) return false;

    if (!payPeriodStart || !payPeriodEnd || !payDate) {
      if (!silent) {
        alert("Pay period start, end, and pay date are required.");
      }
      return false;
    }

    setSaving(true);
    try {
      await api.put(`/payrolls/${id}`, {
        data: {
          pay_period_start: payPeriodStart,
          pay_period_end: payPeriodEnd,
          pay_date: payDate,
          employee_details: toPayloadEntries(),
        },
      });

      await loadData();
      if (!silent) {
        alert("Payroll batch saved.");
      }
      return true;
    } catch (error) {
      console.error(error);
      if (!silent) {
        alert("Failed to save payroll batch.");
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  const processBatch = async () => {
    if (!id) return;

    const saved = await saveBatch(true);
    if (!saved) return;

    setProcessing(true);
    try {
      await api.post(`/payrolls/${id}/process`);
      await loadData();
      alert("Payroll batch processed successfully.");
    } catch (error: any) {
      console.error(error);
      const detailErrors = error?.response?.data?.error?.details?.errors;
      if (Array.isArray(detailErrors) && detailErrors.length > 0) {
        const first = detailErrors[0];
        alert(first?.message || "Payroll processing failed.");
      } else {
        alert(error?.response?.data?.error?.message || "Payroll processing failed.");
      }
    } finally {
      setProcessing(false);
    }
  };

  const deleteDraftBatch = async () => {
    if (!id || !batch || batch.payroll_status !== "draft") return;

    const confirmed = window.confirm(
      `Delete draft payroll batch #${batch.id}? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      await api.delete(`/payrolls/${id}`);
      navigate("/payroll");
    } catch (error: any) {
      console.error(error);
      alert(error?.response?.data?.error?.message || "Failed to delete payroll batch.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="text-slate-400 p-8">Loading payroll batch...</div>;
  }

  if (!batch) {
    return <div className="text-red-400 p-8">Payroll batch not found.</div>;
  }

  const isProcessed = batch.payroll_status === "processed";

  return (
    <div className="space-y-6 text-slate-200">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/payroll"
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Payroll Batch #{batch.id}</h1>
            <p className="text-slate-400 text-sm">
              Status: <span className="capitalize">{batch.payroll_status}</span>
            </p>
            {batch.ledger_synced === false && (
              <p className="text-amber-400 text-xs mt-1 inline-flex items-center gap-1">
                <AlertTriangle size={12} />
                Processed data was edited and ledger entries are not synced.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void saveBatch()}
            disabled={saving || processing}
            className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={16} /> {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => window.open(`${API_URL}/api/payrolls/${id}/export.csv`, "_blank")}
            className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2"
          >
            <Download size={16} /> CSV
          </button>
          <button
            onClick={() => void processBatch()}
            disabled={isProcessed || processing || saving}
            className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Play size={16} /> {processing ? "Processing..." : "Process"}
          </button>
          {!isProcessed && (
            <button
              onClick={() => void deleteDraftBatch()}
              disabled={deleting || saving || processing}
              className="bg-red-950/40 hover:bg-red-900/50 border border-red-900/40 px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 text-red-300 disabled:opacity-50"
            >
              <Trash2 size={16} /> {deleting ? "Deleting..." : "Delete Draft"}
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-200 mb-4 border-b border-slate-800 pb-2">
          Batch Dates
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Period Start</label>
            <input
              type="date"
              value={payPeriodStart}
              onChange={(event) => setPayPeriodStart(event.target.value)}
              onFocus={openDatePicker}
              onClick={openDatePicker}
              className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-slate-200"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Period End</label>
            <input
              type="date"
              value={payPeriodEnd}
              onChange={(event) => setPayPeriodEnd(event.target.value)}
              onFocus={openDatePicker}
              onClick={openDatePicker}
              className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-slate-200"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Pay Date</label>
            <input
              type="date"
              value={payDate}
              onChange={(event) => setPayDate(event.target.value)}
              onFocus={openDatePicker}
              onClick={openDatePicker}
              className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-slate-200"
            />
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                <th className="p-4 font-medium sticky left-0 bg-slate-950 z-10 min-w-[220px]">Employee</th>
                <th className="p-4 font-medium min-w-[140px]">Payout Account</th>
                <th className="p-4 font-medium min-w-[120px]">Fuel</th>
                <th className="p-4 font-medium min-w-[120px]">Rental</th>
                <th className="p-4 font-medium min-w-[120px]">Gym</th>
                <th className="p-4 font-medium min-w-[120px]">Bonus</th>
                <th className="p-4 font-medium min-w-[120px]">Overtime</th>
                <th className="p-4 font-medium min-w-[120px]">Gross</th>
                <th className="p-4 font-medium min-w-[120px]">Loan Deduction</th>
                <th className="p-4 font-medium min-w-[120px]">Net</th>
                <th className="p-4 font-medium min-w-[140px]">Conv. Gross</th>
                <th className="p-4 font-medium min-w-[140px]">Conv. Deduction</th>
                <th className="p-4 font-medium min-w-[140px]">Conv. Net</th>
                <th className="p-4 font-medium min-w-[180px]">Transactions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={14} className="p-8 text-center text-slate-500">
                    No employee rows in this batch.
                  </td>
                </tr>
              ) : (
                entries.map((entry, index) => {
                  const account = getAccount(entry.payee_account);
                  const employeeConfig = (entry.contact?.contact_type || []).find(
                    (item: any) => item.__component === "contact-type.employee",
                  );
                  const employeeCurrency = employeeConfig?.currency || null;
                  const payoutCurrency = account?.currency || null;

                  const isCrossCurrency =
                    employeeCurrency?.id &&
                    payoutCurrency?.id &&
                    Number(employeeCurrency.id) !== Number(payoutCurrency.id);

                  return (
                    <tr key={entry.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 sticky left-0 bg-slate-900">
                        <div className="font-medium text-slate-200">
                          {entry.contact?.name || entry.employee_name || "Unknown"}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          {currencyLabel(employeeCurrency) || "No employee currency"}
                        </div>
                      </td>
                      <td className="p-4">
                        <select
                          value={entry.payee_account || ""}
                          onChange={(event) =>
                            handleEntryChange(index, "payee_account", event.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-slate-200 text-sm"
                        >
                          <option value="">Select account</option>
                          {accounts.map((accountOption) => (
                            <option key={accountOption.id} value={accountOption.id}>
                              {accountOption.name} {currencyCode(accountOption.currency) ? `(${currencyCode(accountOption.currency)})` : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.fuel_allowance}
                          onChange={(event) =>
                            handleEntryChange(index, "fuel_allowance", event.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-slate-200 font-mono"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.rental_allowance}
                          onChange={(event) =>
                            handleEntryChange(index, "rental_allowance", event.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-slate-200 font-mono"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.gym_allowance}
                          onChange={(event) =>
                            handleEntryChange(index, "gym_allowance", event.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-slate-200 font-mono"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.bonus}
                          onChange={(event) =>
                            handleEntryChange(index, "bonus", event.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-slate-200 font-mono"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.overtime_amount}
                          onChange={(event) =>
                            handleEntryChange(index, "overtime_amount", event.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-slate-200 font-mono"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.gross_pay}
                          onChange={(event) =>
                            handleEntryChange(index, "gross_pay", event.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-slate-200 font-mono"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.loan_amount_to_deduct}
                          onChange={(event) =>
                            handleEntryChange(index, "loan_amount_to_deduct", event.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-slate-200 font-mono"
                        />
                      </td>
                      <td className="p-4 font-mono text-indigo-400">
                        {currencySymbol(employeeCurrency)}{entry.net_pay.toFixed(2)}
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.converted_gross_pay}
                          placeholder={isCrossCurrency ? "Required" : "Optional"}
                          onChange={(event) =>
                            handleEntryChange(index, "converted_gross_pay", event.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-slate-200 font-mono"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.converted_loan_deduction}
                          placeholder={isCrossCurrency ? "Required" : "Optional"}
                          onChange={(event) =>
                            handleEntryChange(index, "converted_loan_deduction", event.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-slate-200 font-mono"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.converted_net_pay}
                          placeholder={isCrossCurrency ? "Required" : "Optional"}
                          onChange={(event) =>
                            handleEntryChange(index, "converted_net_pay", event.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-slate-200 font-mono"
                        />
                      </td>
                      <td className="p-4 text-xs text-slate-400">
                        <div>
                          Salary Tx: {entry.salary_transaction?.documentId || "-"}
                        </div>
                        <div>
                          Repay Tx: {entry.loan_repayment_transaction?.documentId || "-"}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-right text-sm text-slate-400">
        Total Net Pay: <span className="text-indigo-400 font-mono">{round2(totalNet).toFixed(2)}</span>
      </div>
    </div>
  );
};
