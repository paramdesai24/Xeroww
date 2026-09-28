import { useId } from "react";

interface Props {
  values: number[];
  benchmark?: Array<number | null>;
  label?: string;
}

function points(values: number[], width: number, height: number): string {
  if (values.length < 2) return "";
  const low = Math.min(...values);
  const high = Math.max(...values);
  const range = high - low;
  return values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = range === 0 ? height / 2 : height - ((value - low) / range) * (height - 36) - 18;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export default function MiniSeriesChart({ values, benchmark = [], label = "Observed series" }: Props) {
  const gradientId = useId().replace(/:/g, "");
  const cleanBenchmark = benchmark.filter((value): value is number => value !== null);
  const primaryPoints = points(values, 800, 260);
  return (
    <figure className="intelligence-chart" aria-label={label}>
      {values.length === 0 ? <div className="intelligence-empty">No series observations available yet.</div> : (
        <svg viewBox="0 0 800 260" role="img" aria-label={label} preserveAspectRatio="none">
          <defs><linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--accent-primary)" stopOpacity=".24" /><stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0" /></linearGradient></defs>
          <line x1="0" y1="259" x2="800" y2="259" className="intelligence-chart__axis" />
          {cleanBenchmark.length > 1 && <polyline points={points(cleanBenchmark, 800, 240)} className="intelligence-chart__benchmark" />}
          {values.length > 1 ? <><polygon points={`0,259 ${primaryPoints} 800,259`} fill={`url(#${gradientId})`} /><polyline points={primaryPoints} className="intelligence-chart__primary" /></> : <><line x1="0" y1="130" x2="800" y2="130" className="intelligence-chart__single-line" /><circle cx="400" cy="130" r="5" className="intelligence-chart__point" /></>}
        </svg>
      )}
    </figure>
  );
}
