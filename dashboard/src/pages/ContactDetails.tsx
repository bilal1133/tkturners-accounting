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
} from "lucide-react";
import { format } from "date-fns";

export const ContactDetailsPage = () => {
  const { id } = useParams();
  const [contact, setContact] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const contactRes = await api.get(`/contacts/${id}?populate=*`);
      setContact(contactRes.data.data);

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

  return (
    <div className="space-y-8 text-slate-200">
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
          <p className="text-slate-400 mt-1">
            {contact.type === "Client"
              ? "Client Profile"
              : contact.type === "Vendor"
                ? "Vendor Profile"
                : "Employee Profile"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-center">
          <div className="mb-6">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                contact.type === "Client"
                  ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                  : contact.type === "Vendor"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              }`}
            >
              {contact.type}
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

          {contact.type === "Employee" && contact.base_salary && (
            <div className="mt-6 pt-4 border-t border-slate-800">
              <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">
                Employee Details
              </p>
              <p className="text-lg font-semibold text-white mt-1">
                Base Salary:{" "}
                {parseFloat(contact.base_salary).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}{" "}
                / mo
              </p>
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
    </div>
  );
};
