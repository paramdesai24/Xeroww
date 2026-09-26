import type { Alert } from "../../types/platform";

export const ALERT_TYPES = [
  { value: "price_above", label: "Price above" },
  { value: "price_below", label: "Price below" },
  { value: "percentage_move", label: "Percentage move" },
  { value: "volume_spike", label: "Volume spike" },
  { value: "pattern_detected", label: "Candlestick pattern" },
  { value: "moving_average_cross", label: "Moving-average cross" },
] as const;

export function conditionSummary(alert: Pick<Alert, "alert_type" | "condition_payload">): string {
  const p = alert.condition_payload;
  const number = (key: string) => Number(p[key]).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  switch (alert.alert_type) {
    case "price_above": return `Above ₹${number("threshold")}`;
    case "price_below": return `Below ₹${number("threshold")}`;
    case "percentage_move": return `${String(p.direction)} ${number("pct")}% from ₹${number("reference_price")}`;
    case "volume_spike": return `Volume above ${number("multiplier")}x baseline`;
    case "pattern_detected": return `${String(p.pattern).replaceAll("_", " ")} pattern`;
    case "moving_average_cross": return `${number("fast_period")}/${number("slow_period")} MA, ${String(p.direction).replaceAll("_", " ")}`;
    default: return "Condition unavailable";
  }
}
