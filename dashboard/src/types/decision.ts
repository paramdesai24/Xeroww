export type DecisionDirection = "BULLISH" | "BEARISH" | "NEUTRAL";
export type DecisionIntent = "ENTER" | "ADD" | "HOLD" | "REDUCE" | "EXIT" | "WATCH" | "AVOID";
export type DecisionSource = "MANUAL" | "MARKET" | "REPLAY" | "PORTFOLIO" | "ALERT";

export interface EvidenceItem {
  key: string;
  category: string;
  source_engine: string;
  label: string;
  stance: string;
  relationship: "aligned" | "conflicting" | "contextual" | "insufficient";
  explanation: string;
  value: unknown;
  algorithm_version: string;
}

export interface EvidenceReport {
  version: string;
  summary: string;
  counts: Record<string, number>;
  items: EvidenceItem[];
  methodology_note: string;
}

export interface DecisionPlan {
  symbol: string;
  direction: DecisionDirection;
  intent: DecisionIntent;
  holding_period: string;
  setup_type: string;
  entry_trigger?: string | null;
  entry_zone_low?: number | null;
  entry_zone_high?: number | null;
  invalidation_price?: number | null;
  target_zone_low?: number | null;
  target_zone_high?: number | null;
  max_risk_pct?: number | null;
  max_allocation_pct?: number | null;
  capital_base?: number | null;
  confidence: number;
  thesis: string;
  change_mind_condition: string;
  portfolio_id?: number | null;
  source_context: DecisionSource;
  source_as_of?: string | null;
  source_period: string;
}

export interface DecisionPreview {
  symbol: string;
  resolved_as_of: string;
  snapshot_hash: string;
  data_quality: { state: string; note: string };
  evidence: EvidenceReport;
  risk: Record<string, unknown>;
  warnings: string[];
}

export interface DecisionRiskSnapshot extends Record<string, unknown> {
  applicable?: boolean;
  complete?: boolean;
  formula_version?: string;
  recommended_quantity?: number;
  capital_deployed?: number;
  potential_loss?: number;
  potential_reward?: number;
  reward_to_risk?: number;
  limiting_factor?: string;
  warnings?: string[];
}

export interface DecisionSnapshotMetadata {
  provider?: string;
  resolved_as_of?: string;
  bar_count?: number;
  schema_version?: number;
  data_quality?: { state: string; note: string };
  [key: string]: unknown;
}

export interface DecisionContextSnapshot extends Record<string, unknown> {
  metadata?: DecisionSnapshotMetadata;
  evidence?: EvidenceReport;
}

export interface DecisionSummary {
  id: number;
  symbol: string;
  direction: DecisionDirection | null;
  intent: DecisionIntent | string | null;
  status: "OPEN" | "CLOSED" | "CANCELLED";
  confidence: number | null;
  holding_period: string | null;
  source_context: DecisionSource | null;
  source_as_of: string | null;
  timestamp: string;
  ticket_version: number;
  evidence_summary: string | null;
  evidence_counts: Record<string, number>;
  data_quality: string | null;
}

export interface DecisionAmendment {
  id: number;
  amendment_type: string;
  reason: string;
  payload: Record<string, unknown>;
  from_status: string | null;
  to_status: string | null;
  created_at: string;
}

export interface DecisionDetail extends DecisionPlan {
  id: number;
  status: "OPEN" | "CLOSED" | "CANCELLED";
  ticket_version: number;
  snapshot_hash: string | null;
  context_snapshot: DecisionContextSnapshot;
  risk_snapshot: DecisionRiskSnapshot;
  supporting_evidence_keys: string[];
  conflicting_evidence_keys: string[];
  submitted_at: string | null;
  closed_at: string | null;
  timestamp: string;
  created_at: string;
  version: number;
  amendments: DecisionAmendment[];
}

export interface DecisionList {
  items: DecisionSummary[];
  total: number;
  skip: number;
  limit: number;
}
