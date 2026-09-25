export function formatPrice(value: number | null): string {
  return value === null ? "Unavailable" : `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatMove(value: number | null): string {
  if (value === null) return "Unavailable";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatFreshness(value: string | null, prefix = "As of"): string {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : `${prefix} ${date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`;
}
