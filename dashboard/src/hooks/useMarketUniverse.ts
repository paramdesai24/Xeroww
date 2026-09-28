import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { QuoteData, StockMeta } from "../types/market";
import type { MarketBreadthResponse } from "../types/structure";

export interface MarketUniverseState {
  stocks: StockMeta[];
  quotes: QuoteData[];
  breadth: MarketBreadthResponse | null;
  loading: boolean;
  error: string | null;
  asOf: string | null;
}

export function useMarketUniverse(): MarketUniverseState {
  const [stocks, setStocks] = useState<StockMeta[]>([]);
  const [quotes, setQuotes] = useState<QuoteData[]>([]);
  const [breadth, setBreadth] = useState<MarketBreadthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.getStocks().then(async (catalog) => {
      const [snapshotResult, breadthResult] = await Promise.allSettled([
        api.getQuotes(catalog.map((stock) => stock.symbol)),
        api.intelligence.getBreadth(),
      ]);
      if (!active) return;
      setStocks(catalog);
      if (snapshotResult.status === "fulfilled") {
        setQuotes(snapshotResult.value.rows.flatMap((row) => row.quote ? [row.quote] : []));
        setAsOf(snapshotResult.value.as_of);
      }
      if (breadthResult.status === "fulfilled") setBreadth(breadthResult.value);
      if (snapshotResult.status === "rejected" && breadthResult.status === "rejected") setError("Market overview is temporarily unavailable.");
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setError("The supported market universe could not be loaded.");
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  return useMemo(() => ({ stocks, quotes, breadth, loading, error, asOf }), [stocks, quotes, breadth, loading, error, asOf]);
}
