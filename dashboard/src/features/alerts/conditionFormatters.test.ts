import { describe, expect, it } from "vitest";
import { conditionSummary } from "./conditionFormatters";

describe("alert condition summaries", () => {
  it("shows human-readable thresholds without exposing payload JSON", () => {
    expect(conditionSummary({ alert_type: "price_above", condition_payload: { threshold: 1250 } })).toBe("Above ₹1,250");
  });

  it("summarizes technical conditions concisely", () => {
    expect(conditionSummary({ alert_type: "moving_average_cross", condition_payload: { fast_period: 9, slow_period: 21, direction: "golden_cross" } })).toBe("9/21 MA, golden cross");
  });
});
