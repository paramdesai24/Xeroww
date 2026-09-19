import { lazy, Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import Footer from "./components/Footer";

// V0.6 Domain Components
import { XRayDrawer } from "./components/xray";
import { EventTimeline } from "./components/replay";
import { FuzzyExplainCard } from "./components/FuzzyExplainCard";
import type { FuzzyExplainabilityReport } from "./types/fuzzy";
import { Skeleton } from "./components/ui";

import { useMarketData } from "./hooks/useMarketData";
import { useAuth } from "./hooks/useAuth";
import { useSelectedCandle } from "./hooks/useSelectedCandle";
import type { ReplayStepResponse } from "./types/structure";
import type { MarketEvent } from "./types/events";
import { api } from "./api/client";

const WatchlistManager = lazy(() => import("./components/WatchlistManager"));
const PortfolioView = lazy(() => import("./components/PortfolioView"));
const AlertsManager = lazy(() => import("./components/AlertsManager"));
const DecisionsPage = lazy(() => import("./pages/DecisionsPage"));
const DecisionCreatePage = lazy(() => import("./pages/DecisionCreatePage"));
const DecisionDetailPage = lazy(() => import("./pages/DecisionDetailPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const SystemView = lazy(() => import("./components/SystemView"));
const AuthModal = lazy(() => import("./components/AuthModal"));
const CandleForensicsModal = lazy(() => import("./components/CandleForensicsModal"));
const EventDiffModal = lazy(() => import("./components/EventDiffModal"));
const MarketBreadthModal = lazy(() => import("./components/MarketBreadthModal"));

const lazyFallback = (
  <div className="flex-1 flex items-center justify-center bg-[#000000] text-xs text-[#64748B]">
    Loading module...
  </div>
);

export default function App() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const activeModule: Module = path.startsWith("/watchlists") ? "WATCHLISTS"
    : path.startsWith("/portfolio") ? "PORTFOLIO"
    : path.startsWith("/alerts") ? "ALERTS"
    : path.startsWith("/decisions") ? "JOURNAL"
    : path.startsWith("/system") ? "SYSTEM"
    : "MARKET";
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"STRUCTURE" | "CONTEXT" | "ANATOMY" | "EVENTS">("STRUCTURE");

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

  useEffect(() => {
    if (path === "/") {
      navigate("/market/RELIANCE.NS", { replace: true });
      return;
    }
    if (path.startsWith("/market/")) {
      const routedSymbol = decodeURIComponent(path.slice("/market/".length)).toUpperCase();
      if (routedSymbol && routedSymbol !== activeSymbol) setActiveSymbol(routedSymbol);
    }
  }, [path, navigate, activeSymbol, setActiveSymbol]);

  // Active candles slice (either historical slice from Replay or live OHLC bars)
  const activeCandles = isReplayMode && replayState ? (replayState.candles_slice as any) : ohlc?.candles;

  // Flagship X-Ray Mode Hook with deterministic analysis and factual source provenance
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
    mode: isReplayMode ? "replay" : "live",
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
      queueMicrotask(() => {
        setSidebarTab("EVENTS");
        fetchEvents();
      });
    } else {
      queueMicrotask(() => setSidebarTab((current) => current === "EVENTS" ? "STRUCTURE" : current));
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
    queueMicrotask(() => {
      setFuzzyReport(null);
      fetchFuzzyReport();
    });
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
    const protectedModules: Module[] = ["WATCHLISTS", "PORTFOLIO", "ALERTS", "JOURNAL"];
    if (protectedModules.includes(mod) && !auth.isAuthenticated) {
      setShowAuthModal(true);
    }
    const routes: Record<Module, string> = {
      MARKET: `/market/${encodeURIComponent(activeSymbol)}`,
      WATCHLISTS: "/watchlists",
      PORTFOLIO: "/portfolio",
      ALERTS: "/alerts",
      JOURNAL: "/decisions",
      SYSTEM: "/system",
    };
    navigate(routes[mod]);
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
    <div className="app-shell flex flex-col bg-[#000000] text-[#F8FAFC] overflow-hidden select-none">
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
      <div className="app-body flex flex-1 min-h-0 overflow-hidden">
        {activeModule === "MARKET" && (path.startsWith("/market") || path === "/") && (
          <div className="market-workspace flex-1 min-h-0 overflow-hidden">
            {/* Left: Watchlist */}
            <Sidebar
              stocks={stocks}
              activeSymbol={activeSymbol}
              onSelectSymbol={setActiveSymbol}
            />

            {/* Center: Chart + OHLC Table */}
            <div className="market-center flex flex-col min-w-0 min-h-0 overflow-hidden">
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
                onPlanDecision={() => {
                  const query = new URLSearchParams({
                    symbol: activeSymbol,
                    source: isReplayMode ? "replay" : "market",
                  });
                  if (isReplayMode && replayState?.current_candle?.time) {
                    query.set("asOf", replayState.current_candle.time);
                    query.set("period", "1mo");
                  }
                  navigate(`/decisions/new?${query.toString()}`);
                }}
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
            <aside className="analytics-panel shrink-0 bg-[#000000] border-l border-[#1E2538] flex flex-col min-h-0 overflow-hidden">
              {/* Tab selector */}
              {/* Tab selector */}
              <div className="flex items-center border-b border-[#1E2538] bg-[#05070B] shrink-0">
                {(isReplayMode
                  ? (["EVENTS", "STRUCTURE", "CONTEXT", "ANATOMY"] as const)
                  : (["STRUCTURE", "CONTEXT", "ANATOMY"] as const)
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
                          : tab === "CONTEXT"
                          ? "Context"
                          : "Anatomy"}
                      </span>
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
                ) : sidebarTab === "CONTEXT" ? (
                  <FuzzyExplainCard
                    report={fuzzyReport}
                    loading={fuzzyLoading}
                    error={fuzzyError}
                    onRefresh={fetchFuzzyReport}
                  />
                ) : sidebarTab === "STRUCTURE" ? (
                  loading || !structure ? (
                    <div className="flex flex-col gap-3">
                      <div className="border border-[var(--border-default)] bg-[var(--surface)] overflow-hidden">
                        <div className="px-3 py-2.5 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-inset)]">
                          <span className="text-xs font-semibold text-[var(--text-primary)]">Market Regime</span>
                          <span className="text-[10px] text-[var(--text-tertiary)] animate-pulse">Classifying regime…</span>
                        </div>
                        <div className="p-3 bg-[var(--surface-inset)] border-b border-[var(--border-subtle)] grid grid-cols-3 gap-2">
                          <Skeleton height={28} />
                          <Skeleton height={28} />
                          <Skeleton height={28} />
                        </div>
                        <div className="p-3 space-y-2">
                          <Skeleton height={14} width="85%" />
                          <Skeleton height={14} width="70%" />
                        </div>
                      </div>
                      <div className="border border-[var(--border-default)] bg-[var(--surface)] overflow-hidden">
                        <div className="px-3 py-2.5 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-inset)]">
                          <span className="text-xs font-semibold text-[var(--text-primary)]">Signal Confluence</span>
                          <span className="text-[10px] text-[var(--text-tertiary)] animate-pulse">Tallying indicators…</span>
                        </div>
                        <div className="p-3 bg-[var(--surface-inset)] border-b border-[var(--border-subtle)] grid grid-cols-2 gap-4">
                          <Skeleton height={28} />
                          <Skeleton height={28} />
                        </div>
                      </div>
                      <div className="border border-[var(--border-default)] bg-[var(--surface)] overflow-hidden">
                        <div className="px-3 py-2.5 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-inset)]">
                          <span className="text-xs font-semibold text-[var(--text-primary)]">Structure & Patterns</span>
                          <span className="text-[10px] text-[var(--text-tertiary)] animate-pulse">Scanning geometry…</span>
                        </div>
                        <div className="p-3 space-y-2">
                          <Skeleton height={14} width="65%" />
                          <Skeleton height={28} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <MarketRegimeCard regime={structure?.market_regime ?? null} loading={loading} />
                      <SignalAlignmentCard alignment={structure?.signal_alignment ?? null} loading={loading} />
                      {/* V0.8 — Market Context & Synthesis */}
                      <FuzzyExplainCard
                        report={fuzzyReport}
                        loading={fuzzyLoading}
                        error={fuzzyError}
                        onRefresh={fetchFuzzyReport}
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
                      <SupportResistancePanel sr={structure?.support_resistance ?? null} />
                      <VolumeAnalyticsPanel volume={structure?.volume ?? null} />
                    </>
                  )
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
            <Suspense fallback={lazyFallback}>
              <WatchlistManager
                onSelectSymbol={(sym) => {
                  setActiveSymbol(sym);
                  navigate(`/market/${encodeURIComponent(sym)}`);
                }}
              />
            </Suspense>
          ) : (
            renderAuthGate("Watchlist Manager")
          ))}

        {activeModule === "PORTFOLIO" &&
          (auth.isAuthenticated ? (
            <Suspense fallback={lazyFallback}><PortfolioView /></Suspense>
          ) : (
            renderAuthGate("Portfolio Valuation Engine")
          ))}

        {activeModule === "ALERTS" &&
          (auth.isAuthenticated ? (
            <Suspense fallback={lazyFallback}><AlertsManager /></Suspense>
          ) : (
            renderAuthGate("Real-Time Alert Engine")
          ))}

        {activeModule === "JOURNAL" && (auth.isAuthenticated ? (
          <Suspense fallback={lazyFallback}>
            {path === "/decisions/new" ? <DecisionCreatePage />
              : /^\/decisions\/\d+$/.test(path) ? <DecisionDetailPage />
              : <DecisionsPage />}
          </Suspense>
        ) : renderAuthGate("Decision Workbench"))}

        {activeModule === "SYSTEM" && (
          <Suspense fallback={lazyFallback}><SystemView user={auth.user} /></Suspense>
        )}
        {!path.startsWith("/market") && !path.startsWith("/watchlists") && !path.startsWith("/portfolio") && !path.startsWith("/alerts") && !path.startsWith("/decisions") && !path.startsWith("/system") && path !== "/" && (
          <Suspense fallback={lazyFallback}><NotFoundPage /></Suspense>
        )}
      </div>

      {/* Footer */}
      <Footer />

      {/* Modals */}
      {showAuthModal && (
        <Suspense fallback={null}><AuthModal auth={auth} onClose={() => setShowAuthModal(false)} /></Suspense>
      )}
      {showForensicsModal && (
        <Suspense fallback={null}>
          <CandleForensicsModal
            symbol={activeSymbol}
            timestamp={activeCandle?.time ?? new Date().toISOString().split("T")[0]}
            onClose={() => setShowForensicsModal(false)}
          />
        </Suspense>
      )}
      {showDiffModal && (
        <Suspense fallback={null}>
          <EventDiffModal
            symbol={activeSymbol}
            onClose={() => setShowDiffModal(false)}
          />
        </Suspense>
      )}
      {showBreadthModal && (
        <Suspense fallback={null}>
          <MarketBreadthModal
            onClose={() => setShowBreadthModal(false)}
          />
        </Suspense>
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
