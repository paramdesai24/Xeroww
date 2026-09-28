import type { HTMLAttributes, ReactNode } from "react";
import { Surface } from "./Surface";

export function MetricCard({ label, value, note, tone, className = "" }: {
  label: string; value: ReactNode; note?: ReactNode; tone?: "positive" | "negative"; className?: string;
}) {
  return <Surface role="article" className={`ui-metric-card ${className}`}><span className="ui-metric-card__label">{label}</span><strong className={tone ? `is-${tone}` : undefined}>{value}</strong>{note && <small>{note}</small>}</Surface>;
}

export function SectionHeader({ title, detail, action, className = "" }: {
  title: string; detail?: ReactNode; action?: ReactNode; className?: string;
}) {
  return <header className={`ui-section-header ${className}`}><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action && <div className="ui-section-header__action">{action}</div>}</header>;
}

export function Pill({ selected = false, className = "", children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return <button type="button" className={`ui-pill ${selected ? "is-active" : ""} ${className}`.trim()} aria-pressed={selected} {...props}>{children}</button>;
}

export function Toolbar({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`ui-toolbar ${className}`.trim()} role="toolbar" {...props}>{children}</div>;
}

export function DataTable({ children, className = "", ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={`ui-data-table ${className}`.trim()} {...props}>{children}</table>;
}
