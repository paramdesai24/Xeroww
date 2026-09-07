// src/components/ui/Panel.tsx
import React from "react";

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  accentEdge?: "primary" | "secondary" | "positive" | "negative" | "none";
  children: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({
  elevated = false,
  accentEdge = "none",
  className = "",
  style = {},
  children,
  ...props
}) => {
  const borderTopMap = {
    primary: "2px solid var(--accent-primary)",
    secondary: "2px solid var(--accent-secondary)",
    positive: "2px solid var(--positive)",
    negative: "2px solid var(--negative)",
    none: undefined,
  };

  return (
    <div
      className={`border border-[var(--border-default)] transition-colors duration-150 ${className}`}
      style={{
        backgroundColor: elevated ? "var(--surface-elevated)" : "var(--surface)",
        borderTop: borderTopMap[accentEdge],
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
