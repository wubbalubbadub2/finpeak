"use client";

import { useEffect, useState } from "react";
import { listUsers, createUser, deleteUser, type UserOut } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Plus, Trash2, Users, Copy, Check, AlertCircle, X } from "lucide-react";

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [createdUser, setCreatedUser] = useState<{ email: string; password: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setUsers(await listUsers());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить пользователей");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await createUser({ name, email, password: password || undefined });
      setCreatedUser({ email: result.email, password: result.password, name: result.name });
      setName("");
      setEmail("");
      setPassword("");
      setShowAdd(false);
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать пользователя");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId: string, userEmail: string) => {
    if (!confirm(`Удалить пользователя ${userEmail}? Все его данные будут удалены.`)) return;
    try {
      await deleteUser(userId);
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить пользователя");
    }
  };

  const copyToClipboard = () => {
    if (!createdUser) return;
    navigator.clipboard.writeText(`Email: ${createdUser.email}\nПароль: ${createdUser.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (user && user.role !== "super_admin") {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-gray-500">У вас нет доступа к этой странице</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Пользователи</h1>
          <p className="text-sm text-gray-400 mt-1">Управление аккаунтами клиентов</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 w-full sm:w-auto"
        >
          <Plus size={15} /> Добавить пользователя
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {/* Created user notification */}
      {createdUser && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-sm font-semibold text-emerald-800">Пользователь создан</p>
              <p className="text-xs text-emerald-600 mt-0.5">Сохраните данные — пароль показывается только один раз</p>
            </div>
            <button onClick={() => setCreatedUser(null)} className="text-emerald-600 hover:text-emerald-800">
              <X size={16} />
            </button>
          </div>
          <div className="bg-white rounded-lg p-4 space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Email:</span>
              <span className="text-gray-800">{createdUser.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Пароль:</span>
              <span className="text-gray-800">{createdUser.password}</span>
            </div>
          </div>
          <button
            onClick={copyToClipboard}
            className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-emerald-700 hover:text-emerald-900"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Скопировано" : "Скопировать данные"}
          </button>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800">Новый пользователь</h3>
            <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Имя / Компания</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ТОО Example"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Пароль (необязательно)</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Сгенерируется автоматически"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div className="md:col-span-3 flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Создание..." : "Создать"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users list */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Users size={15} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">Все пользователи</span>
          <span className="text-xs text-gray-400 ml-auto">{users.length}</span>
        </div>
        {loading ? (
          <div className="py-12 text-center">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : users.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">Нет пользователей</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Имя</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Роль</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Создан</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-3 text-sm font-medium text-gray-800">{u.name}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{u.email}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      u.role === "super_admin" ? "bg-purple-50 text-purple-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {u.role === "super_admin" ? "Супер админ" : "Пользователь"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500 font-mono">{u.created_at?.slice(0, 10) || "—"}</td>
                  <td className="px-5 py-3 text-right">
                    {u.role !== "super_admin" && (
                      <button
                        onClick={() => handleDelete(u.id, u.email || "")}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
