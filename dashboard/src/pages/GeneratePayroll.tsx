import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { api } from "../lib/api";

export const GeneratePayrollPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);

  // Period state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("draft");

  // Form entries
  const [entries, setEntries] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [empRes, loanRes] = await Promise.all([
        // Deep filter using new Strapi syntax or fetch all employees
        api.get("/contacts?filters[type][$eq]=Employee&populate=*"),
        api.get("/loans?filters[status][$eq]=Active&populate=*"),
      ]);

      const fetchedEmployees = empRes.data.data || [];
      const fetchedLoans = loanRes.data.data || [];

      // Initialize entries state
      const initialEntries: Record<string, any> = {};
      fetchedEmployees.forEach((emp: any) => {
        // Find if they have an active loan
        const empLoan = fetchedLoans.find(
          (l: any) => l.employee && String(l.employee.id) === String(emp.id),
        );

        // Map configurations from contact-type component
        const empConfig =
          emp.contact_type?.find(
            (c: any) => c.__component === "contact-type.employee",
          ) || {};

        initialEntries[emp.id] = {
          base_salary: parseFloat(empConfig.salary) || 0,
          allowance_fuel: parseFloat(empConfig.fuel_allowance) || 0,
          allowance_gym: parseFloat(empConfig.gym_allowance) || 0,
          allowance_rental: parseFloat(empConfig.rental_allowance) || 0,
          bonus: 0,
          overtime: 0,
          loan_deduction: empLoan
            ? Math.min(
                parseFloat(empLoan.monthly_installment) || 0,
                parseFloat(empLoan.remaining_balance) || 0,
              )
            : 0,
          loan_ref: empLoan ? empLoan.id : null,
        };
      });

      setEmployees(fetchedEmployees);
      setLoans(fetchedLoans);
      setEntries(initialEntries);
    } catch (error) {
      console.error("Failed to load generic payroll data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEntryChange = (empId: string, field: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setEntries((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [field]: numValue,
      },
    }));
  };

  const calculateNetPay = (entry: any) => {
    const base = entry.base_salary;
    const additions =
      entry.allowance_fuel +
      entry.allowance_gym +
      entry.allowance_rental +
      entry.bonus +
      entry.overtime;
    const deductions = entry.loan_deduction;
    return base + additions - deductions;
  };

  const calculateTotalNetPay = () => {
    return Object.values(entries).reduce(
      (sum, entry) => sum + calculateNetPay(entry),
      0,
    );
  };

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      alert("Please select a valid pay period.");
      return;
    }

    setSubmitting(true);
    try {
      const employeeDetails = employees.map((emp) => {
        const entry = entries[emp.id];
        return {
          __component: "employee.employee",
          contact: emp.id,
          bonus: entry.bonus,
          overtime_amount: entry.overtime,
          loan_amount_to_deduct: entry.loan_deduction,
          fuel_allowance: entry.allowance_fuel,
          gym_allowance: entry.allowance_gym,
          rental_allowance: entry.allowance_rental,
          loan_ref: entry.loan_ref,
          amount_to_transfer: calculateNetPay(entry),
          payroll_status: status === "processed" ? "sent" : "draft",
        };
      });

      await api.post("/payrolls", {
        data: {
          pay_period_start: startDate,
          pay_period_end: endDate,
          payroll_status: status,
          employee_details: employeeDetails,
        },
      });

      navigate("/payroll");
    } catch (err) {
      console.error(err);
      alert("Failed to submit batch.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-slate-400 p-8 flex items-center justify-center h-full">
        Loading Employees...
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
          <h1 className="text-2xl font-bold text-white">
            Generate Payroll Batch
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right mr-4">
            <span className="text-sm font-medium text-slate-400 block">
              Total Est. Net Pay
            </span>
            <span className="text-xl font-bold text-indigo-400 font-mono">
              $
              {calculateTotalNetPay().toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-colors disabled:opacity-50"
          >
            <Save size={18} />
            {submitting ? "Processing..." : "Submit Batch"}
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-200 mb-4 border-b border-slate-800 pb-2">
          Batch Configuration
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">
              Period Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">
              Period End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">
              Initial Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="draft">Draft</option>
              <option value="processed">Processed (Paid)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                <th className="p-4 font-medium sticky left-0 bg-slate-950 z-10 w-48">
                  Employee
                </th>
                <th className="p-4 font-medium min-w-[120px]">Base Salary</th>
                <th className="p-4 font-medium min-w-[120px] text-emerald-400/80">
                  Allowances
                </th>
                <th className="p-4 font-medium min-w-[120px] text-emerald-400/80">
                  Bonus
                </th>
                <th className="p-4 font-medium min-w-[120px] text-emerald-400/80">
                  Overtime
                </th>
                <th className="p-4 font-medium min-w-[140px] text-red-400/80">
                  Loan Ded.
                </th>
                <th className="p-4 font-medium text-right min-w-[120px] sticky right-0 bg-slate-950 z-10">
                  Est. Net Pay
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No active employees found.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => {
                  const entry = entries[emp.id];
                  if (!entry) return null;

                  const allowancesTotal =
                    entry.allowance_fuel +
                    entry.allowance_rental +
                    entry.allowance_gym;

                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      <td className="p-4 font-medium text-slate-300 sticky left-0 bg-slate-900 group-hover:bg-slate-800/80 transition-colors">
                        {emp.name}
                        {entry.loan_ref && (
                          <span className="block text-[10px] text-orange-400 mt-1 uppercase font-semibold">
                            Active Loan Found
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          readOnly
                          value={entry.base_salary}
                          className="w-full bg-transparent border-none p-0 text-slate-400 font-mono text-sm focus:ring-0 cursor-not-allowed"
                        />
                      </td>
                      <td className="p-4" title="Fuel/Gym/Rent Configurations">
                        <input
                          type="number"
                          readOnly
                          value={allowancesTotal}
                          className="w-full bg-transparent border-none p-0 text-emerald-500/70 font-mono text-sm focus:ring-0 cursor-not-allowed"
                        />
                      </td>
                      <td className="p-4">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                            $
                          </span>
                          <input
                            type="number"
                            value={entry.bonus}
                            onChange={(e) =>
                              handleEntryChange(emp.id, "bonus", e.target.value)
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded-md py-1.5 pl-7 pr-2 text-emerald-400 font-mono text-sm focus:ring-1 focus:ring-indigo-500 outline-none hover:border-slate-600 transition-colors"
                          />
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                            $
                          </span>
                          <input
                            type="number"
                            value={entry.overtime}
                            onChange={(e) =>
                              handleEntryChange(
                                emp.id,
                                "overtime",
                                e.target.value,
                              )
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded-md py-1.5 pl-7 pr-2 text-emerald-400 font-mono text-sm focus:ring-1 focus:ring-indigo-500 outline-none hover:border-slate-600 transition-colors"
                          />
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                            $
                          </span>
                          <input
                            type="number"
                            value={entry.loan_deduction}
                            onChange={(e) =>
                              handleEntryChange(
                                emp.id,
                                "loan_deduction",
                                e.target.value,
                              )
                            }
                            className="w-full bg-red-950/20 border border-red-900/40 rounded-md py-1.5 pl-7 pr-2 text-red-400 font-mono text-sm focus:ring-1 focus:ring-red-500 outline-none hover:border-red-800 transition-colors"
                          />
                        </div>
                      </td>
                      <td className="p-4 font-bold text-indigo-400 font-mono text-right text-base sticky right-0 bg-slate-900 group-hover:bg-slate-800/80 transition-colors">
                        $
                        {calculateNetPay(entry).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
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
