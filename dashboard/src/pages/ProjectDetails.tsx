import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import {
  ArrowLeft,
  FolderGit2,
  User,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  BarChart3,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { format } from "date-fns";
import { currencySymbol } from "../lib/currency";

export const ProjectDetailsPage = () => {
  const { id } = useParams();
  const [project, setProject] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const projRes = await api.get(`/projects/${id}?populate=*`);
      setProject(projRes.data.data);

      const txRes = await api.get(
        `/transactions?filters[project][$eq]=${id}&populate[0]=type.currency&sort=date_time:desc`,
      );
      setTransactions(txRes.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading)
    return <div className="text-slate-400 p-8">Loading project details...</div>;
  if (!project)
    return <div className="text-red-400 p-8">Project not found.</div>;

  let totalIncome = 0;
  let totalExpense = 0;

  transactions.forEach((tx) => {
    const comp = tx.type?.[0];
    if (!comp) return;
    const isIncome = comp.__component === "type.income";
    const isExpense = comp.__component === "type.expense";

    if (isIncome) totalIncome += parseFloat(comp.amount) || 0;
    if (isExpense) totalExpense += parseFloat(comp.amount) || 0;
  });

  const profitability = totalIncome - totalExpense;
  const isProfitable = profitability >= 0;

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
            <FolderGit2 className="text-indigo-500" />
            {project.name}
          </h1>
          <p className="text-slate-400 mt-1 flex items-center gap-2">
            Project Overview and Profitability Tracker
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-center">
          <div className="mb-4">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                project.status === "Completed"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : project.status === "Cancelled"
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              }`}
            >
              {project.status}
            </span>
          </div>

          {project.contact ? (
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <User size={16} className="text-slate-500" />
              <span>
                Client:{" "}
                <Link
                  to={`/contacts/${project.contact.id}`}
                  className="text-indigo-400 hover:underline"
                >
                  {project.contact.name}
                </Link>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <User size={16} />
              <span>No client linked</span>
            </div>
          )}
          {project.description && (
            <p className="mt-4 text-sm text-slate-400">{project.description}</p>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <TrendingUp className="text-emerald-400" size={20} />
            </div>
            <h3 className="text-sm font-medium text-slate-400">Total Income</h3>
          </div>
          <p className="text-3xl font-bold text-emerald-400 mt-2">
            {totalIncome.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-rose-500/10 rounded-lg">
              <TrendingDown className="text-rose-400" size={20} />
            </div>
            <h3 className="text-sm font-medium text-slate-400">
              Total Expenses
            </h3>
          </div>
          <p className="text-3xl font-bold text-rose-400 mt-2">
            {totalExpense.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </p>
        </div>

        <div
          className={`border rounded-xl p-6 shadow-sm ${isProfitable ? "bg-indigo-500/5 border-indigo-500/20" : "bg-rose-500/5 border-rose-500/20"}`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`p-2 rounded-lg ${isProfitable ? "bg-indigo-500/20 text-indigo-400" : "bg-rose-500/20 text-rose-400"}`}
            >
              <BarChart3 size={20} />
            </div>
            <h3
              className={`text-sm font-medium ${isProfitable ? "text-indigo-400" : "text-rose-400"}`}
            >
              Net Profitability
            </h3>
          </div>
          <p
            className={`text-3xl font-bold mt-2 ${isProfitable ? "text-white" : "text-white"}`}
          >
            {isProfitable ? "+" : ""}
            {profitability.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-white mb-4">
          Project Ledger
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
                    No transactions recorded for this project yet.
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
                          isIncome
                            ? "text-emerald-400"
                            : isExpense
                              ? "text-rose-400"
                              : "text-slate-200"
                        }`}
                      >
                        {currencySymbol(comp.currency)}{" "}
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
