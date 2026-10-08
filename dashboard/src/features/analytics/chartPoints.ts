export interface FeatureChartPoint {
  x: number;
  y: number;
  value: number;
  index: number;
}

export function featureChartPoints(
  values: Array<number | null>,
  width = 720,
  height = 220,
): FeatureChartPoint[] {
  const available = values.flatMap((value, index) => value == null ? [] : [{ value, index }]);
  if (available.length === 0) return [];
  const low = Math.min(...available.map((point) => point.value));
  const high = Math.max(...available.map((point) => point.value));
  const range = high - low;
  const denominator = Math.max(values.length - 1, 1);
  return available.map(({ value, index }) => ({
    value,
    index,
    x: (index / denominator) * width,
    y: range === 0 ? height / 2 : height - ((value - low) / range) * (height - 36) - 18,
  }));
}
