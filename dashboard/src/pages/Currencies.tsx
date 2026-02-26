import { useEffect, useState } from "react";
import { Coins, Pencil, Plus, Save, X } from "lucide-react";
import { api } from "../lib/api";

type Currency = {
  id: number;
  documentId: string;
  code: string;
  name: string;
  symbol: string;
  is_active?: boolean;
};

export const CurrenciesPage = () => {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    void loadCurrencies();
  }, []);

  const loadCurrencies = async () => {
    setLoading(true);
    try {
      const response = await api.get("/currencies?sort=code:asc");
      setCurrencies(response.data?.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingCurrency(null);
    setCode("");
    setName("");
    setSymbol("");
    setIsActive(true);
    setModalOpen(true);
  };

  const openEditModal = (currency: Currency) => {
    setEditingCurrency(currency);
    setCode(currency.code || "");
    setName(currency.name || "");
    setSymbol(currency.symbol || "");
    setIsActive(currency.is_active !== false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCurrency(null);
  };

  const submit = async () => {
    if (!code.trim() || !name.trim() || !symbol.trim()) {
      alert("Code, name, and symbol are required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        symbol: symbol.trim(),
        is_active: isActive,
      };

      if (editingCurrency) {
        await api.put(`/currencies/${editingCurrency.documentId}`, { data: payload });
      } else {
        await api.post("/currencies", { data: payload });
      }

      closeModal();
      await loadCurrencies();
    } catch (error: any) {
      console.error(error);
      alert(error?.response?.data?.error?.message || "Failed to save currency.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Coins size={28} className="text-amber-400" /> Currencies
          </h1>
          <p className="text-slate-400 mt-1">Manage supported payroll and ledger currencies.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium"
        >
          <Plus size={18} /> Add Currency
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
              <th className="p-4 font-medium">Code</th>
              <th className="p-4 font-medium">Name</th>
              <th className="p-4 font-medium">Symbol</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  Loading currencies...
                </td>
              </tr>
            ) : currencies.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  No currencies configured.
                </td>
              </tr>
            ) : (
              currencies.map((currency) => (
                <tr key={currency.documentId} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-mono text-slate-200">{currency.code}</td>
                  <td className="p-4 text-slate-300">{currency.name}</td>
                  <td className="p-4 text-slate-300 font-mono">{currency.symbol}</td>
                  <td className="p-4">
                    <span
                      className={`text-xs px-2 py-1 rounded border ${currency.is_active === false ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}
                    >
                      {currency.is_active === false ? "Inactive" : "Active"}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => openEditModal(currency)}
                      className="text-slate-400 hover:text-indigo-300 transition-colors"
                      title="Edit currency"
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center p-6 border-b border-slate-800">
              <h2 className="text-xl font-semibold text-white">
                {editingCurrency ? "Edit Currency" : "Add Currency"}
              </h2>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Code</label>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="USD"
                  className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Name</label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="US Dollar"
                  className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Symbol</label>
                <input
                  value={symbol}
                  onChange={(event) => setSymbol(event.target.value)}
                  placeholder="$"
                  className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-600 bg-slate-800"
                />
                Active
              </label>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800">
              <button
                onClick={closeModal}
                className="px-4 py-2 font-medium text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void submit()}
                disabled={saving}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors inline-flex items-center gap-2"
              >
                <Save size={16} /> {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
