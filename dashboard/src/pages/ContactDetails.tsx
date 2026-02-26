import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Edit,
  Plus,
} from "lucide-react";
import { format } from "date-fns";
import { EditContactModal } from "../components/EditContactModal";
import { IssueLoanModal } from "../components/IssueLoanModal";

export const ContactDetailsPage = () => {
  const { id } = useParams();
  const [contact, setContact] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [payrollsMeta, setPayrollsMeta] = useState<any>(null);
  const [payrollPage, setPayrollPage] = useState(1);

  const [loans, setLoans] = useState<any[]>([]);
  const [loansMeta, setLoansMeta] = useState<any>(null);
  const [loanPage, setLoanPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isIssueLoanOpen, setIssueLoanOpen] = useState(false);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadPayrolls();
    }
  }, [id, payrollPage]);

  const loadPayrolls = async () => {
    try {
      const res = await api.get(
        `/payrolls/employee/${id}?pagination[page]=${payrollPage}&pagination[pageSize]=5`,
      );
      setPayrolls(res.data.data);
      setPayrollsMeta(res.data.meta);
    } catch (e) {
      console.error("Failed to load generic payrolls", e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch contact with nested loans for the dynamic zone
      const contactRes = await api.get(
        `/contacts/${id}?populate=contact_type.loans`,
      );
      const contactData = contactRes.data.data;
      setContact(contactData);

      // Extract loans from the dynamic zone if employee
      if (
        contactData.contact_type?.length > 0 &&
        contactData.contact_type[0].__component === "contact-type.employee"
      ) {
        const empLoans = contactData.contact_type[0].loans || [];
        setLoans(empLoans);
        // Client side pagination metadata mock since it's nested data
        setLoansMeta({
          pagination: {
            page: 1,
            pageSize: 10,
            pageCount: 1,
            total: empLoans.length,
          },
        });
      }

      const txRes = await api.get(
        `/transactions?filters[contact][$eq]=${id}&populate[0]=type.currency&sort=date_time:desc`,
      );
      setTransactions(txRes.data.data);

      const projRes = await api.get(
        `/projects?filters[contact][$eq]=${id}&populate=*`,
      );
      setProjects(projRes.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading)
    return <div className="text-slate-400 p-8">Loading contact details...</div>;
  if (!contact)
    return <div className="text-red-400 p-8">Contact not found.</div>;

  const getContactType = (contact: any) => {
    if (contact.contact_type && contact.contact_type.length > 0) {
      const comp = contact.contact_type[0].__component;
      if (comp === "contact-type.employee") return "Employee";
      if (comp === "contact-type.vendor") return "Vendor";
      if (comp === "contact-type.customer") return "Customer";
      return comp;
    }
    return "Unknown";
  };

  const contactTypeLabel = contact ? getContactType(contact) : "Unknown";
  const employeeData =
    contactTypeLabel === "Employee"
      ? contact.contact_type.find(
          (c: any) => c.__component === "contact-type.employee",
        )
      : null;
  const customerData =
    contactTypeLabel === "Customer"
      ? contact.contact_type.find(
          (c: any) => c.__component === "contact-type.customer",
        )
      : null;

  return (
    <div className="space-y-8 text-slate-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/contacts"
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <User className="text-indigo-500" />
              {contact.name}
            </h1>
            <p className="text-slate-400 mt-1">{contactTypeLabel} Profile</p>
          </div>
        </div>

        <button
          onClick={() => setEditModalOpen(true)}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-700 hover:border-slate-600"
        >
          <Edit size={16} /> Edit Contact
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-center">
          <div className="mb-6">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                contactTypeLabel === "Customer"
                  ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                  : contactTypeLabel === "Vendor"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              }`}
            >
              {contactTypeLabel}
            </span>
          </div>
          {contact.email && (
            <div className="flex items-center gap-3 mb-4 text-sm text-slate-300">
              <Mail size={16} className="text-slate-500" />
              <a
                href={`mailto:${contact.email}`}
                className="hover:text-indigo-400 transition-colors"
              >
                {contact.email}
              </a>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <Phone size={16} className="text-slate-500" />
              <a
                href={`tel:${contact.phone}`}
                className="hover:text-indigo-400 transition-colors"
              >
                {contact.phone}
              </a>
            </div>
          )}
          {!contact.email && !contact.phone && (
            <div className="text-slate-500 text-sm">
              No contact details provided.
            </div>
          )}

          {employeeData && (
            <div className="mt-6 pt-4 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">
                  Employee File
                </p>
                {employeeData.active !== undefined && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                      employeeData.active
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}
                  >
                    {employeeData.active ? "Active" : "Inactive"}
                  </span>
                )}
              </div>

              {employeeData.position && (
                <p className="text-sm text-slate-300">
                  <span className="text-slate-500 mr-2">Role:</span>
                  {employeeData.position}
                  {employeeData.department && (
                    <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-800 text-xs text-slate-400 border border-slate-700">
                      {employeeData.department}
                    </span>
                  )}
                </p>
              )}

              {employeeData.salary && (
                <p className="text-lg font-semibold text-white">
                  Base Salary:{" "}
                  {parseFloat(employeeData.salary).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}{" "}
                  <span className="text-sm text-slate-400 font-normal">
                    / mo
                  </span>
                </p>
              )}

              <div className="grid grid-cols-2 gap-y-2 gap-x-4 pt-3 mt-3 border-t border-slate-800/50">
                {employeeData.cnic && (
                  <div className="text-xs">
                    <span className="block text-slate-500 mb-0.5">CNIC</span>
                    <span className="text-slate-300 font-mono">
                      {employeeData.cnic}
                    </span>
                  </div>
                )}
                {employeeData.joining_date && (
                  <div className="text-xs">
                    <span className="block text-slate-500 mb-0.5">Joined</span>
                    <span className="text-slate-300">
                      {format(
                        new Date(employeeData.joining_date),
                        "MMM d, yyyy",
                      )}
                    </span>
                  </div>
                )}
                {employeeData.fuel_allowance && (
                  <div className="text-xs">
                    <span className="block text-slate-500 mb-0.5">Fuel</span>
                    <span className="text-slate-300">
                      ${parseFloat(employeeData.fuel_allowance).toFixed(2)}
                    </span>
                  </div>
                )}
                {employeeData.rental_allowance && (
                  <div className="text-xs">
                    <span className="block text-slate-500 mb-0.5">Rental</span>
                    <span className="text-slate-300">
                      ${parseFloat(employeeData.rental_allowance).toFixed(2)}
                    </span>
                  </div>
                )}
                {employeeData.gym_allowance && (
                  <div className="text-xs">
                    <span className="block text-slate-500 mb-0.5">Gym</span>
                    <span className="text-slate-300">
                      ${parseFloat(employeeData.gym_allowance).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          {customerData && (
            <div className="mt-6 pt-4 border-t border-slate-800">
              <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">
                Company Profile
              </p>
              {customerData.company_name && (
                <p className="text-sm font-semibold text-slate-300 mt-2">
                  {customerData.company_name}
                </p>
              )}
              {customerData.company_vat && (
                <p className="text-sm text-slate-400 mt-1">
                  VAT: {customerData.company_vat}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
            <FileText size={18} className="text-indigo-400" />
            <h2 className="text-lg font-medium text-white">Active Projects</h2>
          </div>
          {projects.length === 0 ? (
            <p className="text-slate-500 text-sm">
              No recorded projects for this contact.
            </p>
          ) : (
            <div className="space-y-4">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between items-center p-3 bg-slate-800/40 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors"
                >
                  <div>
                    <Link
                      to={`/projects/${p.id}`}
                      className="font-semibold text-indigo-300 hover:text-indigo-400 transition-colors"
                    >
                      {p.name}
                    </Link>
                    <span
                      className={`ml-3 text-xs font-semibold px-2 py-0.5 rounded-full border ${p.status === "Completed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}
                    >
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-white mb-4">
          Historical Transactions
        </h2>
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/50 text-sm font-medium text-slate-400">
                <th className="p-4">Date</th>
                <th className="p-4">Type</th>
                <th className="p-4">Note</th>
                <th className="p-4 text-right">Amount</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No payment history.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const comp = tx.type?.[0];
                  if (!comp) return null;
                  const isIncome = comp.__component === "type.income";
                  const isExpense = comp.__component === "type.expense";
                  const isTransfer = comp.__component === "type.transfer";
                  const amt = isTransfer ? comp.from_amount : comp.amount;

                  return (
                    <tr
                      key={tx.id}
                      className="border-b last:border-0 border-slate-800 hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="p-4 text-slate-300 font-medium whitespace-nowrap">
                        {format(new Date(tx.date_time), "MMM dd, yyyy")}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${
                            isIncome
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : isExpense
                                ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                          }`}
                        >
                          {isIncome && <ArrowDownRight size={14} />}
                          {isExpense && <ArrowUpRight size={14} />}
                          {isTransfer && <RefreshCw size={14} />}
                          {comp.__component.replace("type.", "")}
                        </span>
                      </td>
                      <td
                        className="p-4 text-slate-300 max-w-[200px] truncate"
                        title={tx.note}
                      >
                        {tx.note || "-"}
                      </td>
                      <td
                        className={`p-4 text-right font-medium whitespace-nowrap ${
                          isIncome ? "text-emerald-400" : "text-slate-200"
                        }`}
                      >
                        {comp.currency?.Symbol || ""}{" "}
                        {parseFloat(amt).toLocaleString()}
                      </td>
                      <td className="p-4 text-right">
                        <Link
                          to={`/ledger/${tx.documentId}`}
                          className="text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {contactTypeLabel === "Employee" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Loan History</h2>
              <button
                onClick={() => setIssueLoanOpen(true)}
                className="text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-md flex items-center gap-1 transition-colors text-slate-300"
              >
                <Plus size={16} /> Issue Loan
              </button>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="p-4 font-medium">Disbursed</th>
                    <th className="p-4 font-medium">Principal</th>
                    <th className="p-4 font-medium">Remaining</th>
                    <th className="p-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {loans.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-8 text-center text-slate-500"
                      >
                        No loan history found.
                      </td>
                    </tr>
                  ) : (
                    loans.map((ln) => (
                      <tr
                        key={ln.id}
                        className="hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="p-4 text-slate-300 whitespace-nowrap">
                          {format(
                            new Date(ln.disbursed_date || ln.createdAt),
                            "MMM dd, yyyy",
                          )}
                        </td>
                        <td className="p-4 text-slate-300">
                          $
                          {parseFloat(
                            ln.principal_amount || 0,
                          ).toLocaleString()}
                        </td>
                        <td className="p-4 text-amber-400 font-medium">
                          $
                          {parseFloat(
                            ln.remaining_balance || 0,
                          ).toLocaleString()}
                        </td>
                        <td className="p-4">
                          <span
                            className={`text-xs px-2 py-1 rounded font-medium ${ln.status === "Paid Off" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"}`}
                          >
                            {ln.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {loansMeta?.pagination?.pageCount > 1 && (
                <div className="p-4 border-t border-slate-800 flex justify-between items-center">
                  <button
                    disabled={loanPage === 1}
                    onClick={() => setLoanPage((p) => p - 1)}
                    className="text-sm text-slate-400 hover:text-white disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-500">
                    Page {loanPage} of {loansMeta.pagination.pageCount}
                  </span>
                  <button
                    disabled={loanPage === loansMeta.pagination.pageCount}
                    onClick={() => setLoanPage((p) => p + 1)}
                    className="text-sm text-slate-400 hover:text-white disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">
                Payroll History
              </h2>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="p-4 font-medium">Pay Period</th>
                    <th className="p-4 font-medium">Batch Status</th>
                    <th className="p-4 font-medium text-right">Net Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {payrolls.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="p-8 text-center text-slate-500"
                      >
                        No payroll history found.
                      </td>
                    </tr>
                  ) : (
                    payrolls.map((pr) => (
                      <tr
                        key={pr.id}
                        className="hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="p-4 text-slate-300">
                          {format(new Date(pr.pay_period_start), "MMM dd")} -{" "}
                          {format(new Date(pr.pay_period_end), "MMM dd, yyyy")}
                        </td>
                        <td className="p-4 text-slate-400 capitalize">
                          {pr.batch_status}
                        </td>
                        <td className="p-4 text-indigo-400 font-bold text-right">
                          $
                          {parseFloat(
                            pr.amount_to_transfer || 0,
                          ).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {payrollsMeta?.pagination?.pageCount > 1 && (
                <div className="p-4 border-t border-slate-800 flex justify-between items-center">
                  <button
                    disabled={payrollPage === 1}
                    onClick={() => setPayrollPage((p) => p - 1)}
                    className="text-sm text-slate-400 hover:text-white disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-500">
                    Page {payrollPage} of {payrollsMeta.pagination.pageCount}
                  </span>
                  <button
                    disabled={payrollPage === payrollsMeta.pagination.pageCount}
                    onClick={() => setPayrollPage((p) => p + 1)}
                    className="text-sm text-slate-400 hover:text-white disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <EditContactModal
          isOpen={isEditModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSuccess={() => {
            setEditModalOpen(false);
            loadData();
          }}
          contactId={contact.documentId}
          contactData={contact}
        />
      )}

      <IssueLoanModal
        isOpen={isIssueLoanOpen}
        onClose={() => setIssueLoanOpen(false)}
        onSuccess={() => {
          setIssueLoanOpen(false);
          loadData();
        }}
        defaultContactId={contact.id?.toString()}
      />
    </div>
  );
};
