"use client";

import { useEffect, useState } from "react";
import { getWallets, updateWallet, deleteWallet, type WalletOut } from "@/lib/api";
import { Wallet, Pencil, Trash2, Archive, ArchiveRestore, Check, X, AlertCircle } from "lucide-react";

function fmt(n: number) { return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n); }

export default function WalletsPage() {
  const [wallets, setWallets] = useState<WalletOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBalance, setEditBalance] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setWallets(await getWallets(showArchived));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить счета");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [showArchived]);

  const startEdit = (w: WalletOut) => {
    setEditId(w.id);
    setEditName(w.wallet_name || "");
    setEditBalance(String(w.opening_balance));
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName("");
    setEditBalance("");
  };

  const saveEdit = async (id: string) => {
    try {
      await updateWallet(id, {
        wallet_name: editName,
        opening_balance: parseFloat(editBalance) || 0,
      });
      cancelEdit();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    }
  };

  const toggleArchive = async (w: WalletOut) => {
    try {
      await updateWallet(w.id, { is_archived: !w.is_archived });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  };

  const handleDelete = async (w: WalletOut) => {
    if (!confirm(`Удалить счет "${w.wallet_name || w.account_number}" и все ${w.transaction_count} транзакций?`)) return;
    try {
      await deleteWallet(w.id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить");
    }
  };

  const totalBalance = wallets.filter(w => !w.is_archived).reduce((s, w) => s + w.current_balance, 0);

  return (
    <div className="max-w-[1100px]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Счета и кошельки</h1>
          <p className="text-sm text-gray-400 mt-1">Управление банковскими счетами и кассами</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          Показать архивные
        </label>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <div className="flex items-center gap-2"><AlertCircle size={16} /> {error}</div>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {/* Total balance card */}
      {wallets.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 mb-4">
          <p className="text-sm text-gray-500">Общий баланс</p>
          <p className={`text-2xl font-bold mt-1 ${totalBalance >= 0 ? "text-gray-900" : "text-red-600"}`}>
            {fmt(totalBalance)} <span className="text-base font-normal text-gray-400">₸</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">{wallets.filter(w => !w.is_archived).length} активных счетов</p>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Wallet size={15} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">Все счета</span>
          <span className="text-xs text-gray-400 ml-auto">{wallets.length}</span>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : wallets.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">Нет счетов. Загрузите первую выписку для автоматического создания счета.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Банк</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Название</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Номер счета</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Нач. остаток</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Транзакций</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Текущий баланс</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Действия</th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((w) => (
                  <tr key={w.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${w.is_archived ? "opacity-60" : ""}`}>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 uppercase">
                        {w.bank}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {editId === w.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded border border-indigo-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                      ) : (
                        <span className="font-medium text-gray-800">{w.wallet_name || "—"}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500 font-mono">{w.account_number}</td>
                    <td className="px-5 py-3 text-right">
                      {editId === w.id ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editBalance}
                          onChange={(e) => setEditBalance(e.target.value)}
                          className="w-32 rounded border border-indigo-300 px-2 py-1 text-sm text-right outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                      ) : (
                        <span className="text-gray-600 tabular-nums">{fmt(w.opening_balance)} ₸</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-gray-500 tabular-nums">{w.transaction_count}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`font-semibold tabular-nums ${w.current_balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {fmt(w.current_balance)} ₸
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {editId === w.id ? (
                          <>
                            <button onClick={() => saveEdit(w.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded">
                              <Check size={14} />
                            </button>
                            <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded">
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(w)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="Редактировать">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => toggleArchive(w)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded" title={w.is_archived ? "Восстановить" : "Архивировать"}>
                              {w.is_archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                            </button>
                            <button onClick={() => handleDelete(w)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Удалить">
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Счета создаются автоматически при загрузке банковской выписки. Здесь вы можете переименовать их и установить начальный остаток для расчета баланса.
      </p>
    </div>
  );
}
