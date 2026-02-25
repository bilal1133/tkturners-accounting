import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import {
  Building2,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Landmark,
} from "lucide-react";
import { format } from "date-fns";

export const AccountDetailsPage = () => {
  const { id } = useParams();
  const [account, setAccount] = useState<any>(null);
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
      // Fetch Account Details
      const accRes = await api.get(`/accounts/${id}?populate=*`);
      setAccount(accRes.data.data);

      // Fetch related transactions
      const txRes = await api.get(
        `/transactions?populate[0]=contact&populate[1]=project&populate[2]=category&populate[3]=type.account&populate[4]=type.currency&populate[5]=type.from_account&populate[6]=type.to_account&sort=date_time:desc`,
      );
      const allTxs = txRes.data.data;

      const accountDocId = id;
      const filteredTxs = allTxs.filter((tx: any) => {
        const comp = tx.type?.[0];
        if (!comp) return false;
        if (comp.__component === "type.transfer") {
          return (
            comp.from_account?.documentId === accountDocId ||
            comp.to_account?.documentId === accountDocId
          );
        }
        return comp.account?.documentId === accountDocId;
      });
      setTransactions(filteredTxs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading)
    return <div className="text-slate-400 p-8">Loading account details...</div>;
  if (!account)
    return <div className="text-red-400 p-8">Account not found.</div>;

  const symbol = account.currency?.Symbol || account.currency?.Name || "";
  const initial = parseFloat(account.initial_amount) || 0;

  let currentBalance = initial;
  const accountDocId = id;

  transactions.forEach((tx) => {
    const comp = tx.type?.[0];
    if (!comp) return;

    if (comp.__component === "type.income") {
      currentBalance += parseFloat(comp.amount) || 0;
    } else if (comp.__component === "type.expense") {
      currentBalance -= parseFloat(comp.amount) || 0;
    } else if (comp.__component === "type.transfer") {
      if (comp.from_account?.documentId === accountDocId)
        currentBalance -= parseFloat(comp.from_amount) || 0;
      if (comp.to_account?.documentId === accountDocId)
        currentBalance += parseFloat(comp.to_amount) || 0;
    }
  });

  return (
    <div className="space-y-8 text-slate-200">
      <div className="flex items-center gap-4">
        <Link
          to="/accounts"
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Landmark className="text-indigo-500" />
            {account.name}
          </h1>
          <p className="text-slate-400 mt-1">Account Statement & Details</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-sm font-medium text-slate-400 mb-1">
            Current Balance
          </h3>
          <p className="text-4xl font-bold text-white">
            {symbol}{" "}
            {currentBalance.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </p>
          <div className="mt-4 flex gap-4 text-sm text-slate-400">
            <div>
              Initial:{" "}
              <span className="text-slate-200">
                {symbol} {initial.toLocaleString()}
              </span>
            </div>
            <div>
              Currency:{" "}
              <span className="text-slate-200">
                {account.currency?.Name || "Unknown"}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-center items-start">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Building2 className="text-indigo-400" size={20} />
            </div>
            <span className="text-lg font-medium text-white">
              {account.name}
            </span>
          </div>
          {account.exclude_from_statistics && (
            <span className="inline-block mt-2 text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded">
              Excluded from Global Statistics
            </span>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-white mb-4">
          Transaction History
        </h2>
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/50 text-sm font-medium text-slate-400">
                <th className="p-4">Date</th>
                <th className="p-4">Type</th>
                <th className="p-4">Description</th>
                <th className="p-4 text-right">Amount</th>
                <th className="p-4 rounded-tr-xl"></th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No transactions recorded for this account.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const comp = tx.type?.[0];
                  if (!comp) return null;
                  const isIncome = comp.__component === "type.income";
                  const isExpense = comp.__component === "type.expense";
                  const isTransfer = comp.__component === "type.transfer";

                  let amt = 0;
                  let isPositive = false;
                  if (isIncome) {
                    amt = comp.amount;
                    isPositive = true;
                  }
                  if (isExpense) {
                    amt = comp.amount;
                    isPositive = false;
                  }
                  if (isTransfer) {
                    if (comp.to_account?.documentId === accountDocId) {
                      amt = comp.to_amount;
                      isPositive = true;
                    } else {
                      amt = comp.from_amount;
                      isPositive = false;
                    }
                  }

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
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
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
                          <span className="capitalize">
                            {comp.__component.replace("type.", "")}
                          </span>
                        </span>
                      </td>
                      <td
                        className="p-4 text-slate-300 max-w-[200px] truncate"
                        title={tx.note}
                      >
                        {tx.note || "-"}
                      </td>
                      <td
                        className={`p-4 text-right font-medium whitespace-nowrap ${isPositive ? "text-emerald-400" : "text-slate-200"}`}
                      >
                        {isPositive ? "+" : "-"} {Number(amt).toLocaleString()}
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
