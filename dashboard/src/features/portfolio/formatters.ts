export function formatMoney(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "Unavailable";
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: digits })}`;
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "Unavailable";
  return `${value.toFixed(digits)}%`;
}

export function formatQuantity(value: number): string {
  return value.toLocaleString("en-IN", { maximumFractionDigits: 4 });
}

export function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
