import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Plus, ArrowUpRight, ArrowDownRight, RefreshCcw } from "lucide-react";
import { format } from "date-fns";
import { AddTransactionModal } from "../components/AddTransactionModal";

type Transaction = {
  id: number;
  documentId: string;
  date_time: string;
  note: string;
  payment_type: string;
  type: any[];
  contact?: { name: string };
  project?: { name: string };
  category?: { name: string };
};

const TypeIcon = ({ type }: { type: string }) => {
  if (type === "type.income")
    return <ArrowUpRight className="text-emerald-500" size={18} />;
  if (type === "type.expense")
    return <ArrowDownRight className="text-red-500" size={18} />;
  return <RefreshCcw className="text-blue-500" size={18} />;
};

const getAmount = (comps: any[]) => {
  if (!comps || comps.length === 0) return "-";
  const c = comps[0];
  if (c.__component === "type.transfer") {
    return `From: ${c.from_amount} | To: ${c.to_amount}`;
  }
  return c.amount || "-";
};

export const LedgerPage = () => {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      // populate the dynamic zone and relations
      const res = await api.get(
        "/transactions?populate[0]=contact&populate[1]=project&populate[2]=category&populate[3]=type.account&populate[4]=type.currency&populate[5]=type.from_account&populate[6]=type.to_account&sort=date_time:desc",
      );
      setTxs(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-200">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Transactions Ledger</h1>
          <p className="text-slate-400 mt-1">
            Manage and view all cash flow records.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium"
        >
          <Plus size={18} />
          New Transaction
        </button>
      </div>

      <AddTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => loadTransactions()}
      />

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800 border-b border-slate-700 text-slate-300 text-sm">
              <th className="p-4 font-medium">Date</th>
              <th className="p-4 font-medium">Type</th>
              <th className="p-4 font-medium">Category / Project</th>
              <th className="p-4 font-medium">Contact</th>
              <th className="p-4 font-medium">Payment Method</th>
              <th className="p-4 font-medium">Amount</th>
              <th className="p-4 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  Loading transactions...
                </td>
              </tr>
            ) : txs.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  No transactions found.
                </td>
              </tr>
            ) : (
              txs.map((tx) => (
                <tr
                  key={tx.id}
                  className="hover:bg-slate-800/50 transition-colors"
                >
                  <td className="p-4 whitespace-nowrap">
                    {format(new Date(tx.date_time), "MMM dd, yyyy")}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <TypeIcon type={tx.type?.[0]?.__component} />
                      <span className="capitalize">
                        {tx.type?.[0]?.__component?.replace("type.", "") ||
                          "Unknown"}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm">
                      <div className="text-slate-200">
                        {tx.category?.name || "-"}
                      </div>
                      <div className="text-slate-500 text-xs">
                        {tx.project?.name}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">{tx.contact?.name || "-"}</td>
                  <td className="p-4 text-sm text-slate-400">
                    {tx.payment_type || "-"}
                  </td>
                  <td className="p-4 font-medium font-mono text-slate-200">
                    {getAmount(tx.type)}
                  </td>
                  <td className="p-4 text-right">
                    <Link
                      to={`/ledger/${tx.documentId}`}
                      className="inline-flex items-center gap-1 text-indigo-400 font-medium hover:text-indigo-300 transition-colors"
                    >
                      View <ArrowUpRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
