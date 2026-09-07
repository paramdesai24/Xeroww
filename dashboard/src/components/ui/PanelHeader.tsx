// src/components/ui/PanelHeader.tsx
import React from "react";

interface PanelHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({
  title,
  subtitle,
  badge,
  action,
  icon,
  className = "",
}) => {
  return (
    <div
      className={`px-3 py-2.5 flex items-center justify-between border-b border-[var(--border-subtle)] select-none ${className}`}
      style={{ backgroundColor: "var(--surface-inset)" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="text-[var(--text-secondary)] shrink-0">{icon}</span>}
        <div className="flex flex-col min-w-0">
          <span
            className="text-xs font-semibold text-[var(--text-primary)] tracking-normal truncate"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {title}
          </span>
          {subtitle && (
            <span className="text-[10px] text-[var(--text-tertiary)] truncate">
              {subtitle}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {badge}
        {action}
      </div>
    </div>
  );
};
