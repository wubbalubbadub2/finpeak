"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import {
  getCategories,
  getRules,
  createRule,
  updateRule,
  deleteRule,
  type RuleOut,
  type RuleCreateInput,
} from "@/lib/api";
import type { CategoryOut } from "@/lib/types";

type RuleField = "payment_description" | "counterparty";

interface RuleDraft {
  field: RuleField;
  pattern: string;
  category_name: string;
}

const EMPTY_DRAFT: RuleDraft = {
  field: "payment_description",
  pattern: "",
  category_name: "",
};

const FIELD_LABEL: Record<string, string> = {
  payment_description: "Описание",
  counterparty: "Контрагент",
};

const SOURCE_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  imported: {
    label: "Импорт",
    className: "bg-gray-100 text-gray-600",
  },
  learned: {
    label: "Изучено",
    className: "bg-amber-50 text-amber-600",
  },
  manual: {
    label: "Вручную",
    className: "bg-indigo-50 text-indigo-600",
  },
};

export default function CategoriesPage() {
  const [cats, setCats] = useState<CategoryOut[]>([]);
  const [rules, setRules] = useState<RuleOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<RuleDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<RuleDraft>(EMPTY_DRAFT);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getCategories(), getRules()])
      .then(([c, r]) => {
        if (cancelled) return;
        setCats(c);
        setRules(r);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Ошибка загрузки");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categoryNames = useMemo(
    () => cats.map((c) => c.name).sort((a, b) => a.localeCompare(b)),
    [cats]
  );

  const filteredRules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rules.filter((r) => {
      if (sourceFilter !== "all" && r.source !== sourceFilter) return false;
      if (!q) return true;
      return (
        r.pattern.toLowerCase().includes(q) ||
        (r.category_name || "").toLowerCase().includes(q) ||
        FIELD_LABEL[r.field]?.toLowerCase().includes(q)
      );
    });
  }, [rules, search, sourceFilter]);

  const grouped: Record<string, CategoryOut[]> = {};
  for (const c of cats) {
    const k = c.activity_type || "Другое";
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(c);
  }

  function startAdd() {
    setDraft({
      ...EMPTY_DRAFT,
      category_name: categoryNames[0] || "",
    });
    setShowAdd(true);
  }

  function cancelAdd() {
    setShowAdd(false);
    setDraft(EMPTY_DRAFT);
  }

  async function submitAdd() {
    if (!draft.pattern.trim() || !draft.category_name) {
      setError("Заполните паттерн и категорию");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createRule(draft as RuleCreateInput);
      setRules((prev) => [created, ...prev]);
      cancelAdd();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Не удалось создать правило");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(rule: RuleOut) {
    setEditingId(rule.id);
    setEditDraft({
      field: (rule.field as RuleField) || "payment_description",
      pattern: rule.pattern,
      category_name: rule.category_name || categoryNames[0] || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(EMPTY_DRAFT);
  }

  async function submitEdit(id: string) {
    if (!editDraft.pattern.trim() || !editDraft.category_name) {
      setError("Заполните паттерн и категорию");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateRule(id, {
        field: editDraft.field,
        pattern: editDraft.pattern,
        category_name: editDraft.category_name,
      });
      setRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
      cancelEdit();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить правило");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(rule: RuleOut) {
    const ok = window.confirm(
      `Удалить правило "${rule.pattern}" → ${rule.category_name || ""}?`
    );
    if (!ok) return;
    setError(null);
    try {
      await deleteRule(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Не удалось удалить правило");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1100px]">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800">Категории и правила</h1>
        <p className="text-sm text-gray-400 mt-1">
          {cats.length} категорий, {rules.length} правил
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="space-y-4">
        {/* Rules section */}
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="text-sm font-semibold text-gray-800">
                Правила категоризации
              </span>
              <span className="text-xs text-gray-400 ml-2">
                ({filteredRules.length}
                {filteredRules.length !== rules.length && ` из ${rules.length}`})
              </span>
              <p className="text-xs text-gray-500 mt-0.5">
                Автоматически присваивают категории по паттерну в описании или
                контрагенте
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 md:flex-none min-w-0">
                <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск правил..."
                  className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 w-full md:w-56"
                />
              </div>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="py-1.5 px-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
              >
                <option value="all">Все источники</option>
                <option value="manual">Вручную</option>
                <option value="learned">Изученные</option>
                <option value="imported">Импортированные</option>
              </select>
              <button
                type="button"
                onClick={startAdd}
                disabled={showAdd}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium px-3 py-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Добавить
              </button>
            </div>
          </div>

          {showAdd && (
            <div className="px-5 py-4 border-b border-gray-100 bg-indigo-50/30">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-3">
                  <label className="text-xs font-medium text-gray-500 block mb-1">
                    Поле
                  </label>
                  <select
                    value={draft.field}
                    onChange={(e) =>
                      setDraft({ ...draft, field: e.target.value as RuleField })
                    }
                    className="w-full py-1.5 px-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                  >
                    <option value="payment_description">Описание</option>
                    <option value="counterparty">Контрагент</option>
                  </select>
                </div>
                <div className="md:col-span-4">
                  <label className="text-xs font-medium text-gray-500 block mb-1">
                    Паттерн
                  </label>
                  <input
                    type="text"
                    value={draft.pattern}
                    onChange={(e) =>
                      setDraft({ ...draft, pattern: e.target.value })
                    }
                    placeholder="например, аренда"
                    className="w-full py-1.5 px-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 font-mono"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="text-xs font-medium text-gray-500 block mb-1">
                    Категория
                  </label>
                  <select
                    value={draft.category_name}
                    onChange={(e) =>
                      setDraft({ ...draft, category_name: e.target.value })
                    }
                    className="w-full py-1.5 px-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                  >
                    <option value="">— выберите —</option>
                    {categoryNames.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={cancelAdd}
                    disabled={saving}
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={submitAdd}
                    disabled={saving}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 rounded-lg transition-colors"
                  >
                    {saving ? "..." : "Сохранить"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {filteredRules.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              {rules.length === 0
                ? "Правил пока нет. Добавьте первое правило кнопкой выше."
                : "Ничего не найдено по фильтру."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-white">
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Поле
                    </th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Паттерн
                    </th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Категория
                    </th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Источник
                    </th>
                    <th className="px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider w-24">
                      {""}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRules.map((r) => {
                    const badge =
                      SOURCE_BADGE[r.source] || SOURCE_BADGE.imported;
                    const isEditing = editingId === r.id;
                    if (isEditing) {
                      return (
                        <tr
                          key={r.id}
                          className="border-b border-gray-50 bg-indigo-50/30"
                        >
                          <td className="px-5 py-2">
                            <select
                              value={editDraft.field}
                              onChange={(e) =>
                                setEditDraft({
                                  ...editDraft,
                                  field: e.target.value as RuleField,
                                })
                              }
                              className="w-full py-1 px-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                            >
                              <option value="payment_description">
                                Описание
                              </option>
                              <option value="counterparty">Контрагент</option>
                            </select>
                          </td>
                          <td className="px-5 py-2">
                            <input
                              type="text"
                              value={editDraft.pattern}
                              onChange={(e) =>
                                setEditDraft({
                                  ...editDraft,
                                  pattern: e.target.value,
                                })
                              }
                              className="w-full py-1 px-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 font-mono"
                            />
                          </td>
                          <td className="px-5 py-2">
                            <select
                              value={editDraft.category_name}
                              onChange={(e) =>
                                setEditDraft({
                                  ...editDraft,
                                  category_name: e.target.value,
                                })
                              }
                              className="w-full py-1 px-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                            >
                              <option value="">— выберите —</option>
                              {categoryNames.map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-5 py-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-5 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => submitEdit(r.id)}
                                disabled={saving}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-md transition-colors disabled:opacity-50"
                                aria-label="Сохранить"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={saving}
                                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                                aria-label="Отмена"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-gray-50 hover:bg-gray-50/50"
                      >
                        <td className="px-5 py-3 text-sm text-gray-500">
                          {FIELD_LABEL[r.field] || r.field}
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-700 font-mono max-w-[280px] truncate">
                          {r.pattern}
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-700">
                          {r.category_name || "—"}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(r)}
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                              aria-label="Редактировать"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(r)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              aria-label="Удалить"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Categories section */}
        {Object.entries(grouped).map(([type, items]) => (
          <div
            key={type}
            className="rounded-2xl border border-gray-200 bg-white overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
              <span className="text-sm font-semibold text-gray-800">{type}</span>
              <span className="text-xs text-gray-400 ml-2">({items.length})</span>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Название
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Направление
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Группа
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Описание
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50"
                  >
                    <td className="px-5 py-3 text-sm font-medium text-gray-800">
                      {c.name}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          c.group === "Поступление"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-red-50 text-red-600"
                        }`}
                      >
                        {c.group}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">
                      {c.category_group}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-400 max-w-[280px] truncate">
                      {c.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
