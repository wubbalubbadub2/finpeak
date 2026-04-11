"use client";

import { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";

export interface DateRange {
  date_from?: string;
  date_to?: string;
  label: string;
}

const PRESETS: { label: string; build: () => DateRange }[] = [
  {
    label: "Все время",
    build: () => ({ label: "Все время" }),
  },
  {
    label: "Этот месяц",
    build: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { date_from: iso(from), date_to: iso(to), label: "Этот месяц" };
    },
  },
  {
    label: "Прошлый месяц",
    build: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { date_from: iso(from), date_to: iso(to), label: "Прошлый месяц" };
    },
  },
  {
    label: "Этот квартал",
    build: () => {
      const now = new Date();
      const q = Math.floor(now.getMonth() / 3);
      const from = new Date(now.getFullYear(), q * 3, 1);
      const to = new Date(now.getFullYear(), q * 3 + 3, 0);
      return { date_from: iso(from), date_to: iso(to), label: "Этот квартал" };
    },
  },
  {
    label: "Этот год",
    build: () => {
      const now = new Date();
      return {
        date_from: `${now.getFullYear()}-01-01`,
        date_to: `${now.getFullYear()}-12-31`,
        label: "Этот год",
      };
    },
  },
  {
    label: "Прошлый год",
    build: () => {
      const y = new Date().getFullYear() - 1;
      return { date_from: `${y}-01-01`, date_to: `${y}-12-31`, label: "Прошлый год" };
    },
  },
  {
    label: "Последние 30 дней",
    build: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - 30);
      return { date_from: iso(from), date_to: iso(to), label: "Последние 30 дней" };
    },
  },
  {
    label: "Последние 90 дней",
    build: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - 90);
      return { date_from: iso(from), date_to: iso(to), label: "Последние 90 дней" };
    },
  },
];

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [from, setFrom] = useState(value.date_from || "");
  const [to, setTo] = useState(value.date_to || "");

  const handlePreset = (preset: { build: () => DateRange }) => {
    onChange(preset.build());
    setOpen(false);
    setCustomMode(false);
  };

  const handleCustom = () => {
    if (!from && !to) return;
    onChange({
      date_from: from || undefined,
      date_to: to || undefined,
      label: from && to ? `${from} — ${to}` : from ? `с ${from}` : `до ${to}`,
    });
    setOpen(false);
    setCustomMode(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Calendar size={14} className="text-gray-400" />
        <span>{value.label}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => {
              setOpen(false);
              setCustomMode(false);
            }}
          />
          <div className="absolute right-0 mt-2 w-64 rounded-xl border border-gray-200 bg-white shadow-lg z-40">
            {!customMode ? (
              <div className="p-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => handlePreset(p)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                      value.label === p.label
                        ? "bg-indigo-50 text-indigo-600 font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <button
                    onClick={() => setCustomMode(true)}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Произвольный период...
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-700">Произвольный период</p>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">С</label>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">По</label>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCustomMode(false)}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    Назад
                  </button>
                  <button
                    onClick={handleCustom}
                    disabled={!from && !to}
                    className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Применить
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export const DEFAULT_RANGE: DateRange = { label: "Все время" };
