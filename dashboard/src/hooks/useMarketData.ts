import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { normalizeError, type AppError } from "../api/errors";
import type { StockMeta, QuoteData, OHLCData, PatternData } from "../types/market";
import type { MarketStructureSummaryResponse } from "../types/structure";

interface MarketResult {
  symbol: string;
  quote: QuoteData | null;
  ohlc: OHLCData | null;
  pattern: PatternData | null;
  structure: MarketStructureSummaryResponse | null;
  error: AppError | null;
}

export interface MarketState {
  stocks: StockMeta[];
  quote: QuoteData | null;
  ohlc: OHLCData | null;
  pattern: PatternData | null;
  structure: MarketStructureSummaryResponse | null;
  loading: boolean;
  error: AppError | null;
  refresh: () => void;
}

export function useMarketData(symbol: string, enabled: boolean, period = "1mo", interval = "1d"): MarketState {
  const [stocks, setStocks] = useState<StockMeta[]>([]);
  const [result, setResult] = useState<MarketResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    api.getStocks().then(setStocks).catch(() => setStocks([]));
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !symbol) return;
    let cancelled = false;
    queueMicrotask(() => setLoading(true));
    Promise.allSettled([
      api.getQuote(symbol),
      api.getOHLC(symbol, period, interval),
      api.getPatterns(symbol),
      api.marketStructure.getSummary(symbol),
    ]).then(([quote, ohlc, pattern, structure]) => {
      if (cancelled) return;
      const failed = ohlc.status === "rejected" ? ohlc.reason : quote.status === "rejected" ? quote.reason : null;
      setResult({
        symbol,
        quote: quote.status === "fulfilled" ? quote.value : null,
        ohlc: ohlc.status === "fulfilled" ? ohlc.value : null,
        pattern: pattern.status === "fulfilled" ? pattern.value : null,
        structure: structure.status === "fulfilled" ? structure.value : null,
        error: failed ? normalizeError(failed, "Market data could not load.") : null,
      });
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [symbol, enabled, generation, period, interval]);

  const refresh = useCallback(() => setGeneration((value) => value + 1), []);
  const current = result?.symbol === symbol && enabled ? result : null;
  return {
    stocks,
    quote: current?.quote ?? null,
    ohlc: current?.ohlc ?? null,
    pattern: current?.pattern ?? null,
    structure: current?.structure ?? null,
    loading: enabled && (loading || current === null),
    error: current?.error ?? null,
    refresh,
  };
}
