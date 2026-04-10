export interface TransactionOut {
  id: string;
  date: string;
  doc_number: string | null;
  debit: number | null;
  credit: number | null;
  signed_amount: number;
  counterparty: string | null;
  counterparty_bin: string | null;
  payment_description: string | null;
  knp: string | null;
  category_name: string | null;
  category_confidence: number;
  activity_type: string | null;
  direction: string | null;
  categorization_source: string | null;
  bank: string | null;
  account_number: string | null;
  wallet_name: string | null;
}

export interface TransactionListResponse {
  transactions: TransactionOut[];
  total: number;
  page: number;
  per_page: number;
}

export interface UploadResponse {
  file_id: string;
  filename: string;
  bank: string;
  account_number: string | null;
  client_name: string | null;
  period_start: string | null;
  period_end: string | null;
  transaction_count: number;
  categorized_count: number;
  transactions: TransactionOut[];
}

export interface CategoryOut {
  id: string;
  name: string;
  group: string | null;
  activity_type: string | null;
  description: string | null;
  category_group: string | null;
}

export interface PnLRow {
  category: string;
  category_group: string | null;
  activity_type: string | null;
  direction: string | null;
  amount: number;
}

export interface DashboardData {
  period_start: string | null;
  period_end: string | null;
  income_total: number;
  expense_total: number;
  net: number;
  transaction_count: number;
  pnl_rows: PnLRow[];
  expense_by_category: { category: string; amount: number; percentage: number }[];
  monthly_trend: { month: string; income: number; expense: number; net: number }[];
  account_balances: { account: string; bank: string; wallet: string; balance: number }[];
}
