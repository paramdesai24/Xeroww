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

  // Auth gate — editorial, not alarming
  const renderAuthGate = (moduleName: string) => (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--surface-base)",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          border: "1px solid var(--border-default)",
          backgroundColor: "var(--surface-raised)",
          padding: 28,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        {/* Quiet presence indicator */}
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: "var(--accent)",
            display: "block",
          }}
        />
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-primary)",
          }}
        >
          {moduleName} requires authentication
        </div>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            lineHeight: 1.7,
            color: "var(--text-secondary)",
            margin: 0,
          }}
        >
          Access to multi-tenant persistence — custom watchlists, simulated
          portfolios, alert engines, and decision audits — requires a
          cryptographically verified session.
        </p>
        <button
          id="gate-auth-btn"
          onClick={() => setShowAuthModal(true)}
          style={{
            marginTop: 6,
            padding: "8px 20px",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-primary)",
            backgroundColor: "var(--surface-overlay)",
            border: "1px solid var(--border-default)",
            cursor: "pointer",
            transition: "border-color 160ms cubic-bezier(0.16,1,0.3,1)",
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)"}
        >
          Sign In / Register
        </button>
      </div>
    </div>
  );

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      backgroundColor: "var(--surface-base)",
      color: "var(--text-primary)",
      overflow: "hidden",
      userSelect: "none",
    }}>
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
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {activeModule === "MARKET" && (
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            {/* Left: Watchlist */}
            <Sidebar
              stocks={stocks}
              activeSymbol={activeSymbol}
              onSelectSymbol={setActiveSymbol}
            />

            {/* Center: Chart + OHLC Table */}
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, overflow: "hidden" }}>
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
            <aside style={{
              width: 296,
              flexShrink: 0,
              backgroundColor: "var(--surface-base)",
              borderLeft: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}>
              {/* Tab selector */}
              <div style={{
                display: "flex",
                alignItems: "center",
                borderBottom: "1px solid var(--border-subtle)",
                backgroundColor: "var(--surface-base)",
                flexShrink: 0,
              }}>
                {(["STRUCTURE", "ANATOMY"] as const).map((tab) => {
                  const active = sidebarTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setSidebarTab(tab)}
                      style={{
                        flex: 1,
                        height: 32,
                        fontFamily: "var(--font-mono)",
                        fontSize: 9,
                        fontWeight: 500,
                        letterSpacing: "0.10em",
                        textTransform: "uppercase",
                        color: active ? "var(--text-primary)" : "var(--text-disabled)",
                        backgroundColor: active ? "var(--surface-raised)" : "transparent",
                        border: "none",
                        borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                        cursor: "pointer",
                        transition: "color 160ms cubic-bezier(0.16,1,0.3,1), background-color 160ms cubic-bezier(0.16,1,0.3,1)",
                      }}
                    >
                      {tab === "STRUCTURE" ? "Structure Engine" : "OHLC & Anatomy"}
                    </button>
                  );
                })}
              </div>

              {/* Analytics body */}
              <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
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
