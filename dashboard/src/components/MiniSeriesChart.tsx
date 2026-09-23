interface Props {
  values: number[];
  benchmark?: Array<number | null>;
  label?: string;
}

function points(values: number[], width: number, height: number): string {
  if (values.length < 2) return "";
  const low = Math.min(...values);
  const high = Math.max(...values);
  const range = high - low || 1;
  return values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - low) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export default function MiniSeriesChart({ values, benchmark = [], label = "Observed series" }: Props) {
  const cleanBenchmark = benchmark.filter((value): value is number => value !== null);
  return (
    <figure className="intelligence-chart" aria-label={label}>
      {values.length < 2 ? <div className="intelligence-empty">More observations are required for a chart.</div> : (
        <svg viewBox="0 0 800 260" role="img" aria-label={label} preserveAspectRatio="none">
          <line x1="0" y1="259" x2="800" y2="259" className="intelligence-chart__axis" />
          {cleanBenchmark.length > 1 && <polyline points={points(cleanBenchmark, 800, 240)} className="intelligence-chart__benchmark" />}
          <polyline points={points(values, 800, 240)} className="intelligence-chart__primary" />
        </svg>
      )}
    </figure>
  );
}
