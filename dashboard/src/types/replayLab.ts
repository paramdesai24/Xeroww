import type { DecisionPlan, DecisionPreview } from "./decision";

export type ReplayStatus = "SETUP" | "AWAITING_DECISION" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ABANDONED";

export interface ReplaySessionCreate {
  symbol?: string | null;
  randomize_symbol: boolean;
  start_date?: string | null;
  randomize_start: boolean;
  timeframe: "1d" | "1h" | "15m";
  session_bars: number;
  starting_capital: number;
  maximum_risk_pct: number;
  setup_category?: string | null;
  hide_symbol: boolean;
  hide_calendar_date: boolean;
}

export interface ReplaySessionSummary {
  id: number;
  status: ReplayStatus;
  symbol: string;
  timeframe: string;
  setup_category: string | null;
  current_index: number;
  start_index: number;
  end_index: number;
  current_market_time: string;
  completion_reason: string | null;
  process_score: number | null;
  version: number;
  created_at: string;
}

export interface ReplaySessionList {
  items: ReplaySessionSummary[];
  total: number;
  skip: number;
  limit: number;
}

export interface ReplaySessionState {
  id: number;
  status: ReplayStatus;
  symbol: string;
  symbol_hidden: boolean;
  calendar_date_hidden: boolean;
  timeframe: string;
  setup_category: string | null;
  starting_capital: number;
  current_cash: number;
  maximum_risk_pct: number;
  current_index: number;
  visible_step: number;
  total_session_steps: number;
  remaining_bars: number;
  current_market_time: string;
  version: number;
  decision_required: boolean;
  active_decision_id: number | null;
  position: { quantity: number; average_entry: number; realized_pnl: number; is_open: boolean };
  candles: Array<{ time: string; open: number; high: number; low: number; close: number; volume: number }>;
  analytics: Record<string, unknown>;
  compact_evidence: Array<{ key: string; label: string; explanation: string }>;
  provenance: Record<string, unknown>;
}

export interface ReplayEvent {
  id: number;
  sequence_number: number;
  event_type: string;
  replay_index: number;
  simulated_at: string;
  occurred_at: string;
  decision_id: number | null;
  payload: Record<string, unknown>;
  evidence_snapshot_hash: string | null;
}

export interface ReplayReview {
  session: ReplaySessionSummary;
  process: { score: number | null; grade: string | null; components: Record<string, Record<string, unknown>>; version: string };
  outcome: Record<string, unknown>;
  behaviour_observations: Array<Record<string, unknown>>;
  events: ReplayEvent[];
}

export interface ReplayAnalytics {
  session_count: number;
  eligible_outcome_count: number;
  summary: Record<string, number | null>;
  groups: Record<string, Array<Record<string, unknown>>>;
  behaviour_observations: Array<Record<string, unknown>>;
}

export type ReplayDecisionPreviewRequest = DecisionPlan;
export type ReplayDecisionPreview = DecisionPreview;

