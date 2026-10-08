import { describe, expect, it } from "vitest";
import { featureChartPoints } from "./chartPoints";

describe("featureChartPoints", () => {
  it("keeps valid log-return values in their source positions", () => {
    const points = featureChartPoints([0.01, -0.02, 0.03]);
    expect(points.map((point) => point.value)).toEqual([0.01, -0.02, 0.03]);
    expect(points.map((point) => point.index)).toEqual([0, 1, 2]);
  });

  it("omits null rolling values without converting them to zero", () => {
    const points = featureChartPoints([null, 0.2, null, 0.4]);
    expect(points.map((point) => point.value)).toEqual([0.2, 0.4]);
    expect(points.map((point) => point.index)).toEqual([1, 3]);
  });

  it("returns no points when a feature is unavailable", () => {
    expect(featureChartPoints([null, null])).toEqual([]);
  });
});
