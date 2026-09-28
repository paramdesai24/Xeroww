interface SparklineProps {
  values: number[];
  positive?: boolean;
  label?: string;
}

export default function Sparkline({ values, positive = true, label = "Price trend" }: SparklineProps) {
  if (values.length < 2) return <span className="market-sparkline market-sparkline--empty" aria-label="Trend unavailable" />;
  const low = Math.min(...values);
  const high = Math.max(...values);
  const range = high - low || 1;
  const points = values.map((value, index) => `${(index / (values.length - 1) * 100).toFixed(1)},${(30 - ((value - low) / range) * 28).toFixed(1)}`).join(" ");
  return <svg className={`market-sparkline ${positive ? "is-positive" : "is-negative"}`} viewBox="0 0 100 32" preserveAspectRatio="none" role="img" aria-label={label}><polyline points={points} /></svg>;
}
