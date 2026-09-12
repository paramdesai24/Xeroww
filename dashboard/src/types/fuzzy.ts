/**
 * dashboard/src/types/fuzzy.ts
 * ─────────────────────────────────────────────────────────────────────────
 * TypeScript type definitions for the Xeroww Fuzzy Explainability Engine.
 *
 * These types mirror the Python FuzzyExplainabilityReport DTO exactly.
 * All fields are readonly — the UI never mutates FIS output.
 *
 * Philosophy:
 *   - No buy/sell signals
 *   - No ML or prediction
 *   - Pure linguistic classification of current market analytics state
 */

// ---------------------------------------------------------------------------
// Membership function activation result (single term)
// ---------------------------------------------------------------------------
export interface FuzzyTermActivation {
  readonly term: string;   // e.g., "LARGE_POSITIVE", "HIGH", "BULLISH"
  readonly value: number;  // [0.0, 1.0] — degree of membership
}

// ---------------------------------------------------------------------------
// Fired rule record (audit trail per Mamdani rule)
// ---------------------------------------------------------------------------
export interface FiredRule {
  readonly description: string;         // human-readable rule description
  readonly consequent_term: string;     // output label if this rule fires
  readonly activation: number;          // firing strength [0.0, 1.0]
  readonly fired: boolean;              // true if activation > 0
  readonly reasoning: string;           // full IF...THEN...→ strength string
  readonly antecedent: ReadonlyArray<{
    readonly variable: string;
    readonly term: string;
    readonly modifier: "IS" | "IS_NOT";
  }>;
}

// ---------------------------------------------------------------------------
// Single FIS dimension result
// ---------------------------------------------------------------------------
export type MomentumLabel  = "WEAK" | "MODERATE" | "STRONG" | "SURGING";
export type VolumeLabel    = "DRY" | "NORMAL" | "ELEVATED" | "CLIMACTIC";
export type TrendLabel     = "BEARISH" | "NEUTRAL" | "BULLISH" | "STRONGLY_BULLISH";
export type StructureLabel = "BROKEN" | "CONTESTED" | "FIRM" | "DOMINANT";
export type DimensionName  = "momentum" | "volume" | "trend" | "structure";

export interface FuzzyDimension {
  readonly name: DimensionName;
  readonly label: MomentumLabel | VolumeLabel | TrendLabel | StructureLabel | string;
  readonly activation: number;                          // defuzzified [0.0–1.0]
  readonly activations: ReadonlyArray<FuzzyTermActivation>; // primary variable MF values
  readonly fired_rules: ReadonlyArray<FiredRule>;       // all rules evaluated
  readonly narrative: string;                           // plain-language summary
  readonly inputs: Readonly<Record<string, number>>;    // raw numeric inputs
}

// ---------------------------------------------------------------------------
// Overall composite label
// ---------------------------------------------------------------------------
export type OverallLabel =
  | "STRONGLY_BULLISH"
  | "MODERATELY_BULLISH"
  | "NEUTRAL"
  | "MODERATELY_BEARISH"
  | "STRONGLY_BEARISH"
  | "INSUFFICIENT_DATA"
  | string;

// ---------------------------------------------------------------------------
// Top-level FuzzyExplainabilityReport
// ---------------------------------------------------------------------------
export interface FuzzyExplainabilityReport {
  readonly symbol: string;
  readonly timestamp: string;                  // candle date of last bar
  readonly current_price: number;
  readonly dimensions: ReadonlyArray<FuzzyDimension>;
  readonly overall_label: OverallLabel;
  readonly overall_activation: number;         // weighted composite [0.0–1.0]
  readonly methodology_note: string;
  readonly computed_at: string;                // ISO timestamp of inference run
  readonly computation_ms: number;             // diagnostic: inference time
}
