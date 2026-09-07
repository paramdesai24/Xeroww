// src/components/ui/Skeleton.tsx
import React from "react";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = 14,
  className = "",
}) => {
  return (
    <div
      className={`animate-pulse ${className}`}
      style={{
        width,
        height,
        backgroundColor: "var(--surface-elevated)",
      }}
    />
  );
};
