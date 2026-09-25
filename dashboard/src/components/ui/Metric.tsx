// src/components/ui/Metric.tsx
import React from "react";

interface MetricProps {
  label: string;
  value: string | number;
  delta?: string | number;
  trend?: "up" | "down" | "neutral";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const Metric: React.FC<MetricProps> = ({
  label,
  value,
  delta,
  trend,
  size = "md",
  className = "",
}) => {
  const valueSizes = {
    sm: "type-data",
    md: "type-data",
    lg: "type-metric",
  };

  const trendColor =
    trend === "up"
      ? "text-[var(--positive)]"
      : trend === "down"
      ? "text-[var(--negative)]"
      : "text-[var(--text-tertiary)]";

  return (
    <div className={`flex flex-col gap-0.5 min-w-0 ${className}`}>
      <span
        className="type-label text-[var(--text-tertiary)] truncate"
      >
        {label}
      </span>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span
          className={`font-semibold text-[var(--text-primary)] leading-tight ${
            typeof value === "string" && /[a-zA-Z]{4,}/.test(value)
              ? "type-body tracking-wide"
              : `tabular-nums font-mono ${valueSizes[size]}`
          }`}
        >
          {value}
        </span>
        {delta !== undefined && (
          <span className={`type-data ${trendColor}`}>
            {delta}
          </span>
        )}
      </div>
    </div>
  );
};
