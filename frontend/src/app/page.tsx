"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDashboard, getInsights, getTransactions } from "@/lib/api";
import type { DashboardData, TransactionOut } from "@/lib/types";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight,
  AlertTriangle, Sparkles, ArrowRight, FileBarChart, ChevronRight,
} from "lucide-react";

function fmt(n: number) { return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n); }
function fmtCompact(n: number) {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return String(n);
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [insights, setInsights] = useState<any>(null);
  const [recent, setRecent] = useState<TransactionOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getDashboard(),
      getInsights(),
      getTransactions({ page: 1, per_page: 5 }),
    ]).then(([d, i, t]) => {
      setData(d);
      setInsights(i);
      setRecent(t.transactions);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || data.transaction_count === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="flex items-center justify-center w-14 h-14 bg-gray-100 rounded-xl mb-4">
          <Wallet size={24} className="text-gray-400" />
        </div>
        <p className="text-lg font-semibold text-gray-700">Нет данных</p>
        <p className="text-sm text-gray-400 mt-1 mb-4">Загрузите банковскую выписку для начала работы</p>
        <Link href="/upload" className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          Загрузить выписку <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  const runway = insights?.cash_runway || {};
  const anomaliesCount = insights?.anomalies?.length || 0;
  const trendsCount = insights?.trends?.length || 0;

  // Get most recent month from monthly_trend
  const lastMonth = data.monthly_trend[data.monthly_trend.length - 1];
  const prevMonth = data.monthly_trend[data.monthly_trend.length - 2];

  const monthIncome = lastMonth?.income || 0;
  const monthExpense = lastMonth?.expense || 0;
  const monthNet = lastMonth?.net || 0;
  const incomeChange = prevMonth ? ((monthIncome - prevMonth.income) / (prevMonth.income || 1)) * 100 : 0;
  const expenseChange = prevMonth ? ((monthExpense - prevMonth.expense) / (prevMonth.expense || 1)) * 100 : 0;

  return (
    <div className="max-w-[1120px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Дашборд</h1>
          <p className="text-sm text-gray-400 mt-1">
            {data.period_start} — {data.period_end} &middot; {data.transaction_count} операций
          </p>
        </div>
      </div>

      {/* KPI Strip - 4 cards focused on CURRENT state */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4 mb-6">
        <KPICard
          label="Текущий баланс"
          value={fmt(runway.balance || 0)}
          suffix="₸"
          icon={<Wallet size={18} />}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          valueColor={runway.balance >= 0 ? "text-gray-900" : "text-red-600"}
        />
        <KPICard
          label="Доход за месяц"
          value={fmt(monthIncome)}
          suffix="₸"
          icon={<ArrowUpRight size={18} />}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          valueColor="text-gray-900"
          change={prevMonth ? incomeChange : undefined}
        />
        <KPICard
          label="Расход за месяц"
          value={fmt(monthExpense)}
          suffix="₸"
          icon={<ArrowDownRight size={18} />}
          iconBg="bg-red-50"
          iconColor="text-red-600"
          valueColor="text-gray-900"
          change={prevMonth ? expenseChange : undefined}
          changeInverted
        />
        <KPICard
          label="Чистая прибыль"
          value={`${monthNet >= 0 ? "+" : ""}${fmt(monthNet)}`}
          suffix="₸"
          icon={monthNet >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
          iconBg={monthNet >= 0 ? "bg-emerald-50" : "bg-red-50"}
          iconColor={monthNet >= 0 ? "text-emerald-600" : "text-red-600"}
          valueColor={monthNet >= 0 ? "text-emerald-600" : "text-red-600"}
        />
      </div>

      {/* Cash flow trend chart - the only chart on dashboard */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 mb-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-800">Тренд денежного потока</h3>
          <Link href="/reports" className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
            Подробнее <ChevronRight size={12} />
          </Link>
        </div>
        <p className="text-xs text-gray-400 mb-4">Последние месяцы</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.monthly_trend}>
            <defs>
              <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickFormatter={(v) => fmtCompact(v)} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
              formatter={(v) => [fmt(Number(v)) + " ₸"]}
            />
            <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} fill="url(#incomeFill)" name="Доход" />
            <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fill="url(#expenseFill)" name="Расход" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Two-column layout: Account balances + Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Account balances */}
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Счета</h3>
            <span className="text-xs text-gray-400">{data.account_balances.length}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {data.account_balances.slice(0, 6).map((acc, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-semibold text-gray-600 uppercase">{acc.bank.slice(0, 2)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{acc.wallet || acc.account}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">{acc.bank}</p>
                  </div>
                </div>
                <p className={`text-sm font-semibold tabular-nums ${acc.balance >= 0 ? "text-gray-900" : "text-red-600"}`}>
                  {fmt(acc.balance)} ₸
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Alerts summary */}
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-indigo-500" />
              <h3 className="text-sm font-semibold text-gray-800">AI Прогноз</h3>
            </div>
            <Link href="/insights" className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
              Подробнее <ChevronRight size={12} />
            </Link>
          </div>
          <div className="p-5 space-y-3">
            {/* Runway */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50/50 border border-purple-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Wallet size={14} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Запас прочности</p>
                  <p className="text-sm font-semibold text-purple-700">
                    {runway.runway_months ? `${runway.runway_months} месяцев` : "∞ (положительный поток)"}
                  </p>
                </div>
              </div>
            </div>

            {/* Anomalies count */}
            <div className={`flex items-center justify-between p-3 rounded-lg border ${anomaliesCount > 0 ? "bg-amber-50/50 border-amber-100" : "bg-emerald-50/50 border-emerald-100"}`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${anomaliesCount > 0 ? "bg-amber-100" : "bg-emerald-100"}`}>
                  <AlertTriangle size={14} className={anomaliesCount > 0 ? "text-amber-600" : "text-emerald-600"} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Аномалии</p>
                  <p className={`text-sm font-semibold ${anomaliesCount > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                    {anomaliesCount > 0 ? `${anomaliesCount} требуют внимания` : "Не обнаружено"}
                  </p>
                </div>
              </div>
            </div>

            {/* Trends count */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-50/50 border border-indigo-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <TrendingUp size={14} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Изменения трендов</p>
                  <p className="text-sm font-semibold text-indigo-700">
                    {trendsCount > 0 ? `${trendsCount} категорий с >20%` : "Стабильно"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Последние транзакции</h3>
          <Link href="/transactions" className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
            Все транзакции <ChevronRight size={12} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <tbody>
              {recent.map((tx, i) => (
                <tr key={tx.id} className={`border-b border-gray-50 ${i === recent.length - 1 ? "border-b-0" : ""} hover:bg-gray-50/50`}>
                  <td className="px-3 md:px-5 py-3 text-[11px] md:text-xs text-gray-500 font-mono whitespace-nowrap w-24">{tx.date}</td>
                  <td className="px-3 md:px-5 py-3 text-xs md:text-sm text-gray-700 max-w-[140px] md:max-w-[220px] truncate">{tx.counterparty}</td>
                  <td className="px-3 md:px-5 py-3 hidden md:table-cell">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {tx.category_name || "—"}
                    </span>
                  </td>
                  <td className={`px-3 md:px-5 py-3 text-right text-xs md:text-sm font-semibold tabular-nums whitespace-nowrap ${tx.signed_amount >= 0 ? "text-emerald-600" : "text-gray-800"}`}>
                    {tx.signed_amount >= 0 ? "+" : ""}{fmt(tx.signed_amount)} <span className="text-[10px] text-gray-400">₸</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
        <QuickLink href="/reports" icon={<FileBarChart size={16} />} label="Управленческие отчеты" desc="ДДС, P&L, Аналитика" />
        <QuickLink href="/insights" icon={<Sparkles size={16} />} label="AI Прогноз" desc="Аномалии и тренды" />
        <QuickLink href="/upload" icon={<ArrowUpRight size={16} />} label="Загрузить выписку" desc="Добавить новые данные" />
      </div>
    </div>
  );
}

function KPICard({ label, value, suffix, icon, iconBg, iconColor, valueColor, change, changeInverted }: {
  label: string; value: string; suffix?: string; icon: React.ReactNode;
  iconBg: string; iconColor: string; valueColor: string;
  change?: number; changeInverted?: boolean;
}) {
  const showChange = change !== undefined && Number.isFinite(change);
  // For expenses, "up" is bad. changeInverted flips the colors.
  const isPositive = changeInverted ? change! < 0 : change! >= 0;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{label}</span>
        <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${iconBg} ${iconColor}`}>{icon}</div>
      </div>
      <p className={`text-2xl font-bold mt-3 ${valueColor}`}>
        {value} {suffix && <span className="text-base font-normal text-gray-400">{suffix}</span>}
      </p>
      {showChange && (
        <p className={`text-xs mt-1 flex items-center gap-1 ${isPositive ? "text-emerald-600" : "text-red-600"}`}>
          {(change as number) >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(change as number).toFixed(1)}% к пред. месяцу
        </p>
      )}
    </div>
  );
}

function QuickLink({ href, icon, label, desc }: { href: string; icon: React.ReactNode; label: string; desc: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-gray-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm transition-all flex items-center gap-3 group">
      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-100 transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        <p className="text-xs text-gray-400 truncate">{desc}</p>
      </div>
      <ChevronRight size={14} className="text-gray-400 group-hover:text-indigo-500 transition-colors" />
    </Link>
  );
}

