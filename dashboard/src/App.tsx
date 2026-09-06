import { useState, useEffect } from "react";
import ModuleNav, { type Module } from "./components/ModuleNav";
import Sidebar from "./components/Sidebar";
import ChartPanel from "./components/ChartPanel";
import OHLCTable from "./components/OHLCTable";
import OHLCStats from "./components/OHLCStats";
import CandleAnatomy from "./components/CandleAnatomy";
import PatternCard from "./components/PatternCard";
import MarketRegimeCard from "./components/MarketRegimeCard";
import SignalAlignmentCard from "./components/SignalAlignmentCard";
import SupportResistancePanel from "./components/SupportResistancePanel";
import VolumeAnalyticsPanel from "./components/VolumeAnalyticsPanel";
import ReplayControlBar from "./components/ReplayControlBar";
import CandleForensicsModal from "./components/CandleForensicsModal";
import EventDiffModal from "./components/EventDiffModal";
import MarketBreadthModal from "./components/MarketBreadthModal";
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
import type { ReplayStepResponse } from "./types/structure";

export default function App() {
  const auth = useAuth();
  const [activeModule, setActiveModule] = useState<Module>("MARKET");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"STRUCTURE" | "ANATOMY">("STRUCTURE");

  // Differentiated intelligence modals state
  const [isReplayMode, setIsReplayMode] = useState<boolean>(false);
  const [replayState, setReplayState] = useState<ReplayStepResponse | null>(null);
  const [showForensicsModal, setShowForensicsModal] = useState<boolean>(false);
  const [showDiffModal, setShowDiffModal] = useState<boolean>(false);
  const [showBreadthModal, setShowBreadthModal] = useState<boolean>(false);

  // V0.5 Market Terminal State (Fully preserved + V0.6 Structure)
  const { stocks, activeSymbol, quote, ohlc, pattern, structure, loading, error, setActiveSymbol } =
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
        onOpenBreadth={() => setShowBreadthModal(true)}
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
              {isReplayMode && (
                <ReplayControlBar
                  symbol={activeSymbol}
                  onStateUpdate={setReplayState}
                  onExitReplay={() => {
                    setIsReplayMode(false);
                    setReplayState(null);
                  }}
                />
              )}
              <ChartPanel
                quote={isReplayMode && replayState?.current_candle ? {
                  ...quote!,
                  price: replayState.current_candle.close,
                  change: replayState.current_candle.close - replayState.current_candle.open,
                  change_pct: ((replayState.current_candle.close - replayState.current_candle.open) / replayState.current_candle.open) * 100,
                } : quote}
                ohlc={isReplayMode && replayState ? {
                  ...ohlc!,
                  candles: replayState.candles_slice as any,
                } : ohlc}
                structure={isReplayMode && replayState ? {
                  symbol: activeSymbol,
                  current_price: replayState.current_candle?.close ?? 0,
                  support_resistance: replayState.support_resistance!,
                  volume: replayState.volume!,
                  moving_averages: replayState.moving_averages!,
                  market_regime: replayState.market_regime!,
                  signal_alignment: replayState.signal_alignment!,
                  detected_patterns: replayState.pattern ? [replayState.pattern as any] : [],
                  contextual_pattern: null,
                } : structure}
                loading={loading}
                error={error}
                onSelectCandle={setSelectedCandle}
                onOpenReplay={() => setIsReplayMode(true)}
                onOpenDiff={() => setShowDiffModal(true)}
                onOpenForensics={() => setShowForensicsModal(true)}
              />
              <OHLCTable
                candles={isReplayMode && replayState ? replayState.candles_slice as any : ohlc?.candles}
                selectedDate={activeCandle?.time}
                onSelectCandle={setSelectedCandle}
              />
            </div>


            {/* Right: Institutional Analytics & Market Structure Engine */}
            <aside className="w-80 shrink-0 bg-[#0A0A0A] border-l border-[#262626] flex flex-col overflow-hidden">
              {/* Tab Selector */}
              <div className="flex items-center border-b border-[#262626] bg-[#000000] text-[11px] font-mono">
                <button
                  onClick={() => setSidebarTab("STRUCTURE")}
                  className={`flex-1 py-2 text-center font-bold tracking-wider transition-colors border-b-2 ${
                    sidebarTab === "STRUCTURE"
                      ? "border-[#00E5FF] text-[#00E5FF] bg-[#0A0A0A]"
                      : "border-transparent text-[#737373] hover:text-[#FAFAFA]"
                  }`}
                >
                  STRUCTURE ENGINE
                </button>
                <button
                  onClick={() => setSidebarTab("ANATOMY")}
                  className={`flex-1 py-2 text-center font-bold tracking-wider transition-colors border-b-2 ${
                    sidebarTab === "ANATOMY"
                      ? "border-[#00E5FF] text-[#00E5FF] bg-[#0A0A0A]"
                      : "border-transparent text-[#737373] hover:text-[#FAFAFA]"
                  }`}
                >
                  OHLC & ANATOMY
                </button>
              </div>

              {/* Scrollable Analytics Body */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {sidebarTab === "STRUCTURE" ? (
                  <>
                    <MarketRegimeCard regime={structure?.market_regime ?? null} />
                    <SignalAlignmentCard alignment={structure?.signal_alignment ?? null} />
                    <PatternCard pattern={structure?.detected_patterns?.[0] ? {
                      symbol: structure.symbol,
                      pattern: structure.detected_patterns[0].pattern,
                      direction: structure.detected_patterns[0].direction,
                      category: structure.detected_patterns[0].category,
                      contextual_summary: structure.contextual_pattern?.context_summary,
                    } as any : pattern} />
                    <SupportResistancePanel
                      sr={structure?.support_resistance ?? null}
                    />
                    <VolumeAnalyticsPanel volume={structure?.volume ?? null} />
                  </>
                ) : (
                  <>
                    <OHLCStats quote={quote} ohlc={ohlc} />
                    <CandleAnatomy
                      candle={activeCandle}
                      isLatest={!selectedCandle || selectedCandle.time === ohlc?.candles.at(-1)?.time}
                    />
                    <PatternCard pattern={structure?.detected_patterns?.[0] ? {
                      symbol: structure.symbol,
                      pattern: structure.detected_patterns[0].pattern,
                      direction: structure.detected_patterns[0].direction,
                      category: structure.detected_patterns[0].category,
                      contextual_summary: structure.contextual_pattern?.context_summary,
                    } as any : pattern} />
                  </>
                )}
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

      {/* Candle Forensics Modal */}
      {showForensicsModal && (
        <CandleForensicsModal
          symbol={activeSymbol}
          timestamp={activeCandle?.time ?? new Date().toISOString().split("T")[0]}
          onClose={() => setShowForensicsModal(false)}
        />
      )}

      {/* What Changed Event Diff Modal */}
      {showDiffModal && (
        <EventDiffModal
          symbol={activeSymbol}
          onClose={() => setShowDiffModal(false)}
        />
      )}

      {/* Market Breadth & Correlation Modal */}
      {showBreadthModal && (
        <MarketBreadthModal
          onClose={() => setShowBreadthModal(false)}
        />
      )}
    </div>
  );
}

