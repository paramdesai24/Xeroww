// src/App.tsx
// Root application component — Xeroww V0.6 Institutional Financial Intelligence Platform.
// Unifies the V0.5 Market Terminal with V0.6 multi-tenant modules:
// Watchlists, Portfolios, Alerts Engine, Decision Journal, and System Telemetry.

import { useState, useEffect } from "react";
import ModuleNav, { type Module } from "./components/ModuleNav";
import Sidebar from "./components/Sidebar";
import ChartPanel from "./components/ChartPanel";
import OHLCTable from "./components/OHLCTable";
import OHLCStats from "./components/OHLCStats";
import CandleAnatomy from "./components/CandleAnatomy";
import PatternCard from "./components/PatternCard";
import Footer from "./components/Footer";

// V0.6 Domain Components
import WatchlistManager from "./components/WatchlistManager";
import PortfolioView from "./components/PortfolioView";
import AlertsManager from "./components/AlertsManager";
import JournalView from "./components/JournalView";
import SystemView from "./components/SystemView";
import AuthModal from "./components/AuthModal";

import { useMarketData } from "./hooks/useMarketData";
import { useAuth } from "./hooks/useAuth";
import type { OHLCBar } from "./types/market";

export default function App() {
  const auth = useAuth();
  const [activeModule, setActiveModule] = useState<Module>("MARKET");
  const [showAuthModal, setShowAuthModal] = useState(false);

  // V0.5 Market Terminal State (Fully preserved)
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

  const handleModuleChange = (mod: Module) => {
    setActiveModule(mod);
    const protectedModules: Module[] = ["WATCHLISTS", "PORTFOLIO", "ALERTS", "JOURNAL"];
    if (protectedModules.includes(mod) && !auth.isAuthenticated) {
      setShowAuthModal(true);
    }
  };

  const renderAuthGate = (moduleName: string) => (
    <div
      className="flex-1 flex flex-col items-center justify-center bg-[#000] text-[#e0e0e0] p-6"
      style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
    >
      <div className="w-full max-w-md border border-[#1E1E1E] bg-[#050505] p-6 text-center flex flex-col items-center gap-4">
        <div className="w-2 h-2 rounded-full bg-[#00E5FF] animate-ping" />
        <div className="text-[12px] font-bold text-[#FFF] tracking-[0.2em] uppercase">
          {moduleName} REQUIRES AUTHENTICATION
        </div>
        <p className="text-[10px] text-[#666] leading-relaxed">
          Access to multi-tenant persistence (custom watchlists, simulated portfolios, automated alert engines, and decision audits) requires a cryptographically verified session.
        </p>
        <button
          id="gate-auth-btn"
          onClick={() => setShowAuthModal(true)}
          className="mt-2 px-4 py-2 bg-[#00E5FF] hover:bg-[#33EAFF] text-[#000] font-bold text-[10px] tracking-widest uppercase transition-colors"
        >
          SIGN IN / REGISTER
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-[#000000] text-[#FAFAFA] overflow-hidden select-none">
      {/* Top Module Navigator — Institutional V0.6 Header */}
      <ModuleNav
        activeModule={activeModule}
        onModuleChange={handleModuleChange}
        user={auth.user}
        onLogout={auth.logout}
        onLogin={() => setShowAuthModal(true)}
      />

      {/* Main Terminal Body — Module Switching */}
      <div className="flex flex-1 overflow-hidden">
        {activeModule === "MARKET" && (
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
        )}

        {activeModule === "WATCHLISTS" &&
          (auth.isAuthenticated ? (
            <WatchlistManager
              onSelectSymbol={(sym) => {
                setActiveSymbol(sym);
                setActiveModule("MARKET");
              }}
            />
          ) : (
            renderAuthGate("WATCHLIST MANAGER")
          ))}

        {activeModule === "PORTFOLIO" &&
          (auth.isAuthenticated ? (
            <PortfolioView />
          ) : (
            renderAuthGate("PORTFOLIO VALUATION ENGINE")
          ))}

        {activeModule === "ALERTS" &&
          (auth.isAuthenticated ? (
            <AlertsManager />
          ) : (
            renderAuthGate("REAL-TIME ALERT ENGINE")
          ))}

        {activeModule === "JOURNAL" &&
          (auth.isAuthenticated ? (
            <JournalView />
          ) : (
            renderAuthGate("DECISION AUDIT JOURNAL")
          ))}

        {activeModule === "SYSTEM" && (
          <SystemView user={auth.user} />
        )}
      </div>

      {/* Signature Pipeline Status Footer (Visible across modules) */}
      <Footer />

      {/* Institutional Auth Modal */}
      {showAuthModal && (
        <AuthModal auth={auth} onClose={() => setShowAuthModal(false)} />
      )}
    </div>
  );
}
