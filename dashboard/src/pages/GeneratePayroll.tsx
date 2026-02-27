import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { api } from "../lib/api";
import { currencyCode, currencyLabel, currencySymbol } from "../lib/currency";

type Employee = {
  id: number;
  documentId?: string;
  name: string;
  department: string;
  config: any;
  currency: any;
};

type Account = {
  id: number;
  name: string;
  documentId: string;
  currency?: any;
};

type Entry = {
  base_salary: number;
  allowance_fuel: number;
  allowance_gym: number;
  allowance_rental: number;
  bonus: number;
  overtime: number;
  gross_pay: number;
  loan_deduction: number;
  loan_ref: number | null;
  payee_account: number | null;
  converted_gross_pay: string;
  converted_loan_deduction: string;
  converted_net_pay: string;
};

const toNumber = (value: string | number | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const parseIsoDateStrict = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  const isSameDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  return isSameDate ? date : null;
};

const openDatePicker = (event: { currentTarget: HTMLInputElement }) => {
  const input = event.currentTarget as HTMLInputElement & {
    showPicker?: () => void;
  };
  input.showPicker?.();
};

const calculateComponentGross = (entry: Pick<
  Entry,
  | "base_salary"
  | "allowance_fuel"
  | "allowance_gym"
  | "allowance_rental"
  | "bonus"
  | "overtime"
>) =>
  round2(
    entry.base_salary +
      entry.allowance_fuel +
      entry.allowance_gym +
      entry.allowance_rental +
      entry.bonus +
      entry.overtime,
  );

