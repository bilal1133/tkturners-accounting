import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Receipt,
  Banknote,
  Tag,
  FolderGit2,
  UserCog,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";

export const TransactionDetailsPage = () => {
  const { id } = useParams();
  const [tx, setTx] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get(
        `/transactions/${id}?populate[0]=contact&populate[1]=project&populate[2]=category&populate[3]=type.account&populate[4]=type.currency&populate[5]=type.from_account&populate[6]=type.to_account`,
      );
      setTx(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading)
    return (
      <div className="text-slate-400 p-8">Loading transaction details...</div>
    );
  if (!tx)
    return <div className="text-red-400 p-8">Transaction not found.</div>;

  const comp = tx.type?.[0] || {};
  const isIncome = comp.__component === "type.income";
  const isExpense = comp.__component === "type.expense";
  const isTransfer = comp.__component === "type.transfer";

  const symbol = comp.currency?.Symbol || comp.currency?.Name || "";
  const amountToDisplay = isTransfer
    ? parseFloat(comp.from_amount)
    : parseFloat(comp.amount);
  const typeLabel = comp.__component?.replace("type.", "") || "Unknown";

  return (
    <div className="space-y-8 text-slate-200 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link
          to="/ledger"
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white">
              Transaction Record #{tx.id}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border capitalize ${
                isIncome
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                  : isExpense
                    ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                    : "bg-blue-500/10 text-blue-500 border-blue-500/20"
              }`}
            >
              {isIncome && <ArrowDownRight size={16} />}
              {isExpense && <ArrowUpRight size={16} />}
              {isTransfer && <RefreshCw size={16} />}
              {typeLabel}
            </span>
          </div>
          <p className="text-slate-400 mt-1 flex items-center gap-2">
            <Calendar size={14} /> Recorded on{" "}
            {format(new Date(tx.date_time), "MMM dd, yyyy h:mm a")}
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-8 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-2">
              Amount
            </h2>
            <div
              className={`text-5xl font-bold ${isIncome ? "text-emerald-400" : isExpense ? "text-rose-400" : "text-blue-400"}`}
            >
              {symbol}{" "}
              {amountToDisplay?.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="text-slate-300 mt-3 text-lg">
              {tx.note || "No description provided"}
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4 min-w-[200px]">
            <h3 className="text-xs font-semibold uppercase text-slate-500 mb-3">
              Ledger Impact
            </h3>
            {isTransfer ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">From:</span>
                  <span className="font-medium">
                    {comp.from_account?.name || "Unknown"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">To:</span>
                  <span className="font-medium">
                    {comp.to_account?.name || "Unknown"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">
                    {isIncome ? "Deposited To:" : "Withdrawn From:"}
                  </span>
                  <span className="font-medium">
                    {comp.account?.name || "Unknown"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">
                    {isIncome ? "Received From:" : "Paid To:"}
                  </span>
                  <span className="font-medium">
                    {tx.contact?.name || "N/A"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 bg-slate-800/20">
          <h3 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">
            Additional Metadata
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-800 rounded-lg text-slate-400">
                <Tag size={18} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Category</p>
                <p className="text-sm text-slate-300 font-medium mt-0.5">
                  {tx.category?.name || "Uncategorized"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-800 rounded-lg text-slate-400">
                <FolderGit2 size={18} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">
                  Project Tag
                </p>
                {tx.project ? (
                  <Link
                    to={`/projects/${tx.project.documentId}`}
                    className="text-sm text-indigo-400 hover:text-indigo-300 font-medium mt-0.5 inline-flex items-center gap-1 transition-colors"
                  >
                    {tx.project.name} <ArrowUpRight size={12} />
                  </Link>
                ) : (
                  <p className="text-sm text-slate-500 mt-0.5">None</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-800 rounded-lg text-slate-400">
                <UserCog size={18} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">
                  Associated Contact
                </p>
                {tx.contact ? (
                  <Link
                    to={`/contacts/${tx.contact.documentId}`}
                    className="text-sm text-indigo-400 hover:text-indigo-300 font-medium mt-0.5 inline-flex items-center gap-1 transition-colors"
                  >
                    {tx.contact.name} <ArrowUpRight size={12} />
                  </Link>
                ) : (
                  <p className="text-sm text-slate-500 mt-0.5">None</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-800 rounded-lg text-slate-400">
                <Banknote size={18} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">
                  Payment Type
                </p>
                <p className="text-sm text-slate-300 font-medium mt-0.5">
                  {tx.payment_type || "Unknown"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-800 rounded-lg text-slate-400">
                <Receipt size={18} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Attachment</p>
                {tx.Attachment ? (
                  <a
                    href={`http://localhost:1338${tx.Attachment.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-indigo-400 hover:text-indigo-300 font-medium mt-0.5 inline-flex items-center gap-1 transition-colors"
                  >
                    View Receipt <ArrowUpRight size={12} />
                  </a>
                ) : (
                  <p className="text-sm text-slate-500 mt-0.5">No Attachment</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
