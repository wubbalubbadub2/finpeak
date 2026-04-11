import type {
  UploadResponse,
  TransactionListResponse,
  DashboardData,
  CategoryOut,
} from "./types";
import { supabase } from "./supabase";

// All API calls go through Next.js rewrites (configured in next.config.ts)
// which proxies /api/* to the backend (localhost in dev, Render in prod)
const API = "/api";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API}${url}`, {
    ...init,
    headers: {
      ...authHeaders,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) {
      // Redirect to login
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function uploadPDF(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  return request<UploadResponse>("/upload", { method: "POST", body: form });
}

export async function getTransactions(params: {
  page?: number;
  per_page?: number;
  date_from?: string;
  date_to?: string;
  bank?: string;
  category?: string;
  search?: string;
}): Promise<TransactionListResponse> {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  });
  return request<TransactionListResponse>(`/transactions?${sp}`);
}

export async function updateTransaction(
  id: string,
  category_name: string
): Promise<void> {
  await request(`/transactions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category_name }),
  });
}

export async function getDashboard(params?: {
  date_from?: string;
  date_to?: string;
}): Promise<DashboardData> {
  const sp = new URLSearchParams();
  if (params?.date_from) sp.set("date_from", params.date_from);
  if (params?.date_to) sp.set("date_to", params.date_to);
  return request<DashboardData>(`/reports/dashboard?${sp}`);
}

export async function getCategories(): Promise<CategoryOut[]> {
  return request<CategoryOut[]>("/categories");
}

// --- Categorization rules ---

export interface RuleOut {
  id: string;
  field: string;
  pattern: string;
  category_id: string;
  category_name: string | null;
  source: string;
}

export interface RuleCreateInput {
  field: "payment_description" | "counterparty";
  pattern: string;
  category_name: string;
}

export interface RuleUpdateInput {
  field?: "payment_description" | "counterparty";
  pattern?: string;
  category_name?: string;
}

export async function getRules(): Promise<RuleOut[]> {
  return request<RuleOut[]>("/rules");
}

export async function createRule(data: RuleCreateInput): Promise<RuleOut> {
  return request<RuleOut>("/rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateRule(
  id: string,
  data: RuleUpdateInput
): Promise<RuleOut> {
  return request<RuleOut>(`/rules/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteRule(id: string): Promise<void> {
  await request(`/rules/${id}`, { method: "DELETE" });
}

export interface DateRange {
  date_from?: string;
  date_to?: string;
}

function rangeQuery(range?: DateRange): string {
  const sp = new URLSearchParams();
  if (range?.date_from) sp.set("date_from", range.date_from);
  if (range?.date_to) sp.set("date_to", range.date_to);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCashFlow(range?: DateRange): Promise<any> { return request(`/reports/cashflow${rangeQuery(range)}`); }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPnL(range?: DateRange): Promise<any> { return request(`/reports/pnl${rangeQuery(range)}`); }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getExpenseAnalytics(range?: DateRange): Promise<any> { return request(`/reports/expenses${rangeQuery(range)}`); }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getInsights(range?: DateRange): Promise<any> { return request(`/reports/insights${rangeQuery(range)}`); }

export async function exportCSV(params?: {
  date_from?: string;
  date_to?: string;
}): Promise<void> {
  const sp = new URLSearchParams();
  if (params?.date_from) sp.set("date_from", params.date_from);
  if (params?.date_to) sp.set("date_to", params.date_to);
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API}/reports/export/csv?${sp}`, { headers: authHeaders });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "transactions.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// --- Wallets ---

export interface WalletOut {
  id: string;
  account_number: string;
  bank: string;
  wallet_name: string | null;
  currency: string;
  opening_balance: number;
  is_archived: boolean;
  transaction_count: number;
  current_balance: number;
}

export interface WalletUpdateInput {
  wallet_name?: string;
  opening_balance?: number;
  is_archived?: boolean;
  currency?: string;
}

export interface WalletCreateInput {
  account_number: string;
  bank: string;
  wallet_name: string;
  currency?: string;
  opening_balance?: number;
}

export async function getWallets(includeArchived = false): Promise<WalletOut[]> {
  return request<WalletOut[]>(`/wallets?include_archived=${includeArchived}`);
}

export async function createWallet(data: WalletCreateInput): Promise<WalletOut> {
  return request<WalletOut>("/wallets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateWallet(id: string, data: WalletUpdateInput): Promise<WalletOut> {
  return request<WalletOut>(`/wallets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteWallet(id: string): Promise<void> {
  await request(`/wallets/${id}`, { method: "DELETE" });
}

// --- Auth & user management ---

export interface UserOut {
  id: string;
  name: string;
  email: string | null;
  role: string;
  onboarded?: boolean;
  created_at?: string | null;
}

export async function completeOnboarding(): Promise<void> {
  await request("/auth/complete-onboarding", { method: "POST" });
}

export async function getCurrentUser(): Promise<UserOut> {
  return request<UserOut>("/auth/me");
}

export async function listUsers(): Promise<UserOut[]> {
  return request<UserOut[]>("/users");
}

export async function createUser(data: { email: string; name: string; password?: string }): Promise<{ id: string; email: string; name: string; password: string }> {
  return request("/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteUser(id: string): Promise<void> {
  await request(`/users/${id}`, { method: "DELETE" });
}
