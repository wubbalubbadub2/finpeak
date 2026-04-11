"use client";

import { useEffect, useState, useCallback } from "react";
import { getBudgets, upsertBudget, copyBudgets, type BudgetRow, type BudgetSummary } from "@/lib/api";
import { Target, ChevronLeft, ChevronRight, Copy, Check, X, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";

function fmt(n: number) { return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n); }
function pad(n: number) { return String(n).padStart(2, "0"); }

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function shiftPeriod(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export default function BudgetsPage() {
  const [period, setPeriod] = useState(() => {
    // Default to the most recent month with data, or current month
    return currentPeriod();
  });
  const [data, setData] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ catId: string; value: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBudgets(period);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить бюджеты");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (row: BudgetRow) => {
    if (!editing) return;
    const amount = parseFloat(editing.value);
    if (Number.isNaN(amount) || amount < 0) {
      setError("Введите неотрицательное число");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await upsertBudget({ category_id: row.category_id, period, amount });
      setEditing(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyFromPrev = async () => {
    const prev = shiftPeriod(period, -1);
    if (!confirm(`Скопировать бюджеты из ${periodLabel(prev)}? Текущие бюджеты ${periodLabel(period)} будут перезаписаны.`)) return;
    setCopying(true);
    setError(null);
    try {
      const res = await copyBudgets(prev, period);
      if (res.copied === 0) {
        setError(`В ${periodLabel(prev)} нет бюджетов для копирования`);
      } else {
        load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось скопировать");
    } finally {
      setCopying(false);
    }
  };

  // Group by category_group for display
  const grouped: Record<string, BudgetRow[]> = {};
  for (const row of data?.rows || []) {
    const key = row.category_group || "Прочее";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }

  return (
    <div className="max-w-[1200px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Бюджеты</h1>
          <p className="text-sm text-gray-400 mt-1">Планирование и контроль расходов по категориям</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPeriod(shiftPeriod(period, -1))}
            className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600"
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-800 min-w-[140px] text-center">
            {periodLabel(period)}
          </div>
          <button
            onClick={() => setPeriod(shiftPeriod(period, 1))}
            className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600"
            aria-label="Следующий месяц"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={handleCopyFromPrev}
            disabled={copying}
            className="ml-2 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Copy size={14} />
            {copying ? "Копирование..." : "Копировать из прошлого"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <div className="flex items-center gap-2"><AlertCircle size={16} /> {error}</div>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <SummaryCard
            label="Бюджет"
            value={fmt(data.total_budget)}
            color="text-indigo-600"
            iconBg="bg-indigo-50"
            icon={<Target size={18} className="text-indigo-600" />}
          />
          <SummaryCard
            label="Факт"
            value={fmt(data.total_actual)}
            color="text-gray-900"
            iconBg="bg-gray-100"
            icon={<TrendingUp size={18} className="text-gray-700" />}
          />
          <SummaryCard
            label="Остаток"
            value={`${data.total_diff >= 0 ? "" : ""}${fmt(data.total_diff)}`}
            color={data.total_diff >= 0 ? "text-emerald-600" : "text-red-600"}
            iconBg={data.total_diff >= 0 ? "bg-emerald-50" : "bg-red-50"}
            icon={data.total_diff >= 0 ? <TrendingUp size={18} className="text-emerald-600" /> : <TrendingDown size={18} className="text-red-600" />}
          />
        </div>
      )}

      {/* Budget table grouped by category_group */}
      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : !data || data.rows.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center">
          <p className="text-sm text-gray-500">Нет категорий расходов</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([groupName, rows]) => {
            const groupBudget = rows.reduce((s, r) => s + r.budget, 0);
            const groupActual = rows.reduce((s, r) => s + r.actual, 0);
            const groupPct = groupBudget > 0 ? Math.round((groupActual / groupBudget) * 100) : 0;
            return (
              <div key={groupName} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">{groupName || "Прочие категории"}</span>
                  <div className="text-xs text-gray-500 tabular-nums">
                    {fmt(groupActual)} / {fmt(groupBudget)} ₸
                    {groupBudget > 0 && (
                      <span className={`ml-2 font-semibold ${groupPct > 100 ? "text-red-600" : groupPct > 80 ? "text-amber-600" : "text-emerald-600"}`}>
                        ({groupPct}%)
                      </span>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-5 py-2.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider min-w-[200px]">Категория</th>
                        <th className="text-right px-5 py-2.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider w-[140px]">Бюджет</th>
                        <th className="text-right px-5 py-2.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider w-[140px]">Факт</th>
                        <th className="text-right px-5 py-2.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider w-[140px]">Остаток</th>
                        <th className="text-left px-5 py-2.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider min-w-[200px]">Прогресс</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <BudgetRowItem
                          key={row.category_id}
                          row={row}
                          editing={editing?.catId === row.category_id}
                          editValue={editing?.catId === row.category_id ? editing.value : ""}
                          onStartEdit={() => setEditing({ catId: row.category_id, value: String(row.budget) })}
                          onCancelEdit={() => setEditing(null)}
                          onChangeValue={(v) => setEditing({ catId: row.category_id, value: v })}
                          onSave={() => handleSave(row)}
                          saving={saving}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color, iconBg, icon }: {
  label: string; value: string; color: string; iconBg: string; icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{label}</span>
        <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${iconBg}`}>{icon}</div>
      </div>
      <p className={`text-2xl font-bold mt-2 tabular-nums ${color}`}>
        {value} <span className="text-base font-normal text-gray-400">₸</span>
      </p>
    </div>
  );
}

function BudgetRowItem({
  row, editing, editValue, onStartEdit, onCancelEdit, onChangeValue, onSave, saving,
}: {
  row: BudgetRow;
  editing: boolean;
  editValue: string;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onChangeValue: (v: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const pct = Math.min(row.pct_used, 200);
  const overBudget = row.actual > row.budget && row.budget > 0;
  const noBudget = row.budget === 0 && row.actual > 0;
  const barColor = noBudget
    ? "bg-gray-300"
    : pct > 100
    ? "bg-red-500"
    : pct > 80
    ? "bg-amber-500"
    : "bg-emerald-500";

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50">
      <td className="px-5 py-3 text-gray-700">{row.category_name}</td>
      <td className="px-5 py-3 text-right">
        {editing ? (
          <div className="flex items-center justify-end gap-1">
            <input
              type="number"
              autoFocus
              value={editValue}
              onChange={(e) => onChangeValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSave();
                if (e.key === "Escape") onCancelEdit();
              }}
              className="w-28 rounded border border-indigo-300 px-2 py-1 text-sm text-right outline-none focus:ring-2 focus:ring-indigo-100 tabular-nums"
            />
            <button onClick={onSave} disabled={saving} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
              <Check size={14} />
            </button>
            <button onClick={onCancelEdit} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={onStartEdit}
            className="text-gray-700 tabular-nums font-medium hover:text-indigo-600 hover:underline cursor-pointer"
          >
            {row.budget > 0 ? `${fmt(row.budget)} ₸` : <span className="text-gray-300">—</span>}
          </button>
        )}
      </td>
      <td className="px-5 py-3 text-right tabular-nums text-gray-800 font-medium">
        {row.actual > 0 ? `${fmt(row.actual)} ₸` : <span className="text-gray-300">—</span>}
      </td>
      <td className={`px-5 py-3 text-right tabular-nums font-medium ${
        row.budget === 0 ? "text-gray-400" :
        row.diff >= 0 ? "text-emerald-600" : "text-red-600"
      }`}>
        {row.budget > 0 ? `${row.diff >= 0 ? "" : ""}${fmt(row.diff)} ₸` : "—"}
      </td>
      <td className="px-5 py-3 min-w-[200px]">
        {row.budget > 0 || row.actual > 0 ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className={`text-xs font-semibold tabular-nums w-12 text-right ${
              overBudget ? "text-red-600" :
              pct > 80 ? "text-amber-600" :
              "text-gray-500"
            }`}>
              {row.budget > 0 ? `${Math.round(pct)}%` : "—"}
            </span>
          </div>
        ) : (
          <span className="text-xs text-gray-300">Нет данных</span>
        )}
      </td>
    </tr>
  );
}
