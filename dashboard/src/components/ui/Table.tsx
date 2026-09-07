// src/components/ui/Table.tsx
import React from "react";

interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
}

export const Table: React.FC<TableProps> = ({ children, className = "", ...props }) => (
  <table className={`w-full text-left border-collapse ${className}`} {...props}>
    {children}
  </table>
);

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <thead
    className={`sticky top-0 z-10 border-b border-[var(--border-subtle)] text-[10px] text-[var(--text-tertiary)] ${className}`}
    style={{ backgroundColor: "var(--surface-inset)", fontFamily: "var(--font-sans)" }}
    {...props}
  >
    {children}
  </thead>
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <tbody className={`divide-y divide-[var(--border-subtle)] ${className}`} {...props}>
    {children}
  </tbody>
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement> & { isSelected?: boolean }> = ({
  children,
  isSelected = false,
  className = "",
  style = {},
  ...props
}) => (
  <tr
    className={`transition-colors duration-100 ${
      isSelected ? "bg-[var(--surface-overlay)]" : "hover:bg-[var(--surface-overlay)]"
    } ${className}`}
    style={{
      cursor: "pointer",
      ...style,
    }}
    {...props}
  >
    {children}
  </tr>
);

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }> = ({
  children,
  align = "left",
  className = "",
  ...props
}) => (
  <th
    className={`px-3 py-2 font-medium tracking-wide uppercase ${
      align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
    } ${className}`}
    {...props}
  >
    {children}
  </th>
);

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }> = ({
  children,
  numeric = false,
  className = "",
  ...props
}) => (
  <td
    className={`px-3 py-2 text-xs text-[var(--text-primary)] ${
      numeric ? "text-right tabular-nums" : "text-left"
    } ${className}`}
    style={{ fontFamily: numeric ? "var(--font-mono)" : "var(--font-sans)" }}
    {...props}
  >
    {children}
  </td>
);
