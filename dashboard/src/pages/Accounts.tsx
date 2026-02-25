import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Building2, Plus, Landmark } from "lucide-react";
import { AddAccountModal } from "../components/AddAccountModal";
import { Link } from "react-router-dom";

export const AccountsPage = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/accounts?populate=*");
      setAccounts(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 text-slate-200">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Accounts & Books</h1>
          <p className="text-slate-400 mt-1">
            Manage your bank accounts and cash wallets.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium"
        >
          <Plus size={18} /> Add Account
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : (
          accounts.map((acc) => (
            <Link
              to={`/accounts/${acc.documentId}`}
              key={acc.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-indigo-500/50 hover:bg-slate-800/50 transition-all block group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-indigo-500/10 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
                  <Building2 size={24} className="text-indigo-400" />
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 group-hover:border-slate-600">
                  {acc.currency?.Symbol || acc.currency?.Name || "N/A"}
                </span>
              </div>
              <h3
                className="font-semibold text-lg text-white truncate group-hover:text-indigo-300 transition-colors"
                title={acc.name}
              >
                {acc.name}
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Initial: {acc.initial_amount}
              </p>
              {acc.exclude_from_statistics && (
                <span className="inline-block mt-3 text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded">
                  Excluded from Stats
                </span>
              )}
            </Link>
          ))
        )}

        {!loading && accounts.length === 0 && (
          <div className="col-span-full p-12 text-center border-2 border-dashed border-slate-800 rounded-xl">
            <Landmark size={48} className="mx-auto text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              No accounts found
            </h3>
            <p className="text-slate-400 max-w-sm mx-auto mb-6">
              Create your first bank account or cash wallet to start tracking
              transactions.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 transition-colors font-medium"
            >
              <Plus size={18} /> Add Account
            </button>
          </div>
        )}
      </div>

      <AddAccountModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => loadData()}
      />
    </div>
  );
};
