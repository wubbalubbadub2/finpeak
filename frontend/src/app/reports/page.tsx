"use client";

import { useEffect, useState } from "react";
import { getCashFlow, getPnL, getExpenseAnalytics } from "@/lib/api";
import { BarChart3, TrendingUp, PieChart, ArrowUp, ArrowDown } from "lucide-react";
import { DateRangePicker, DEFAULT_RANGE, type DateRange } from "@/components/DateRangePicker";

function fmt(n: number) { return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n); }

const TABS = [
  { id: "cashflow", label: "ДДС", icon: BarChart3 },
  { id: "pnl", label: "P&L", icon: TrendingUp },
  { id: "expenses", label: "Аналитика расходов", icon: PieChart },
];

export default function ReportsPage() {
  const [tab, setTab] = useState("cashflow");
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(null);
    const fetcher = { cashflow: getCashFlow, pnl: getPnL, expenses: getExpenseAnalytics }[tab as "cashflow" | "pnl" | "expenses"];
    if (fetcher) fetcher({ date_from: range.date_from, date_to: range.date_to }).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [tab, range]);

  return (
    <div className="max-w-[1120px]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Отчеты</h1>
          <p className="text-sm text-gray-400 mt-1">Управленческая отчетность</p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              tab === id
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data ? (
        <p className="text-sm text-gray-400 py-12 text-center">Нет данных. Загрузите выписки для формирования отчетов.</p>
      ) : (
        <>
          {tab === "cashflow" && <CashFlowTab data={data} />}
          {tab === "pnl" && <PnLTab data={data} />}
          {tab === "expenses" && <ExpensesTab data={data} />}
        </>
      )}
    </div>
  );
}

