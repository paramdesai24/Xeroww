// src/hooks/useSelectedCandle.ts
// Hook managing active candlestick forensic selection and memoized X-Ray state.
// Handles keyboard navigation (Escape), responsive drawer state, and zero-duplicate analytics.

import { useState, useEffect, useCallback, useMemo } from "react";
import type { OHLCBar } from "../types/market";
import type { MarketStructureSummaryResponse } from "../types/structure";
import type { XRayInspectionData } from "../types/xray";
import { calculateCandleAnatomy } from "../components/xray/utils/anatomy";
import { evaluateCandlePattern } from "../components/xray/utils/pattern";
import { calculateMarketStructureContext } from "../components/xray/utils/structure";
import { generateKafkaProvenance } from "../components/xray/utils/provenance";

interface UseSelectedCandleOptions {
  symbol: string;
  candles: OHLCBar[] | undefined;
  structure?: MarketStructureSummaryResponse | null;
  onCandleChanged?: (candle: OHLCBar | null) => void;
}

export interface UseSelectedCandleReturn {
  selectedCandle: OHLCBar | null;
  isDrawerOpen: boolean;
  activeCandleIndex: number;
  totalCandles: number;
  inspectionData: XRayInspectionData | null;
  selectCandle: (candle: OHLCBar) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  selectNextCandle: () => void;
  selectPrevCandle: () => void;
}

export function useSelectedCandle({
  symbol,
  candles = [],
  structure = null,
  onCandleChanged,
}: UseSelectedCandleOptions): UseSelectedCandleReturn {
  const [selectedCandle, setSelectedCandle] = useState<OHLCBar | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Close drawer or update selection when active symbol switches
  useEffect(() => {
    setSelectedCandle(null);
  }, [symbol]);

  // Global Escape key listener to close X-Ray inspection drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDrawerOpen]);

  // Find index of selected candle or fallback to latest
  const activeCandleIndex = useMemo(() => {
    if (!candles || candles.length === 0) return -1;
    if (!selectedCandle) return candles.length - 1;

    const selectedTime = String(selectedCandle.time);
    const idx = candles.findIndex((c) => String(c.time) === selectedTime);
    return idx >= 0 ? idx : candles.length - 1;
  }, [candles, selectedCandle]);

  // Active bar displayed in X-Ray (defaults to latest if none selected)
  const activeBar = useMemo(() => {
    if (activeCandleIndex >= 0 && candles && candles[activeCandleIndex]) {
      return candles[activeCandleIndex];
    }
    return selectedCandle ?? (candles && candles.length > 0 ? candles[candles.length - 1] : null);
  }, [candles, activeCandleIndex, selectedCandle]);

  // Prior bar for multi-candle patterns and deltas
  const priorBar = useMemo(() => {
    if (activeCandleIndex > 0 && candles && candles[activeCandleIndex - 1]) {
      return candles[activeCandleIndex - 1];
    }
    return null;
  }, [candles, activeCandleIndex]);

  // Memoized deep forensic analytics calculations — re-computed only when active bar or symbol changes
  const inspectionData = useMemo<XRayInspectionData | null>(() => {
    if (!activeBar || !candles || candles.length === 0) return null;

    const anatomy = calculateCandleAnatomy(activeBar, priorBar);
    const pattern = evaluateCandlePattern(activeBar, anatomy, priorBar);
    const { marketStructure, rawSupport, rawResistance } = calculateMarketStructureContext(
      activeBar,
      candles,
      activeCandleIndex >= 0 ? activeCandleIndex : candles.length - 1,
      structure
    );
    const provenance = generateKafkaProvenance(
      symbol,
      activeBar,
      activeCandleIndex >= 0 ? activeCandleIndex : candles.length - 1
    );

    return {
      symbol,
      candle: activeBar,
      timestamp: String(activeBar.time),
      candleIndex: activeCandleIndex >= 0 ? activeCandleIndex : candles.length - 1,
      totalCandles: candles.length,
      anatomy,
      pattern,
      marketStructure,
      provenance,
      rawSRZoneSupport: rawSupport,
      rawSRZoneResistance: rawResistance,
    };
  }, [activeBar, priorBar, candles, activeCandleIndex, structure, symbol]);

  const selectCandle = useCallback(
    (candle: OHLCBar) => {
      setSelectedCandle(candle);
      setIsDrawerOpen(true);
      onCandleChanged?.(candle);
    },
    [onCandleChanged]
  );

  const openDrawer = useCallback(() => {
    if (!selectedCandle && candles && candles.length > 0) {
      setSelectedCandle(candles[candles.length - 1]);
    }
    setIsDrawerOpen(true);
  }, [selectedCandle, candles]);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const toggleDrawer = useCallback(() => {
    setIsDrawerOpen((prev) => {
      if (!prev && !selectedCandle && candles && candles.length > 0) {
        setSelectedCandle(candles[candles.length - 1]);
      }
      return !prev;
    });
  }, [selectedCandle, candles]);

  const selectNextCandle = useCallback(() => {
    if (!candles || candles.length === 0) return;
    const nextIdx = Math.min(candles.length - 1, activeCandleIndex + 1);
    setSelectedCandle(candles[nextIdx]);
  }, [candles, activeCandleIndex]);

  const selectPrevCandle = useCallback(() => {
    if (!candles || candles.length === 0) return;
    const prevIdx = Math.max(0, activeCandleIndex - 1);
    setSelectedCandle(candles[prevIdx]);
  }, [candles, activeCandleIndex]);

  return {
    selectedCandle,
    isDrawerOpen,
    activeCandleIndex,
    totalCandles: candles ? candles.length : 0,
    inspectionData,
    selectCandle,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    selectNextCandle,
    selectPrevCandle,
  };
}
