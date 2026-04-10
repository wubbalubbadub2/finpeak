"use client";

import { useEffect, useState, useRef } from "react";
import { getTransactions, getCategories, updateTransaction } from "@/lib/api";
import type { TransactionOut, CategoryOut } from "@/lib/types";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

function fmtAmt(n: number) {
  const abs = Math.abs(n);
  const s = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: abs % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(abs);
  return n < 0 ? `−${s}` : `+${s}`;
}

export default function TransactionsPage() {
  const [txs, setTxs] = useState<TransactionOut[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [cats, setCats] = useState<CategoryOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const perPage = 30;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { getCategories().then(setCats).catch(console.error); }, []);
  useEffect(() => {
    setLoading(true);
    getTransactions({ page, per_page: perPage, search: search || undefined })
      .then(r => { setTxs(r.transactions); setTotal(r.total); })
      .catch(console.error).finally(() => setLoading(false));
  }, [page, search]);

  const onSearch = (v: string) => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => { setSearch(v); setPage(1); }, 300); };
  const onCat = async (id: string, cat: string) => { await updateTransaction(id, cat); setTxs(p => p.map(tx => tx.id === id ? { ...tx, category_name: cat, categorization_source: "manual" } : tx)); setEditId(null); };
  const pages = Math.ceil(total / perPage);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800">Транзакции</h1>
        <p className="text-sm text-gray-400 mt-1">{total} операций</p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text" placeholder="Поиск по контрагенту или описанию..." defaultValue={search} onChange={e => onSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
                <th className="text-right px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Сумма</th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Контрагент</th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Описание</th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Категория</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-16 text-center"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
              ) : txs.length === 0 ? (
                <tr><td colSpan={5} className="py-16 text-center text-sm text-gray-400">Транзакции не найдены</td></tr>
              ) : txs.map((tx) => (
                <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                  <td className="px-5 py-3 text-sm text-gray-500 whitespace-nowrap font-mono">{tx.date}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <span className={`text-sm font-semibold font-mono ${tx.signed_amount >= 0 ? "text-emerald-600" : "text-gray-800"}`}>
                      {fmtAmt(tx.signed_amount)}
                    </span>
                    <span className="text-xs text-gray-400 ml-0.5">₸</span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-700 max-w-[200px] truncate">{tx.counterparty}</td>
                  <td className="px-5 py-3 text-sm text-gray-500 max-w-[260px] truncate">{tx.payment_description}</td>
                  <td className="px-5 py-3">
                    {editId === tx.id ? (
                      <select autoFocus value={tx.category_name || ""} onChange={e => onCat(tx.id, e.target.value)} onBlur={() => setEditId(null)}
                        className="text-xs rounded-lg border border-indigo-300 bg-white px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-100 w-full max-w-[200px]">
                        <option value="">Без категории</option>
                        {cats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    ) : (
                      <button onClick={() => setEditId(tx.id)}
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
                          tx.category_name ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-amber-50 text-amber-600 hover:bg-amber-100"
                        }`}>
                        {tx.category_name || "Без категории"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50">
            <span className="text-xs text-gray-400">{(page-1)*perPage+1}–{Math.min(page*perPage, total)} из {total}</span>
            <div className="flex items-center gap-1">
              <button disabled={page<=1} onClick={() => setPage(page-1)} className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 transition"><ChevronLeft size={16} className="text-gray-500" /></button>
              <span className="text-xs text-gray-500 px-3 tabular-nums">{page} / {pages}</span>
              <button disabled={page>=pages} onClick={() => setPage(page+1)} className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 transition"><ChevronRight size={16} className="text-gray-500" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
