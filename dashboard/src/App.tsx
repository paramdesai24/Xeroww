import { useState, useEffect, useCallback, useMemo } from "react";
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
import { XRayDrawer } from "./components/xray";
import { EventTimeline } from "./components/replay";
import { FuzzyExplainCard } from "./components/FuzzyExplainCard";
import type { FuzzyExplainabilityReport } from "./types/fuzzy";

import { useMarketData } from "./hooks/useMarketData";
import { useAuth } from "./hooks/useAuth";
import { useSelectedCandle } from "./hooks/useSelectedCandle";
import type { ReplayStepResponse } from "./types/structure";
import type { MarketEvent } from "./types/events";
import { api } from "./api/client";

export default function App() {
  const auth = useAuth();
  const [activeModule, setActiveModule] = useState<Module>("MARKET");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"STRUCTURE" | "FUZZY" | "ANATOMY" | "EVENTS">("STRUCTURE");

  // Differentiated intelligence modals state
  const [isReplayMode, setIsReplayMode] = useState<boolean>(false);
  const [replayState, setReplayState] = useState<ReplayStepResponse | null>(null);
  const [showForensicsModal, setShowForensicsModal] = useState<boolean>(false);
  const [showDiffModal, setShowDiffModal] = useState<boolean>(false);
  const [showBreadthModal, setShowBreadthModal] = useState<boolean>(false);

  // Market Event Timeline & Explainability state
  const [replayEvents, setReplayEvents] = useState<MarketEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState<boolean>(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [externalStep, setExternalStep] = useState<number | null>(null);
  const [currentReplayStep, setCurrentReplayStep] = useState<number>(0);

  // V0.8 Mamdani Fuzzy Explainability Engine state
  const [fuzzyReport, setFuzzyReport] = useState<FuzzyExplainabilityReport | null>(null);
  const [fuzzyLoading, setFuzzyLoading] = useState<boolean>(false);
  const [fuzzyError, setFuzzyError] = useState<string | null>(null);

  // Chronological point-in-time revealed events count up to currentReplayStep
  const revealedEventsCount = useMemo(() => {
    return replayEvents.filter((e) => e.candle_index <= currentReplayStep).length;
  }, [replayEvents, currentReplayStep]);

  // V0.5 Market Terminal State (Fully preserved + V0.6 Structure)
  const { stocks, activeSymbol, quote, ohlc, pattern, structure, loading, error, setActiveSymbol } =
    useMarketData();

  // Active candles slice (either historical slice from Replay or live OHLC bars)
  const activeCandles = isReplayMode && replayState ? (replayState.candles_slice as any) : ohlc?.candles;

  // Flagship X-Ray Mode Hook (memoized deep forensics, deterministic pattern evaluation, Kafka lineage)
  const xray = useSelectedCandle({
    symbol: activeSymbol,
    candles: activeCandles,
    structure: isReplayMode && replayState ? {
      symbol: activeSymbol,
      current_price: replayState.current_candle?.close ?? 0,
      support_resistance: replayState.support_resistance!,
      volume: replayState.volume!,
      moving_averages: replayState.moving_averages!,
      market_regime: replayState.market_regime!,
      signal_alignment: replayState.signal_alignment!,
      detected_patterns: replayState.pattern ? [replayState.pattern as any] : [],
      contextual_pattern: null,
    } : structure,
  });

  // Active candle displayed in sidebar Candle Anatomy & Modals
  const activeCandle = xray.selectedCandle ?? activeCandles?.at(-1) ?? null;

  // Fetch market domain events when entering replay mode or switching symbol
  const fetchEvents = useCallback(() => {
    setLoadingEvents(true);
    api.events
      .getTimeline(activeSymbol, "3mo")
      .then((res) => {
        setReplayEvents(res.events || []);
        setLoadingEvents(false);
      })
      .catch(() => setLoadingEvents(false));
  }, [activeSymbol]);

  useEffect(() => {
    if (isReplayMode) {
      setSidebarTab("EVENTS");
      fetchEvents();
    } else {
      if (sidebarTab === "EVENTS") {
        setSidebarTab("STRUCTURE");
      }
    }
  }, [isReplayMode, fetchEvents]);

  // Fetch fuzzy explainability report when symbol changes (non-replay mode)
  const fetchFuzzyReport = useCallback(() => {
    if (!activeSymbol || isReplayMode) return;
    setFuzzyLoading(true);
    setFuzzyError(null);
    api.fuzzy
      .explain(activeSymbol, "1y")
      .then((report) => {
        setFuzzyReport(report);
        setFuzzyLoading(false);
      })
      .catch((err) => {
        setFuzzyError(err?.message ?? "Fuzzy inference failed");
        setFuzzyLoading(false);
      });
  }, [activeSymbol, isReplayMode]);

  useEffect(() => {
    setFuzzyReport(null);
    fetchFuzzyReport();
  }, [activeSymbol, fetchFuzzyReport]);

  // Handle clicking a timeline event:
  // - Jump chart to that candle
  // - Highlight candle
  // - Open X-Ray drawer automatically
  const handleSelectEvent = (evt: MarketEvent) => {
    setSelectedEventId(evt.id);
    setExternalStep(evt.candle_index);

    const candle = ohlc?.candles?.[evt.candle_index] ?? activeCandles?.[evt.candle_index];
    if (candle) {
      xray.selectCandle(candle);
      xray.openDrawer();
    }
  };

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
        <span className="w-2 h-2 rounded-full bg-[#1E90FF] block animate-pulse" />
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
          className="mt-2 px-5 py-2 text-xs font-semibold bg-[#1E90FF] hover:bg-[#1C86EE] text-white transition-colors"
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
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {activeModule === "MARKET" && (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left: Watchlist */}
            <Sidebar
              stocks={stocks}
              activeSymbol={activeSymbol}
              onSelectSymbol={setActiveSymbol}
            />

            {/* Center: Chart + OHLC Table */}
            <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
              {isReplayMode && (
                <ReplayControlBar
                  symbol={activeSymbol}
                  onStateUpdate={setReplayState}
                  onExitReplay={() => {
                    setIsReplayMode(false);
                    setReplayState(null);
                    setExternalStep(null);
                  }}
                  showTimeline={sidebarTab === "EVENTS"}
                  onToggleTimeline={() =>
                    setSidebarTab((prev) => (prev === "EVENTS" ? "STRUCTURE" : "EVENTS"))
                  }
                  timelineEventCount={revealedEventsCount}
                  externalStep={externalStep}
                  onStepChange={setCurrentReplayStep}
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
                onSelectCandle={xray.selectCandle}
                onOpenReplay={() => setIsReplayMode(true)}
                onOpenDiff={() => setShowDiffModal(true)}
                onOpenForensics={() => setShowForensicsModal(true)}
                isXRayOpen={xray.isDrawerOpen}
                onToggleXRay={xray.toggleDrawer}
              />
              <OHLCTable
                candles={isReplayMode && replayState ? replayState.candles_slice as any : ohlc?.candles}
                selectedDate={activeCandle?.time}
                onSelectCandle={xray.selectCandle}
              />
            </div>

            {/* Right: Analytics Sidebar */}
            <aside className="w-[360px] xl:w-[380px] shrink-0 bg-[#000000] border-l border-[#1E2538] flex flex-col min-h-0 h-full overflow-hidden">
              {/* Tab selector */}
              <div className="flex items-center border-b border-[#1E2538] bg-[#05070B] shrink-0">
                {(isReplayMode
                  ? (["EVENTS", "STRUCTURE", "FUZZY", "ANATOMY"] as const)
                  : (["STRUCTURE", "FUZZY", "ANATOMY"] as const)
                ).map((tab) => {
                  const active = sidebarTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setSidebarTab(tab)}
                      className={`flex-1 h-9 text-xs font-medium transition-colors border-b-2 flex items-center justify-center gap-1.5 whitespace-nowrap ${
                        active
                          ? "text-[#F8FAFC] bg-[#0B0E14] border-b-[#1E90FF] font-semibold"
                          : "text-[#64748B] hover:text-[#94A3B8] border-b-transparent"
                      }`}
                    >
                      <span>
                        {tab === "EVENTS"
                          ? "Events"
                          : tab === "STRUCTURE"
                          ? "Structure"
                          : tab === "FUZZY"
                          ? "Mamdani FIS"
                          : "Anatomy"}
                      </span>
                      {tab === "FUZZY" && (
                        <span className="px-1 py-0.2 text-[9px] bg-[#1E90FF]/20 text-[#60A5FA] border border-[#1E90FF]/30 rounded-xs font-mono">
                          v0.8
                        </span>
                      )}
                      {tab === "EVENTS" && replayEvents.length > 0 && (
                        <span className="px-1 py-0.2 text-[10px] bg-[#1E90FF]/20 text-[#60A5FA] border border-[#1E90FF]/30 rounded-sm font-mono whitespace-nowrap">
                          {revealedEventsCount}/{replayEvents.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Analytics body */}
              <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3 bg-[#000000] overscroll-contain">
                {sidebarTab === "EVENTS" && isReplayMode ? (
                  <EventTimeline
                    events={replayEvents}
                    currentStep={currentReplayStep}
                    totalSteps={replayState?.total_steps}
                    selectedEventId={selectedEventId}
                    onSelectEvent={handleSelectEvent}
                    loading={loadingEvents}
                    onRefresh={fetchEvents}
                  />
                ) : sidebarTab === "FUZZY" ? (
                  <FuzzyExplainCard
                    report={fuzzyReport}
                    loading={fuzzyLoading}
                    error={fuzzyError}
                    onRefresh={fetchFuzzyReport}
                  />
                ) : sidebarTab === "STRUCTURE" ? (
                  <>
                    {/* V0.8 — Mamdani Fuzzy Explainability Engine placed at TOP for immediate visibility */}
                    <FuzzyExplainCard
                      report={fuzzyReport}
                      loading={fuzzyLoading}
                      error={fuzzyError}
                      onRefresh={fetchFuzzyReport}
                    />
                    <MarketRegimeCard regime={structure?.market_regime ?? null} />
                    <SignalAlignmentCard alignment={structure?.signal_alignment ?? null} />
                    <PatternCard pattern={structure?.detected_patterns?.[0] ? {
                      symbol: structure.symbol,
                      display_name: structure.symbol.replace(".NS", ""),
                      pattern: (structure.detected_patterns[0].pattern.toLowerCase().includes("marubozu")
                        ? structure.detected_patterns[0].pattern.toLowerCase().replace(/ /g, "_")
                        : "none") as any,
                      signal_day: structure.detected_patterns[0].timestamp,
                      textbook_action: "watch_next_session_for_confirmation",
                      rationale: structure.detected_patterns[0].explanation,
                      stop_loss: (structure.detected_patterns[0].context?.stop_loss as number) ?? null,
                      detected_patterns: structure.detected_patterns,
                      contextual_pattern: structure.contextual_pattern,
                      data_note: "Deterministic pattern detection",
                    } : pattern} />
                    <SupportResistancePanel sr={structure?.support_resistance ?? null} />
                    <VolumeAnalyticsPanel volume={structure?.volume ?? null} />
                  </>
                ) : (
                  <>
                    <OHLCStats quote={quote} ohlc={ohlc} />
                    <CandleAnatomy
                      candle={activeCandle}
                      isLatest={!xray.selectedCandle || xray.selectedCandle.time === ohlc?.candles.at(-1)?.time}
                    />
                    <PatternCard pattern={structure?.detected_patterns?.[0] ? {
                      symbol: structure.symbol,
                      display_name: structure.symbol.replace(".NS", ""),
                      pattern: (structure.detected_patterns[0].pattern.toLowerCase().includes("marubozu")
                        ? structure.detected_patterns[0].pattern.toLowerCase().replace(/ /g, "_")
                        : "none") as any,
                      signal_day: structure.detected_patterns[0].timestamp,
                      textbook_action: "watch_next_session_for_confirmation",
                      rationale: structure.detected_patterns[0].explanation,
                      stop_loss: (structure.detected_patterns[0].context?.stop_loss as number) ?? null,
                      detected_patterns: structure.detected_patterns,
                      contextual_pattern: structure.contextual_pattern,
                      data_note: "Deterministic pattern detection",
                    } : pattern} />
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

      {/* Flagship X-Ray Mode Right-Side Inspection Drawer */}
      <XRayDrawer
        isOpen={xray.isDrawerOpen}
        data={xray.inspectionData}
        onClose={xray.closeDrawer}
        onPrevCandle={xray.selectPrevCandle}
        onNextCandle={xray.selectNextCandle}
      />
    </div>
  );
}
