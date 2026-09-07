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
    sm: "text-xs",
    md: "text-sm",
    lg: "text-lg font-bold",
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
        className="text-[10px] text-[var(--text-tertiary)] font-normal tracking-wide truncate"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {label}
      </span>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span
          className={`font-semibold text-[var(--text-primary)] leading-tight ${
            typeof value === "string" && /[a-zA-Z]{4,}/.test(value)
              ? "text-xs font-sans tracking-wide"
              : `tabular-nums font-mono ${valueSizes[size]}`
          }`}
        >
          {value}
        </span>
        {delta !== undefined && (
          <span className={`text-[10px] tabular-nums font-medium font-mono ${trendColor}`}>
            {delta}
          </span>
        )}
      </div>
    </div>
  );
};

