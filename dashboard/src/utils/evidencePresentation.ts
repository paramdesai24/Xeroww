import type { EvidenceItem } from "../types/decision";

export function shortEvidenceExplanation(item: EvidenceItem): string {
  const summaries: Record<string, string> = {
    regime: "Defines the current market regime",
    signal_alignment: "Shows directional signal agreement",
    volume: "Measures volume behind price movement",
    moving_averages: "Shows the prevailing trend structure",
    support_proximity: "Frames the nearest downside reference",
    resistance_proximity: "Frames the nearest upside reference",
    latest_pattern: "Checks the latest qualifying pattern",
    fuzzy_momentum: "Summarizes momentum strength and direction",
    fuzzy_volume: "Summarizes relative volume participation",
    fuzzy_trend: "Summarizes longer-term trend strength",
    fuzzy_structure: "Summarizes nearby structural strength",
    data_quality: "States freshness of captured data",
  };
  return summaries[item.key] ?? "Adds context to this decision";
}
