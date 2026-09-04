// src/App.tsx
// Root application component — assembles the Xeroww Market Terminal layout.

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
    <div className="flex flex-col h-screen bg-[#0B0F19] text-slate-100 overflow-hidden">
      {/* Top navigation */}
      <Navbar />

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Watchlist sidebar */}
        <Sidebar
          stocks={stocks}
          activeSymbol={activeSymbol}
          onSelectSymbol={setActiveSymbol}
        />

        {/* Center: Candlestick chart + quote header */}
        <ChartPanel quote={quote} ohlc={ohlc} loading={loading} error={error} />

        {/* Right: Stats + Pattern panel */}
        <aside className="w-72 shrink-0 bg-[#0B0F19] border-l border-slate-800 flex flex-col overflow-y-auto">
          <div className="p-4 space-y-4">
            <OHLCStats quote={quote} ohlc={ohlc} />
            <PatternCard pattern={pattern} />
          </div>
        </aside>
      </div>
    </div>
  );
}
