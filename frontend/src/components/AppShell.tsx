"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { useAuth } from "./AuthProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, session } = useAuth();
  const isLogin = pathname === "/login";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isLogin || !session) {
    // No sidebar on the login page or when not authenticated
    return <main className="h-full">{children}</main>;
  }

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 ml-64 p-6 overflow-y-auto">{children}</main>
    </div>
  );
}
