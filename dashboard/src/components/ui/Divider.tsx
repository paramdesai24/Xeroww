// src/components/ui/Divider.tsx
import React from "react";

interface DividerProps {
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export const Divider: React.FC<DividerProps> = ({
  orientation = "horizontal",
  className = "",
}) => {
  if (orientation === "vertical") {
    return (
      <div
        className={`w-px shrink-0 ${className}`}
        style={{ backgroundColor: "var(--border-subtle)", height: "100%" }}
      />
    );
  }

  return (
    <div
      className={`h-px w-full shrink-0 ${className}`}
      style={{ backgroundColor: "var(--border-subtle)" }}
    />
  );
};
