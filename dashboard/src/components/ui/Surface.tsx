// src/components/ui/Surface.tsx
import React from "react";

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  level?: "canvas" | "surface" | "elevated" | "inset";
  accentEdge?: "primary" | "secondary" | "positive" | "negative" | "none";
  children: React.ReactNode;
}

export const Surface: React.FC<SurfaceProps> = ({
  level = "surface",
  accentEdge = "none",
  className = "",
  style = {},
  children,
  ...props
}) => {
  const bgMap = {
    canvas: "var(--canvas)",
    surface: "var(--surface)",
    elevated: "var(--surface-elevated)",
    inset: "var(--surface-inset)",
  };

  const borderTopMap = {
    primary: "2px solid var(--accent-primary)",
    secondary: "2px solid var(--accent-secondary)",
    positive: "2px solid var(--positive)",
    negative: "2px solid var(--negative)",
    none: undefined,
  };

  return (
    <div
      className={`ui-surface ${className}`.trim()}
      style={{
        ...(level === "surface" ? {} : { backgroundColor: bgMap[level] }),
        borderTop: borderTopMap[accentEdge],
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
