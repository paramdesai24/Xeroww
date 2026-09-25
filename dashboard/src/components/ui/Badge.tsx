// src/components/ui/Badge.tsx
import React from "react";

interface BadgeProps {
  variant?: "amber" | "blue" | "green" | "red" | "neutral" | "outline";
  size?: "sm" | "md";
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = "neutral",
  size = "sm",
  dot = false,
  children,
  className = "",
}) => {
  const variantStyles = {
    amber: "bg-[var(--accent-subtle)] text-[var(--accent-primary)] border-[var(--accent-border)]",
    blue: "bg-[var(--accent-sec-subtle)] text-[var(--accent-secondary)] border-[var(--accent-sec-border)]",
    green: "bg-[var(--positive-subtle)] text-[var(--positive)] border-[var(--positive-border)]",
    red: "bg-[var(--negative-subtle)] text-[var(--negative)] border-[var(--negative-border)]",
    neutral: "bg-[var(--surface-overlay)] text-[var(--text-secondary)] border-[var(--border-default)]",
    outline: "bg-transparent text-[var(--text-tertiary)] border-[var(--border-default)]",
  };

  const dotColor = {
    amber: "bg-[var(--accent-primary)]",
    blue: "bg-[var(--accent-secondary)]",
    green: "bg-[var(--positive)]",
    red: "bg-[var(--negative)]",
    neutral: "bg-[var(--text-tertiary)]",
    outline: "bg-[var(--border-strong)]",
  };

  const sizeStyles = {
    sm: "px-1.5 py-0.5 text-label",
    md: "px-2 py-0.5 text-label",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium border rounded-none uppercase tracking-wider shrink-0 select-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColor[variant]}`} />}
      {children}
    </span>
  );
};
