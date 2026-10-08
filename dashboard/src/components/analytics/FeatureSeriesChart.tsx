import { featureChartPoints, type FeatureChartPoint } from "../../features/analytics/chartPoints";

interface FeatureSeriesChartProps {
  title: string;
  description: string;
  values: Array<number | null>;
  valueFormatter?: (value: number) => string;
}

function segments(points: FeatureChartPoint[]): FeatureChartPoint[][] {
  return points.reduce<FeatureChartPoint[][]>((groups, point) => {
    const current = groups.at(-1);
    if (!current || current.at(-1)!.index + 1 !== point.index) groups.push([point]);
    else current.push(point);
    return groups;
  }, []);
}

export default function FeatureSeriesChart({
  title,
  description,
  values,
  valueFormatter = (value) => value.toFixed(4),
}: FeatureSeriesChartProps) {
  const points = featureChartPoints(values);
  const latest = points.at(-1)?.value;
  return (
    <section className="feature-chart" aria-label={title}>
      <header><div><h3>{title}</h3><p>{description}</p></div><strong>{latest == null ? "Not available" : valueFormatter(latest)}</strong></header>
      {points.length === 0 ? <div className="feature-chart__empty">No values available in this range.</div> : (
        <svg viewBox="0 0 720 220" role="img" aria-label={`${title} over time`} preserveAspectRatio="none">
          <line x1="0" y1="110" x2="720" y2="110" className="feature-chart__baseline" />
          {segments(points).map((segment) => segment.length > 1 ? (
            <polyline key={segment[0].index} points={segment.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")} className="feature-chart__line" />
          ) : <circle key={segment[0].index} cx={segment[0].x} cy={segment[0].y} r="4" className="feature-chart__point" />)}
        </svg>
      )}
    </section>
  );
}
