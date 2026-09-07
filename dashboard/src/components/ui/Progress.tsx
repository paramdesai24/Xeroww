// src/components/ui/Progress.tsx
import React from "react";

interface ProgressProps {
  value: number; // 0 - 100
  max?: number;
  color?: "amber" | "blue" | "green" | "red";
  height?: number;
  className?: string;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  max = 100,
  color = "amber",
  height = 3,
  className = "",
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const colorMap = {
    amber: "var(--accent-primary)",
    blue: "var(--accent-secondary)",
    green: "var(--positive)",
    red: "var(--negative)",
  };

  return (
    <div
      className={`w-full overflow-hidden shrink-0 ${className}`}
      style={{
        height,
        backgroundColor: "var(--border-default)",
      }}
    >
      <div
        className="h-full transition-all duration-150"
        style={{
          width: `${percentage}%`,
          backgroundColor: colorMap[color],
        }}
      />
    </div>
  );
};