export const GeneratePayrollPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [entries, setEntries] = useState<Record<string, Entry>>({});

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empRes, loanRes, accountRes] = await Promise.all([
        api.get(
          "/contacts?populate[0]=contact_type&populate[1]=contact_type.currency&pagination[pageSize]=500&status=published",
        ),
        api.get("/loans?filters[status][$eq]=Active&populate=*"),
        api.get("/accounts?populate=currency"),
      ]);

      const allContacts = empRes.data?.data ?? [];
      const activeLoans = loanRes.data?.data ?? [];
      const loadedAccounts = (accountRes.data?.data ?? []) as Account[];

      const activeEmployees: Employee[] = allContacts
        .map((contact: any) => {
          const employeeConfig = (contact.contact_type ?? []).find(
            (entry: any) => entry.__component === "contact-type.employee",
          );

          if (!employeeConfig || employeeConfig.active === false) return null;

          return {
            id: contact.id,
            documentId: contact.documentId,
            name: contact.name,
            department: employeeConfig.department || "Unassigned",
            config: employeeConfig,
            currency: employeeConfig.currency || null,
          } as Employee;
        })
        .filter(Boolean);

      const initialEntries: Record<string, Entry> = {};

      activeEmployees.forEach((employee) => {
        const activeLoan = activeLoans.find(
          (loan: any) => Number(loan?.employee?.id) === Number(employee.id),
        );

        const monthlyDeduction = activeLoan
          ? Math.min(
              toNumber(activeLoan.monthly_installment),
              toNumber(activeLoan.remaining_balance),
            )
          : 0;

        const base_salary = toNumber(employee.config?.salary);
        const allowance_fuel = toNumber(employee.config?.fuel_allowance);
        const allowance_gym = toNumber(employee.config?.gym_allowance);
        const allowance_rental = toNumber(employee.config?.rental_allowance);
        const bonus = 0;
        const overtime = 0;

        initialEntries[String(employee.id)] = {
          base_salary,
          allowance_fuel,
          allowance_gym,
          allowance_rental,
          bonus,
          overtime,
          gross_pay: calculateComponentGross({
            base_salary,
            allowance_fuel,
            allowance_gym,
            allowance_rental,
            bonus,
            overtime,
          }),
          loan_deduction: round2(monthlyDeduction),
          loan_ref: activeLoan?.id || null,
          payee_account: null,
          converted_gross_pay: "",
          converted_loan_deduction: "",
          converted_net_pay: "",
        };
      });

      setEmployees(activeEmployees);
      setAccounts(loadedAccounts);
      setEntries(initialEntries);
    } catch (error) {
      console.error("Failed to load payroll dependencies", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = useMemo(
    () =>
      departmentFilter === "All"
        ? employees
        : employees.filter((employee) => employee.department === departmentFilter),
    [departmentFilter, employees],
  );

  const calculateNet = (entry: Entry) => round2(entry.gross_pay - entry.loan_deduction);

  const calculateTotalNetPay = () =>
    filteredEmployees.reduce((sum, employee) => {
      const entry = entries[String(employee.id)];
      if (!entry) return sum;
      return sum + calculateNet(entry);
    }, 0);

  const handleEntryChange = (
    employeeId: number,
    field: keyof Entry,
    value: string,
  ) => {
    setEntries((prev) => {
      const current = prev[String(employeeId)];
      if (!current) return prev;

      const next = { ...current };

      if (field === "payee_account" || field === "loan_ref") {
        const parsed = Number.parseInt(value, 10);
        (next as any)[field] = Number.isInteger(parsed) ? parsed : null;
      } else if (
        field === "converted_gross_pay" ||
        field === "converted_loan_deduction" ||
        field === "converted_net_pay"
      ) {
        (next as any)[field] = value;
      } else {
        (next as any)[field] = round2(Math.max(0, toNumber(value)));
      }

      if (
        field === "base_salary" ||
        field === "allowance_fuel" ||
        field === "allowance_gym" ||
        field === "allowance_rental" ||
        field === "bonus" ||
        field === "overtime"
      ) {
        next.gross_pay = calculateComponentGross(next);
      }

      return {
        ...prev,
        [String(employeeId)]: next,
      };
    });
  };

  const getAccount = (accountId: number | null) =>
    accounts.find((account) => account.id === accountId) || null;

  const submitDraft = async () => {
    const missingFields: string[] = [];
    if (!startDate) missingFields.push("Pay period start");
    if (!endDate) missingFields.push("Pay period end");
    if (!payDate) missingFields.push("Pay date");

    if (missingFields.length > 0) {
      alert(`${missingFields.join(", ")} ${missingFields.length > 1 ? "are" : "is"} required.`);
      return;
    }

    const start = parseIsoDateStrict(startDate);
    const end = parseIsoDateStrict(endDate);
    const pay = parseIsoDateStrict(payDate);

    if (!start || !end || !pay) {
      alert(
        "Please enter valid calendar dates. Example: February does not have a 30th day.",
      );
      return;
    }

    if (start > end) {
      alert("Pay period start cannot be later than pay period end.");
      return;
    }

    const employeeDetails = filteredEmployees.map((employee) => {
      const entry = entries[String(employee.id)];
      const gross = round2(entry.gross_pay);
      const net = calculateNet(entry);
      const payeeAccount = getAccount(entry.payee_account);

      return {
        employee_name: employee.name,
        contact: employee.id,
        payee_account: payeeAccount?.id ?? entry.payee_account,
        loan_ref: entry.loan_ref,
        bonus: round2(entry.bonus),
        overtime_amount: round2(entry.overtime),
        fuel_allowance: round2(entry.allowance_fuel),
        gym_allowance: round2(entry.allowance_gym),
        rental_allowance: round2(entry.allowance_rental),
        gross_pay: gross,
        loan_amount_to_deduct: round2(entry.loan_deduction),
        net_pay: net,
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
        payroll_status: "draft",
      };
    });

    setSubmitting(true);
    try {
      const response = await api.post("/payrolls", {
        data: {
          pay_period_start: startDate,
          pay_period_end: endDate,
          pay_date: payDate,
          employee_details: employeeDetails,
        },
      });

      const documentId = response.data?.data?.documentId;
      if (documentId) {
        navigate(`/payrolls/${documentId}`);
      } else {
        navigate("/payroll");
      }
    } catch (error) {
      console.error(error);
      alert("Failed to save payroll draft.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-slate-400 p-8 flex items-center justify-center h-full">
        Loading employees...
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/payroll")}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors border border-transparent hover:border-slate-700"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-white">Create Payroll Draft</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right mr-4">
            <span className="text-sm font-medium text-slate-400 block">Total Est. Net Pay</span>
            <span className="text-xl font-bold text-indigo-400 font-mono">
              {round2(calculateTotalNetPay()).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <button
            onClick={submitDraft}
            disabled={submitting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-colors disabled:opacity-50"
          >
            <Save size={18} />
            {submitting ? "Saving..." : "Save Draft"}
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-200 mb-4 border-b border-slate-800 pb-2">
          Batch Configuration
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Period Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              onFocus={openDatePicker}
              onClick={openDatePicker}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Period End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              onFocus={openDatePicker}
              onClick={openDatePicker}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Pay Date</label>
            <input
              type="date"
              value={payDate}
              onChange={(event) => setPayDate(event.target.value)}
              onFocus={openDatePicker}
              onClick={openDatePicker}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Department Filter</label>
            <select
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="All">All Departments</option>
              <option value="Management">Management</option>
              <option value="Engineering">Engineering</option>
              <option value="HouseKeeping">HouseKeeping</option>
              <option value="Marketing">Marketing</option>
              <option value="Bussiness Development">Business Development</option>
              <option value="Unassigned">Unassigned</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                <th className="p-4 font-medium sticky left-0 bg-slate-950 z-10 w-56">Employee</th>
                <th className="p-4 font-medium min-w-[140px]">Payout Account</th>
                <th className="p-4 font-medium min-w-[120px]">Base Salary</th>
                <th className="p-4 font-medium min-w-[120px]">Fuel</th>
                <th className="p-4 font-medium min-w-[120px]">Rental</th>
                <th className="p-4 font-medium min-w-[120px]">Gym</th>
                <th className="p-4 font-medium min-w-[120px]">Bonus</th>
                <th className="p-4 font-medium min-w-[120px]">Overtime</th>
                <th className="p-4 font-medium min-w-[130px]">Gross Pay</th>
                <th className="p-4 font-medium min-w-[120px] text-red-400/80">Loan Deduction</th>
                <th className="p-4 font-medium min-w-[160px]">Converted Gross</th>
                <th className="p-4 font-medium min-w-[170px]">Converted Deduction</th>
                <th className="p-4 font-medium min-w-[140px]">Converted Net</th>
                <th className="p-4 font-medium text-right min-w-[120px] sticky right-0 bg-slate-950 z-10">Net Pay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={14} className="p-8 text-center text-slate-500">
                    No active employees found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => {
                  const entry = entries[String(employee.id)];
                  if (!entry) return null;

                  const net = calculateNet(entry);
                  const selectedAccount = getAccount(entry.payee_account);
                  const employeeCurrency = employee.currency;
                  const accountCurrency = selectedAccount?.currency || null;
                  const isCrossCurrency =
                    employeeCurrency?.id &&
                    accountCurrency?.id &&
                    Number(employeeCurrency.id) !== Number(accountCurrency.id);

                  return (
                    <tr key={employee.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="p-4 font-medium text-slate-300 sticky left-0 bg-slate-900 group-hover:bg-slate-800/80 transition-colors">
                        <div className="flex flex-col">
                          <span>{employee.name}</span>
                          <span className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">
                            {employee.department}
                          </span>
                          <span className="text-[10px] text-slate-500 mt-0.5">
                            {currencyLabel(employeeCurrency) || "No employee currency"}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <select
                          value={entry.payee_account ?? ""}
                          onChange={(event) =>
                            handleEntryChange(
                              employee.id,
                              "payee_account",
                              event.target.value,
                            )
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-slate-200 text-sm"
                        >
                          <option value="">Select account</option>
                          {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.name} {currencyCode(account.currency) ? `(${currencyCode(account.currency)})` : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.base_salary}
                          onChange={(event) =>
                            handleEntryChange(employee.id, "base_salary", event.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-md py-1.5 px-2 text-slate-200 font-mono text-sm"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.allowance_fuel}
                          onChange={(event) =>
                            handleEntryChange(employee.id, "allowance_fuel", event.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-md py-1.5 px-2 text-slate-200 font-mono text-sm"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.allowance_rental}
                          onChange={(event) =>
                            handleEntryChange(employee.id, "allowance_rental", event.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-md py-1.5 px-2 text-slate-200 font-mono text-sm"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.allowance_gym}
                          onChange={(event) =>
                            handleEntryChange(employee.id, "allowance_gym", event.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-md py-1.5 px-2 text-slate-200 font-mono text-sm"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.bonus}
                          onChange={(event) =>
                            handleEntryChange(employee.id, "bonus", event.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-md py-1.5 px-2 text-slate-200 font-mono text-sm"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.overtime}
                          onChange={(event) =>
                            handleEntryChange(employee.id, "overtime", event.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-md py-1.5 px-2 text-slate-200 font-mono text-sm"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.gross_pay}
                          onChange={(event) =>
                            handleEntryChange(employee.id, "gross_pay", event.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-md py-1.5 px-2 text-slate-200 font-mono text-sm"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.loan_deduction}
                          onChange={(event) =>
                            handleEntryChange(employee.id, "loan_deduction", event.target.value)
                          }
                          className="w-full bg-red-950/20 border border-red-900/40 rounded-md py-1.5 px-2 text-red-300 font-mono text-sm"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={isCrossCurrency ? "Required" : "Optional"}
                          value={entry.converted_gross_pay}
                          onChange={(event) =>
                            handleEntryChange(
                              employee.id,
                              "converted_gross_pay",
                              event.target.value,
                            )
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-md py-1.5 px-2 text-slate-200 font-mono text-sm"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={isCrossCurrency ? "Required" : "Optional"}
                          value={entry.converted_loan_deduction}
                          onChange={(event) =>
                            handleEntryChange(
                              employee.id,
                              "converted_loan_deduction",
                              event.target.value,
                            )
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-md py-1.5 px-2 text-slate-200 font-mono text-sm"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={isCrossCurrency ? "Required" : "Optional"}
                          value={entry.converted_net_pay}
                          onChange={(event) =>
                            handleEntryChange(
                              employee.id,
                              "converted_net_pay",
                              event.target.value,
                            )
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-md py-1.5 px-2 text-slate-200 font-mono text-sm"
                        />
                      </td>
                      <td className="p-4 font-bold text-indigo-400 font-mono text-right text-base sticky right-0 bg-slate-900 group-hover:bg-slate-800/80 transition-colors">
                        {currencySymbol(employeeCurrency)}{net.toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
