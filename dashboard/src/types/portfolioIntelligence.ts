export interface PortfolioSnapshotHolding {
  symbol: string;
  sector: string;
  quantity: number;
  average_price: number;
  cost_basis: number;
  market_price: number;
  market_value: number;
  unrealized_pnl: number;
  portfolio_weight: number;
  data_as_of: string | null;
  is_stale: boolean;
}

export interface PortfolioSnapshot {
  id: number;
  portfolio_id: number;
  as_of: string;
  valuation_date: string;
  snapshot_sequence: number;
  cash: number;
  holdings_value: number;
  total_value: number;
  cost_basis: number;
  realized_pnl_to_date: number;
  unrealized_pnl: number;
  benchmark_symbol: string;
  benchmark_close: number | null;
  open_decision_count: number;
  data_quality: Record<string, unknown>;
  source_fingerprint: string;
  valuation_version: string;
  holdings: PortfolioSnapshotHolding[];
}

export interface PortfolioSnapshotList {
  items: PortfolioSnapshot[];
  total: number;
  skip: number;
  limit: number;
}

export interface PortfolioAnalytics {
  portfolio_id: number;
  latest_snapshot_id: number | null;
  data_quality: { state?: string };
  metrics: Record<string, unknown>;
  series: Record<string, unknown>;
  warnings: Array<Record<string, unknown>>;
}

export interface RiskPolicy {
  portfolio_id: number;
  max_single_stock_pct: number;
  max_sector_pct: number;
  max_planned_loss_pct: number;
  max_total_open_risk_pct: number;
  correlation_warning: number;
  drawdown_review_pct: number;
  minimum_observations: number;
  version: number;
}
