"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Upload, List, Tags, FileBarChart, Sparkles, Users, LogOut } from "lucide-react";
import { useAuth } from "./AuthProvider";

const NAV = [
  { href: "/", label: "Дашборд", icon: LayoutDashboard },
  { href: "/reports", label: "Отчеты", icon: FileBarChart },
  { href: "/insights", label: "AI Прогноз", icon: Sparkles },
  { href: "/upload", label: "Загрузка", icon: Upload },
  { href: "/transactions", label: "Транзакции", icon: List },
  { href: "/categories", label: "Категории", icon: Tags },
];

const ADMIN_NAV = [
  { href: "/users", label: "Пользователи", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600">
          <span className="text-white font-bold text-sm">KZ</span>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-800">KZ Finance</p>
          <p className="text-xs text-gray-400">Финансовая аналитика</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 mt-2 overflow-y-auto">
        <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Меню</p>
        <ul className="space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-indigo-50 text-indigo-600"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  }`}
                >
                  <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        {isSuperAdmin && (
          <>
            <p className="px-3 mt-6 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Администрирование</p>
            <ul className="space-y-1">
              {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        active
                          ? "bg-indigo-50 text-indigo-600"
                          : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                      }`}
                    >
                      <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </nav>

      {/* User + Sign out */}
      <div className="border-t border-gray-100 px-4 py-3">
        {user && (
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium text-gray-700 truncate">{user.name}</p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>
        )}
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={16} />
          Выйти
        </button>
      </div>
    </aside>
  );
}
