"use client";

import { useState, useCallback } from "react";
import { uploadPDF } from "@/lib/api";
import type { UploadResponse } from "@/lib/types";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";

function fmtAmt(n: number) {
  const abs = Math.abs(n);
  const s = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: abs % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(abs);
  return n < 0 ? `−${s}` : `+${s}`;
}

export default function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handle = useCallback(async (file: File) => {
    if (!file.name.endsWith(".pdf")) { setError("Принимаются только PDF файлы"); return; }
    setUploading(true); setError(null); setResult(null);
    try { setResult(await uploadPDF(file)); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Ошибка загрузки"); }
    finally { setUploading(false); }
  }, []);

  return (
    <div className="max-w-[860px]">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800">Загрузка выписки</h1>
        <p className="text-sm text-gray-400 mt-1">Загрузите PDF выписку из банка для автоматической обработки</p>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handle(f); }}
        className={`rounded-2xl border-2 border-dashed p-6 md:p-12 text-center transition-all ${
          dragging ? "border-indigo-400 bg-indigo-50" : "border-gray-200 bg-white hover:border-gray-300"
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Обработка файла...</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center w-14 h-14 bg-gray-100 rounded-xl mx-auto mb-4">
              <Upload size={22} className="text-gray-400" />
            </div>
            <p className="text-base font-medium text-gray-700">Перетащите PDF файл сюда</p>
            <p className="text-sm text-gray-400 mt-1 mb-4">Kaspi, Halyk, Jusan, ForteBank</p>
            <label className="inline-flex items-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white cursor-pointer hover:bg-indigo-700 transition-colors">
              Выбрать файл
              <input type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); }} />
            </label>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          {/* Summary card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-9 h-9 bg-emerald-50 rounded-lg">
                <CheckCircle size={18} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Выписка обработана</p>
                <p className="text-xs text-gray-400">{result.filename}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {([
                ["Банк", result.bank.toUpperCase()],
                ["Клиент", result.client_name || "—"],
                ["Период", `${result.period_start || ""} — ${result.period_end || ""}`],
                ["Категоризация", `${result.categorized_count}/${result.transaction_count} (${Math.round((result.categorized_count / result.transaction_count) * 100)}%)`],
              ] as [string, string][]).map(([l, v], i) => (
                <div key={i} className="rounded-lg bg-gray-50 px-3 py-2.5">
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{l}</p>
                  <p className="text-sm font-medium text-gray-700 mt-0.5 truncate">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Transactions preview */}
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700">Транзакции ({result.transactions.length})</p>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase">Дата</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-400 uppercase">Сумма</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase">Контрагент</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase">Категория</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase w-16">Метод</th>
                </tr>
              </thead>
              <tbody>
                {result.transactions.slice(0, 30).map((tx) => (
                  <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-2.5 text-sm text-gray-500 font-mono">{tx.date}</td>
                    <td className={`px-5 py-2.5 text-right text-sm font-semibold font-mono ${tx.signed_amount >= 0 ? "text-emerald-600" : "text-gray-800"}`}>
                      {fmtAmt(tx.signed_amount)} <span className="text-xs text-gray-400">₸</span>
                    </td>
                    <td className="px-5 py-2.5 text-sm text-gray-600 max-w-[180px] truncate">{tx.counterparty}</td>
                    <td className="px-5 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        tx.category_name ? "bg-gray-100 text-gray-600" : "bg-amber-50 text-amber-600"
                      }`}>{tx.category_name || "—"}</span>
                    </td>
                    <td className="px-5 py-2.5 text-xs text-gray-400">
                      {tx.categorization_source === "rule" ? "авто" : tx.categorization_source === "llm" ? "AI" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