/* ─── CASH FLOW TAB ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CashFlowTab({ data }: { data: any }) {
  if (!data.sections?.length) return <p className="text-sm text-gray-400 py-8 text-center">Нет данных</p>;
  const months = data.months || [];
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">Отчет о движении денежных средств</h3>
        <p className="text-xs text-gray-400 mt-0.5">По категориям и месяцам</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[250px]">Категория</th>
              {months.map((m: string) => (
                <th key={m} className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[120px]">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {data.sections.map((section: any) => (
              <SectionBlock key={section.activity} section={section} months={months} />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50/50">
              <td className="px-5 py-3 font-bold text-gray-800">Итого</td>
              {months.map((m: string) => (
                <td key={m} className={`px-4 py-3 text-right font-bold tabular-nums ${(data.total_by_month?.[m] || 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {fmt(data.total_by_month?.[m] || 0)} ₸
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SectionBlock({ section, months }: { section: any; months: string[] }) {
  return (
    <>
      <tr>
        <td colSpan={months.length + 1} className="px-5 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50/50 uppercase tracking-wider">
          {section.activity}
        </td>
      </tr>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {section.groups.map((group: any) => (
        <GroupBlock key={group.name} group={group} months={months} />
      ))}
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function GroupBlock({ group, months }: { group: any; months: string[] }) {
  return (
    <>
      <tr className="bg-gray-50/30">
        <td className="px-5 py-2 text-xs font-semibold text-gray-600">{group.name}</td>
        {months.map((m: string) => (
          <td key={m} className="px-4 py-2 text-right text-xs font-semibold text-gray-600 tabular-nums">
            {fmt(group.totals?.[m] || 0)} ₸
          </td>
        ))}
      </tr>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {group.rows.map((row: any) => (
        <tr key={row.category} className="border-b border-gray-50 hover:bg-gray-50/50">
          <td className="px-5 py-2 pl-10 text-gray-600">{row.category}</td>
          {months.map((m: string) => {
            const v = row.values?.[m] || 0;
            return (
              <td key={m} className={`px-4 py-2 text-right tabular-nums ${v >= 0 ? "text-gray-700" : "text-gray-700"}`}>
                {v !== 0 ? `${fmt(v)} ₸` : "—"}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

/* ─── P&L TAB ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PnLTab({ data }: { data: any }) {
  if (!data.rows?.length) return <p className="text-sm text-gray-400 py-8 text-center">Нет данных</p>;
  const months = data.months || [];
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">Отчет о прибылях и убытках</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[280px]">Статья</th>
              {months.map((m: string) => (
                <th key={m} className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[130px]">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {data.rows.map((row: any, i: number) => {
              const isTotal = row.type === "total";
              const isSubtotal = row.type === "subtotal" || row.type === "subtotal_neg";
              const isHeader = row.type === "header";
              return (
                <tr
                  key={i}
                  className={`border-b ${
                    isTotal ? "border-t-2 border-gray-200 bg-gray-50/50" :
                    isSubtotal ? "bg-gray-50/30 border-gray-100" :
                    "border-gray-50"
                  }`}
                >
                  <td className={`px-5 py-3 ${
                    isTotal ? "font-bold text-gray-800" :
                    isSubtotal ? "font-semibold text-gray-700" :
                    isHeader ? "font-semibold text-gray-800" :
                    "text-gray-600 pl-8"
                  }`}>
                    {row.label}
                  </td>
                  {months.map((m: string) => {
                    const v = row.values?.[m] || 0;
                    return (
                      <td key={m} className={`px-4 py-3 text-right tabular-nums ${
                        isTotal ? "font-bold text-base" :
                        isSubtotal ? "font-semibold" :
                        ""
                      } ${
                        v > 0 ? "text-emerald-600" :
                        v < 0 ? "text-red-600" :
                        "text-gray-400"
                      }`}>
                        {v !== 0 ? `${fmt(v)} ₸` : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── EXPENSE ANALYTICS TAB ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ExpensesTab({ data }: { data: any }) {
  const COLORS = ["#4f46e5","#dc2626","#d97706","#059669","#0891b2","#7c3aed","#e11d48","#ea580c","#6366f1","#14b8a6"];
  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Общая выручка</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{fmt(data.total_revenue)} <span className="text-base font-normal text-gray-400">₸</span></p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Общие расходы</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{fmt(data.total_expenses)} <span className="text-base font-normal text-gray-400">₸</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* By category */}
        <div className="md:col-span-3 rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Расходы по категориям</h3>
            <p className="text-xs text-gray-400 mt-0.5">% от выручки</p>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase">Категория</th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-400 uppercase">Сумма</th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-400 uppercase">% от выручки</th>
              </tr>
            </thead>
            <tbody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {data.by_category?.map((item: any, i: number) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-2.5 flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-gray-700">{item.category}</span>
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums font-medium text-gray-800">{fmt(item.amount)} ₸</td>
                  <td className="px-5 py-2.5 text-right">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{item.pct_of_revenue}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* Top counterparties */}
        <div className="md:col-span-2 rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Топ контрагенты</h3>
            <p className="text-xs text-gray-400 mt-0.5">По объему расходов</p>
          </div>
          <div className="p-4 space-y-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {data.top_counterparties?.map((cp: any, i: number) => (
              <div key={i}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs text-gray-600 truncate max-w-[160px]">{cp.counterparty}</span>
                  <span className="text-xs font-semibold text-gray-800 ml-2 tabular-nums">{fmt(cp.amount)} ₸</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full">
                  <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${cp.pct_of_expenses}%` }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">{cp.pct_of_expenses}% расходов</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MoM changes */}
      {data.mom_changes?.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Изменения месяц к месяцу</h3>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase">Категория</th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-400 uppercase">Текущий</th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-400 uppercase">Предыдущий</th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-400 uppercase">Изменение</th>
              </tr>
            </thead>
            <tbody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {data.mom_changes.map((item: any, i: number) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="px-5 py-2.5 text-gray-700">{item.category}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-gray-800">{fmt(item.current)} ₸</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-gray-500">{fmt(item.previous)} ₸</td>
                  <td className="px-5 py-2.5 text-right">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.change_pct > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                    }`}>
                      {item.change_pct > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                      {Math.abs(item.change_pct)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}

