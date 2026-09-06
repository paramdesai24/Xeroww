// src/types/platform.ts
// Platform domain types: watchlists, portfolios, alerts, journal

export interface WatchlistItem {
  id: number;
  symbol: string;
  created_at: string;
}

export interface Watchlist {
  id: number;
  name: string;
  is_default: boolean;
  created_at: string;
  item_count?: number;
  items?: WatchlistItem[];
}

export interface Holding {
  symbol: string;
  quantity: number;
  average_price: number;
  current_price: number | null;
  current_value: number | null;
  unrealized_pnl: number | null;
  unrealized_pnl_pct: number | null;
  allocation_pct: number | null;
}

export interface Portfolio {
  id: number;
  name: string;
  cash_balance: number;
  created_at: string;
}

export interface PortfolioSummary extends Portfolio {
  holdings_value: number;
  total_value: number;
  total_unrealized_pnl: number;
  total_unrealized_pnl_pct: number;
  holdings: Holding[];
}

export interface Transaction {
  id: number;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  execution_price: number;
  realized_pnl: number | null;
  timestamp: string;
}

export interface Alert {
  id: number;
  symbol: string;
  alert_type: string;
  condition_payload: Record<string, unknown>;
  enabled: boolean;
  triggered_at: string | null;
  created_at: string;
}

export interface AlertEvaluationResult {
  alert_id: number;
  symbol: string;
  alert_type: string;
  triggered: boolean;
  current_value: number | null;
  condition_payload: Record<string, unknown>;
  message: string;
}

export interface JournalEntry {
  id: number;
  symbol: string;
  action: string;
  thesis: string;
  context_snapshot: Record<string, unknown>;
  status: "OPEN" | "CLOSED" | "CANCELLED";
  timestamp: string;
  created_at: string;
}
