import { describe, expect, it } from "vitest";
import { formatMoney, formatPercent, formatQuantity } from "./formatters";

describe("portfolio formatters", () => {
  it("formats Indian currency without noisy decimals", () => {
    expect(formatMoney(125000.5)).toBe("₹1,25,000.5");
  });

  it("uses a readable unavailable state", () => {
    expect(formatMoney(null)).toBe("Unavailable");
    expect(formatPercent(undefined)).toBe("Unavailable");
  });

  it("preserves fractional paper quantities", () => {
    expect(formatQuantity(12.34567)).toBe("12.3457");
  });
});
