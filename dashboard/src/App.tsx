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

  // Auth gate — refined quant gate
  const renderAuthGate = (moduleName: string) => (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#000000] p-6">
      <div className="w-full max-w-sm border border-[#1E2538] bg-[#0B0E14] p-8 text-center flex flex-col items-center gap-3.5 shadow-2xl">
        <span className="w-2 h-2 rounded-full bg-[#F59E0B] block animate-pulse" />
        <div className="text-sm font-semibold text-[#F8FAFC]">
          {moduleName} requires authentication
        </div>
        <p className="text-xs text-[#94A3B8] leading-relaxed m-0">
          Access to multi-tenant persistence — custom watchlists, simulated
          portfolios, alert engines, and decision audits — requires a
          verified session.
        </p>
        <button
          id="gate-auth-btn"
          onClick={() => setShowAuthModal(true)}
          className="mt-2 px-5 py-2 text-xs font-semibold bg-[#F59E0B] hover:bg-[#D97706] text-black transition-colors"
        >
          Sign In / Register
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-[#000000] text-[#F8FAFC] overflow-hidden select-none">
      {/* Top Module Navigator */}
      <ModuleNav
        activeModule={activeModule}
        onModuleChange={handleModuleChange}
        user={auth.user}
        onLogout={auth.logout}
        onLogin={() => setShowAuthModal(true)}
        onOpenBreadth={() => setShowBreadthModal(true)}
      />

      {/* Main Terminal Body */}
      <div className="flex flex-1 overflow-hidden">
        {activeModule === "MARKET" && (
          <div className="flex flex-1 overflow-hidden">
            {/* Left: Watchlist */}
            <Sidebar
              stocks={stocks}
              activeSymbol={activeSymbol}
              onSelectSymbol={setActiveSymbol}
            />

            {/* Center: Chart + OHLC Table */}
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

            {/* Right: Analytics Sidebar */}
            <aside className="w-[304px] shrink-0 bg-[#000000] border-l border-[#1E2538] flex flex-col overflow-hidden">
              {/* Tab selector */}
              <div className="flex items-center border-b border-[#1E2538] bg-[#05070B] shrink-0">
                {(["STRUCTURE", "ANATOMY"] as const).map((tab) => {
                  const active = sidebarTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setSidebarTab(tab)}
                      className={`flex-1 h-8 text-xs font-medium transition-colors border-b-2 ${
                        active
                          ? "text-[#F8FAFC] bg-[#0B0E14] border-b-[#F59E0B] font-semibold"
                          : "text-[#64748B] hover:text-[#94A3B8] border-b-transparent"
                      }`}
                    >
                      {tab === "STRUCTURE" ? "Structure Engine" : "OHLC & Anatomy"}
                    </button>
                  );
                })}
              </div>

              {/* Analytics body */}
              <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2 bg-[#000000]">
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
                    <SupportResistancePanel sr={structure?.support_resistance ?? null} />
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
            renderAuthGate("Watchlist Manager")
          ))}

        {activeModule === "PORTFOLIO" &&
          (auth.isAuthenticated ? (
            <PortfolioView />
          ) : (
            renderAuthGate("Portfolio Valuation Engine")
          ))}

        {activeModule === "ALERTS" &&
          (auth.isAuthenticated ? (
            <AlertsManager />
          ) : (
            renderAuthGate("Real-Time Alert Engine")
          ))}

        {activeModule === "JOURNAL" &&
          (auth.isAuthenticated ? (
            <JournalView />
          ) : (
            renderAuthGate("Decision Audit Journal")
          ))}

        {activeModule === "SYSTEM" && (
          <SystemView user={auth.user} />
        )}
      </div>

      {/* Footer */}
      <Footer />

      {/* Modals */}
      {showAuthModal && (
        <AuthModal auth={auth} onClose={() => setShowAuthModal(false)} />
      )}
      {showForensicsModal && (
        <CandleForensicsModal
          symbol={activeSymbol}
          timestamp={activeCandle?.time ?? new Date().toISOString().split("T")[0]}
          onClose={() => setShowForensicsModal(false)}
        />
      )}
      {showDiffModal && (
        <EventDiffModal
          symbol={activeSymbol}
          onClose={() => setShowDiffModal(false)}
        />
      )}
      {showBreadthModal && (
        <MarketBreadthModal
          onClose={() => setShowBreadthModal(false)}
        />
      )}
    </div>
  );
}
