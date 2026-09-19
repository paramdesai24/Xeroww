import type { StockMeta } from "../types/market";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rank(stock: StockMeta, query: string, matcher: RegExp): number {
  const name = stock.display_name.toUpperCase();
  const symbol = stock.symbol.replace(/\.NS$/i, "").toUpperCase();
  const words = name.split(/[^A-Z0-9]+/).filter(Boolean);

  if (name.startsWith(query)) return 0;
  if (words.some((word) => word.startsWith(query))) return 1;
  if (symbol.startsWith(query)) return 2;
  if (matcher.test(name)) return 3;
  matcher.lastIndex = 0;
  if (matcher.test(symbol)) return 4;
  return Number.POSITIVE_INFINITY;
}

export function searchSymbols(stocks: StockMeta[], rawQuery: string, limit = 12): StockMeta[] {
  const query = rawQuery.trim().toUpperCase();
  if (!query) return [];

  const matcher = new RegExp(escapeRegex(query), "i");
  return stocks
    .map((stock) => ({ stock, score: rank(stock, query, matcher) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((left, right) => left.score - right.score || left.stock.display_name.localeCompare(right.stock.display_name))
    .slice(0, limit)
    .map(({ stock }) => stock);
}
