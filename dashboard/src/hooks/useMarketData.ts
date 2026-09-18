import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import type { StockMeta, QuoteData, OHLCData, PatternData } from "../types/market";
import type { MarketStructureSummaryResponse } from "../types/structure";

const DEFAULT_SYMBOL = "RELIANCE.NS";

export interface MarketState {
  stocks: StockMeta[];
  activeSymbol: string;
  quote: QuoteData | null;
  ohlc: OHLCData | null;
  pattern: PatternData | null;
  structure: MarketStructureSummaryResponse | null;
  loading: boolean;
  error: string | null;
  setActiveSymbol: (symbol: string) => void;
  refresh: () => void;
}

export function useMarketData(): MarketState {
  const [stocks, setStocks] = useState<StockMeta[]>([]);
  const [activeSymbol, setActiveSymbol] = useState<string>(DEFAULT_SYMBOL);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [ohlc, setOhlc] = useState<OHLCData | null>(null);
  const [pattern, setPattern] = useState<PatternData | null>(null);
  const [structure, setStructure] = useState<MarketStructureSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch watchlist once on mount
  useEffect(() => {
    api.getStocks().then(setStocks).catch(() => setStocks([]));
  }, []);

  const fetchStockData = useCallback(async (symbol: string) => {
    setLoading(true);
    setError(null);
    try {
      const [quoteData, ohlcData, patternData, structureData] = await Promise.all([
        api.getQuote(symbol),
        api.getOHLC(symbol),
        api.getPatterns(symbol),
        api.marketStructure.getSummary(symbol).catch(() => null),
      ]);
      setQuote(quoteData);
      setOhlc(ohlcData);
      setPattern(patternData);
      setStructure(structureData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load market data";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch whenever the active symbol changes
  useEffect(() => {
    queueMicrotask(() => void fetchStockData(activeSymbol));
  }, [activeSymbol, fetchStockData]);

  return {
    stocks,
    activeSymbol,
    quote,
    ohlc,
    pattern,
    structure,
    loading,
    error,
    setActiveSymbol,
    refresh: () => fetchStockData(activeSymbol),
  };
}

