"use client";

import { useEffect, useState } from "react";
import { getInsights } from "@/lib/api";
import { Sparkles, AlertTriangle, ArrowUp, ArrowDown, Wallet, TrendingUp, Flame, Clock } from "lucide-react";
import { DateRangePicker, DEFAULT_RANGE, type DateRange } from "@/components/DateRangePicker";

function fmt(n: number) { return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n); }

export default function InsightsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);

  useEffect(() => {
    setLoading(true);
    getInsights({ date_from: range.date_from, date_to: range.date_to }).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [range]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!data) return <p className="text-sm text-gray-400 py-12 text-center">Нет данных</p>;

  const runway = data.cash_runway || {};

  return (
    <div className="max-w-[1120px]">
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-50">
            <Sparkles size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">AI Прогноз</h1>
            <p className="text-sm text-gray-400 mt-0.5">Аномалии, тренды и финансовая прогнозная аналитика</p>
          </div>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {/* Cash Runway KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4 mb-5">
        <RunwayCard icon={<Wallet size={18} />} iconBg="bg-emerald-50" iconColor="text-emerald-600" label="Текущий баланс" value={fmt(runway.balance)} suffix="₸" valueClass={runway.balance >= 0 ? "text-emerald-600" : "text-red-600"} />
        <RunwayCard icon={<TrendingUp size={18} />} iconBg="bg-indigo-50" iconColor="text-indigo-600" label="Ср. месячный нетто" value={fmt(runway.avg_monthly_net)} suffix="₸" valueClass={runway.avg_monthly_net >= 0 ? "text-emerald-600" : "text-red-600"} />
        <RunwayCard icon={<Flame size={18} />} iconBg="bg-orange-50" iconColor="text-orange-600" label="Ср. расход / мес" value={fmt(runway.burn_rate)} suffix="₸" valueClass="text-gray-800" />
        <RunwayCard icon={<Clock size={18} />} iconBg="bg-purple-50" iconColor="text-purple-600" label="Запас прочности" value={runway.runway_months ? `${runway.runway_months}` : "∞"} suffix={runway.runway_months ? "мес" : ""} valueClass="text-purple-600" />
      </div>

      {/* Anomalies */}
      {data.anomalies?.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-white overflow-hidden mb-5">
          <div className="px-5 py-4 border-b border-amber-100 bg-amber-50/50 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800">Обнаружены аномалии</h3>
            <span className="ml-auto text-xs text-amber-600">{data.anomalies.length} операций требуют внимания</span>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Дата</th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Сумма</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Категория</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Контрагент</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Причина</th>
              </tr>
            </thead>
            <tbody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {data.anomalies.map((a: any, i: number) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-3 text-gray-500 font-mono">{a.date}</td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums text-red-600">{fmt(a.amount)} ₸</td>
                  <td className="px-5 py-3 text-gray-700">{a.category}</td>
                  <td className="px-5 py-3 text-gray-500 max-w-[180px] truncate">{a.counterparty}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{a.reason}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-5 mb-5 flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
            <Sparkles size={16} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-800">Аномалий не обнаружено</p>
            <p className="text-xs text-emerald-600 mt-0.5">Ваши расходы соответствуют типичным значениям</p>
          </div>
        </div>
      )}

      {/* Trends */}
      {data.trends?.length > 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Изменения трендов</h3>
            <p className="text-xs text-gray-400 mt-0.5">Категории с изменением более 20% месяц к месяцу</p>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Категория</th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Текущий мес.</th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Пред. мес.</th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Изменение</th>
              </tr>
            </thead>
            <tbody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {data.trends.map((t: any, i: number) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-3 text-gray-700">{t.category}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-800 font-medium">{fmt(t.current)} ₸</td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-500">{fmt(t.previous)} ₸</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      t.direction === "up" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                    }`}>
                      {t.direction === "up" ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                      {Math.abs(t.change_pct)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">Недостаточно данных для анализа трендов</p>
          <p className="text-xs text-gray-400 mt-1">Загрузите выписки за несколько месяцев для получения трендов</p>
        </div>
      )}
    </div>
  );
}

function RunwayCard({ icon, iconBg, iconColor, label, value, suffix, valueClass }: { icon: React.ReactNode; iconBg: string; iconColor: string; label: string; value: string; suffix?: string; valueClass: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${iconBg} ${iconColor}`}>{icon}</div>
      <p className="text-sm text-gray-500 mt-3">{label}</p>
      <p className={`text-xl font-bold mt-1 ${valueClass}`}>
        {value} {suffix && <span className="text-sm font-normal text-gray-400">{suffix}</span>}
      </p>
    </div>
  );
}
