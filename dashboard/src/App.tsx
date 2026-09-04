// src/App.tsx
// Root application component — assembles the Xeroww Institutional Market Terminal layout.

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import ChartPanel from "./components/ChartPanel";
import OHLCStats from "./components/OHLCStats";
import PatternCard from "./components/PatternCard";
import { useMarketData } from "./hooks/useMarketData";

export default function App() {
  const { stocks, activeSymbol, quote, ohlc, pattern, loading, error, setActiveSymbol } =
    useMarketData();

  return (
    <div className="flex flex-col h-screen bg-[#000000] text-[#FAFAFA] overflow-hidden select-none">
      {/* Top terminal navigation bar */}
      <Navbar />

      {/* Main terminal workbench */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Watchlist sidebar (~64px rows) */}
        <Sidebar
          stocks={stocks}
          activeSymbol={activeSymbol}
          onSelectSymbol={setActiveSymbol}
        />

        {/* Center: Candlestick chart hero + compact quote ribbon */}
        <ChartPanel quote={quote} ohlc={ohlc} loading={loading} error={error} />

        {/* Right: Compact Session Stats + Varsity Pattern rail */}
        <aside className="w-64 shrink-0 bg-[#0A0A0A] border-l border-[#262626] flex flex-col overflow-y-auto">
          <div className="p-3 space-y-3">
            <OHLCStats quote={quote} ohlc={ohlc} />
            <PatternCard pattern={pattern} />
          </div>
        </aside>
      </div>
    </div>
  );
}
