// src/components/ui/Price.tsx
import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface PriceProps {
  amount: number;
  change?: number;
  changePct?: number;
  currency?: string;
  size?: "sm" | "md" | "lg" | "hero";
  className?: string;
}

export const Price: React.FC<PriceProps> = ({
  amount,
  change,
  changePct,
  currency = "₹",
  size = "md",
  className = "",
}) => {
  const isPositive = (change ?? changePct ?? 0) > 0;
  const isNegative = (change ?? changePct ?? 0) < 0;

  const sizeStyles = {
    sm: { price: "type-data font-semibold", delta: "type-data" },
    md: { price: "type-data font-semibold", delta: "type-data" },
    lg: { price: "type-metric", delta: "type-data" },
    hero: { price: "type-metric", delta: "type-data" },
  };

  return (
    <div className={`flex items-baseline gap-2 ${className}`}>
      <span
        className={`text-[var(--text-primary)] tabular-nums ${sizeStyles[size].price}`}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {currency}
        {amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>

      {(change !== undefined || changePct !== undefined) && (
        <span
          className={`flex items-center gap-0.5 font-medium tabular-nums ${sizeStyles[size].delta} ${
            isPositive
              ? "text-[var(--positive)]"
              : isNegative
              ? "text-[var(--negative)]"
              : "text-[var(--text-tertiary)]"
          }`}
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {isPositive ? (
            <TrendingUp size={11} strokeWidth={2.5} />
          ) : isNegative ? (
            <TrendingDown size={11} strokeWidth={2.5} />
          ) : null}
          {change !== undefined && (
            <span>
              {change > 0 ? "+" : ""}
              {change.toFixed(2)}
            </span>
          )}
          {changePct !== undefined && (
            <span>
              ({changePct > 0 ? "+" : ""}
              {changePct.toFixed(2)}%)
            </span>
          )}
        </span>
      )}
    </div>
  );
};
