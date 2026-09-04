// src/App.tsx
// Root application component — assembles the Xeroww Institutional Market Terminal layout.

import { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import ChartPanel from "./components/ChartPanel";
import OHLCTable from "./components/OHLCTable";
import OHLCStats from "./components/OHLCStats";
import CandleAnatomy from "./components/CandleAnatomy";
import PatternCard from "./components/PatternCard";
import Footer from "./components/Footer";
import { useMarketData } from "./hooks/useMarketData";
import type { OHLCBar } from "./types/market";

export default function App() {
  const { stocks, activeSymbol, quote, ohlc, pattern, loading, error, setActiveSymbol } =
    useMarketData();

  // Selected candle for dynamic Candle Anatomy (defaults to latest if none selected)
  const [selectedCandle, setSelectedCandle] = useState<OHLCBar | null>(null);

  // Reset selected candle when switching stocks
  useEffect(() => {
    setSelectedCandle(null);
  }, [activeSymbol]);

  // Active candle displayed in Candle Anatomy
  const activeCandle = selectedCandle ?? ohlc?.candles.at(-1) ?? null;

  return (
    <div className="flex flex-col h-screen bg-[#000000] text-[#FAFAFA] overflow-hidden select-none">
      {/* Top terminal navigation bar */}
      <Navbar />

      {/* Main terminal workbench */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Watchlist sidebar (~68px rows) */}
        <Sidebar
          stocks={stocks}
          activeSymbol={activeSymbol}
          onSelectSymbol={setActiveSymbol}
        />

        {/* Center: Candlestick chart hero + 10-session OHLC table */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <ChartPanel
            quote={quote}
            ohlc={ohlc}
            loading={loading}
            error={error}
            onSelectCandle={setSelectedCandle}
          />
          <OHLCTable
            candles={ohlc?.candles}
            selectedDate={activeCandle?.time}
            onSelectCandle={setSelectedCandle}
          />
        </div>

        {/* Right: Institutional Analytics & Pattern Scan */}
        <aside className="w-72 shrink-0 bg-[#0A0A0A] border-l border-[#262626] flex flex-col overflow-y-auto">
          <div className="p-3 space-y-3">
            <OHLCStats quote={quote} ohlc={ohlc} />
            <CandleAnatomy
              candle={activeCandle}
              isLatest={!selectedCandle || selectedCandle.time === ohlc?.candles.at(-1)?.time}
            />
            <PatternCard pattern={pattern} />
          </div>
        </aside>
      </div>

      {/* Bottom signature pipeline status footer */}
      <Footer />
    </div>
  );
}
