"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { useAuth } from "./AuthProvider";
import { LogoMark } from "./Logo";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, session } = useAuth();
  const isLogin = pathname === "/login";
  const isOnboarding = pathname === "/onboarding";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isLogin || isOnboarding || !session) {
    // No sidebar on the login/onboarding pages or when not authenticated
    return <main className="h-full">{children}</main>;
  }

  return (
    <div className="min-h-full">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Top header for mobile + tablet (< lg / 1024px) */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-white border-b border-gray-200 px-4 h-14">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100"
          aria-label="Открыть меню"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <LogoMark size={28} />
          <span className="text-sm font-bold text-gray-900 tracking-tight">
            Fin<span className="text-indigo-600">Peak</span>
          </span>
        </div>
        {/* Spacer to keep the logo centered */}
        <div className="w-9" aria-hidden />
      </header>

      <main className="lg:ml-60 p-4 lg:p-6 overflow-y-auto">{children}</main>
    </div>
  );
}
