import { lazy, Suspense, useState, useEffect, useCallback, useMemo, type CSSProperties } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import ModuleNav, { type Module } from "./components/ModuleNav";
import Sidebar from "./components/Sidebar";
import ChartPanel from "./components/ChartPanel";
import OHLCTable from "./components/OHLCTable";
import OHLCStats from "./components/OHLCStats";
import CandleAnatomy from "./components/CandleAnatomy";
import PatternCard from "./components/PatternCard";
import MarketRegimeCard from "./components/MarketRegimeCard";
import SignalAlignmentCard from "./components/SignalAlignmentCard";
import IntelligenceSnapshotCard from "./components/IntelligenceSnapshotCard";
import SupportResistancePanel from "./components/SupportResistancePanel";
import VolumeAnalyticsPanel from "./components/VolumeAnalyticsPanel";
import ReplayControlBar from "./components/ReplayControlBar";
import Footer from "./components/Footer";
import MarketResizeHandle from "./components/MarketResizeHandle";
import PremiumCursor from "./components/PremiumCursor";

// Domain components
import { XRayDrawer } from "./components/xray";
import { EventTimeline } from "./components/replay";
import { FuzzyExplainCard } from "./components/FuzzyExplainCard";
import type { FuzzyExplainabilityReport } from "./types/fuzzy";
import { PageErrorState, Skeleton } from "./components/ui";

import { useMarketData } from "./hooks/useMarketData";
import { useAuth } from "./hooks/useAuth";
import { useSelectedCandle } from "./hooks/useSelectedCandle";
import { useMarketPaneLayout } from "./hooks/useMarketPaneLayout";
import type { ReplayStepResponse } from "./types/structure";
import type { MarketEvent } from "./types/events";
import { api } from "./api/client";

const WatchlistsPage = lazy(() => import("./pages/WatchlistsPage"));
const PortfolioView = lazy(() => import("./components/PortfolioView"));
const AlertsManager = lazy(() => import("./components/AlertsManager"));
const DecisionsPage = lazy(() => import("./pages/DecisionsPage"));
const DecisionCreatePage = lazy(() => import("./pages/DecisionCreatePage"));
const DecisionDetailPage = lazy(() => import("./pages/DecisionDetailPage"));
const ReplaySessionListPage = lazy(() => import("./pages/ReplaySessionListPage"));
const ReplaySessionSetupPage = lazy(() => import("./pages/ReplaySessionSetupPage"));
const ReplayLabPage = lazy(() => import("./pages/ReplayLabPage"));
const ReplayReviewPage = lazy(() => import("./pages/ReplayReviewPage"));
const ReplayAnalyticsPage = lazy(() => import("./pages/ReplayAnalyticsPage"));
const PortfolioIntelligencePage = lazy(() => import("./pages/PortfolioIntelligencePage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const SystemView = lazy(() => import("./components/SystemView"));
const AuthModal = lazy(() => import("./components/AuthModal"));
const CandleForensicsModal = lazy(() => import("./components/CandleForensicsModal"));
const EventDiffModal = lazy(() => import("./components/EventDiffModal"));
const MarketBreadthModal = lazy(() => import("./components/MarketBreadthModal"));
const HomePage = lazy(() => import("./pages/HomePage"));
const MarketsPage = lazy(() => import("./pages/MarketsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

const lazyFallback = (
  <div className="flex-1 flex items-center justify-center bg-[var(--canvas)] text-xs text-[var(--text-tertiary)]">
    Loading module...
  </div>
);

function stockSymbolFromPath(path: string): string | null {
  const prefix = path.startsWith("/stocks/") ? "/stocks/" : path.startsWith("/market/") ? "/market/" : null;
  if (!prefix) return null;
  try {
    const raw = decodeURIComponent(path.slice(prefix.length)).toUpperCase();
    const symbol = raw.endsWith(".NS") ? raw : `${raw}.NS`;
    return /^[A-Z0-9&-]+\.NS$/.test(symbol) ? symbol : null;
  } catch {
    return null;
  }
}

export default function App() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const activeModule: Module = path === "/" ? "HOME"
    : path.startsWith("/markets") || path === "/market" ? "MARKETS"
    : path.startsWith("/stocks/") || path.startsWith("/market/") ? "STOCK"
    : path.startsWith("/watchlists") ? "WATCHLISTS"
    : path.startsWith("/portfolio") ? "PORTFOLIO"
    : path.startsWith("/replay") ? "REPLAY"
    : path.startsWith("/alerts") ? "ALERTS"
    : path.startsWith("/decisions") ? "JOURNAL"
    : path.startsWith("/settings") || path.startsWith("/system") ? "SETTINGS"
    : "HOME";
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"STRUCTURE" | "CONTEXT" | "ANATOMY" | "EVENTS">("STRUCTURE");
  const [marketWorkspaceRef, marketPanes] = useMarketPaneLayout();

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

  // Fuzzy explainability state
  const [fuzzyReport, setFuzzyReport] = useState<FuzzyExplainabilityReport | null>(null);
  const [fuzzyLoading, setFuzzyLoading] = useState<boolean>(false);
  const [fuzzyError, setFuzzyError] = useState<string | null>(null);

  // Chronological point-in-time revealed events count up to currentReplayStep
  const revealedEventsCount = useMemo(() => {
    return replayEvents.filter((e) => e.candle_index <= currentReplayStep).length;
  }, [replayEvents, currentReplayStep]);

  // Market terminal state
  const routedSymbol = stockSymbolFromPath(path);
  const marketActive = activeModule === "STOCK" && routedSymbol !== null;
  const activeSymbol = routedSymbol ?? "RELIANCE.NS";
  const [chartRange, setChartRange] = useState({ label: "1M", period: "1mo", interval: "1d" });
  const { stocks, quote, ohlc, pattern, structure, loading, error, refresh } =
    useMarketData(activeSymbol, marketActive, chartRange.period, chartRange.interval);

  useEffect(() => {
    if (path === "/market") navigate("/markets", { replace: true });
    else if (path.startsWith("/market/") && routedSymbol) navigate(`/stocks/${routedSymbol.replace(/\.NS$/, "")}`, { replace: true });
    else if (path === "/replay-lab" || path.startsWith("/replay-lab/")) navigate(path.replace("/replay-lab", "/replay"), { replace: true });
    else if (path === "/system") navigate("/settings/system", { replace: true });
  }, [path, navigate, routedSymbol]);

  useEffect(() => {
    queueMicrotask(() => {
      setIsReplayMode(false);
      setReplayState(null);
      setExternalStep(null);
      setSelectedEventId(null);
    });
  }, [activeSymbol]);

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
  const activeCandle = activeCandles?.length ? xray.selectedCandle ?? activeCandles.at(-1) ?? null : null;

  // Fetch market domain events when entering replay mode or switching symbol
  const fetchEvents = useCallback(() => {
    if (!marketActive) return;
    setLoadingEvents(true);
    api.events
      .getTimeline(activeSymbol, "3mo")
      .then((res) => {
        setReplayEvents(res.events || []);
        setLoadingEvents(false);
      })
      .catch(() => setLoadingEvents(false));
  }, [activeSymbol, marketActive]);

  useEffect(() => {
    if (isReplayMode && marketActive) {
      queueMicrotask(() => {
        setSidebarTab("EVENTS");
        fetchEvents();
      });
    } else {
      queueMicrotask(() => setSidebarTab((current) => current === "EVENTS" ? "STRUCTURE" : current));
    }
  }, [isReplayMode, marketActive, fetchEvents]);

  // Fetch fuzzy explainability report when symbol changes (non-replay mode)
  const fetchFuzzyReport = useCallback(() => {
    if (!marketActive || !activeSymbol || isReplayMode) return;
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
  }, [activeSymbol, isReplayMode, marketActive]);

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
    const protectedModules: Module[] = ["WATCHLISTS", "PORTFOLIO", "REPLAY", "ALERTS", "JOURNAL", "SETTINGS"];
    if (protectedModules.includes(mod) && !auth.isAuthenticated) {
      setShowAuthModal(true);
    }
    const routes: Record<Module, string> = {
      HOME: "/",
      MARKETS: "/markets",
      STOCK: `/stocks/${encodeURIComponent(activeSymbol.replace(/\.NS$/, ""))}`,
      WATCHLISTS: "/watchlists",
      PORTFOLIO: "/portfolio",
      REPLAY: "/replay",
      ALERTS: "/alerts",
      JOURNAL: "/decisions",
      SETTINGS: "/settings",
    };
    navigate(routes[mod]);
  };

  // Auth gate — refined quant gate
  const renderAuthGate = (moduleName: string) => (
    <div className="flex-1 flex flex-col items-center justify-center bg-[var(--canvas)] p-6">
      <div className="w-full max-w-sm border border-[var(--border-default)] bg-[var(--surface)] p-8 text-center flex flex-col items-center gap-3.5 shadow-2xl">
        <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] block animate-pulse" />
        <div className="text-sm font-semibold text-[var(--text-primary)]">
          {moduleName} requires authentication
        </div>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed m-0">
          Access to custom watchlists, simulated portfolios, alert engines, and decision audits requires a
          verified session.
        </p>
        <button
          id="gate-auth-btn"
          onClick={() => setShowAuthModal(true)}
          className="mt-2 px-5 py-2 text-xs font-semibold bg-[var(--accent-primary)] text-white transition-colors"
        >
          Sign In / Register
        </button>
      </div>
    </div>
  );

  return (
    <div className="app-shell flex flex-col bg-[var(--canvas)] text-[var(--text-primary)] overflow-hidden select-none">
      <PremiumCursor />
      {/* Top Module Navigator */}
      <ModuleNav
        activeModule={activeModule}
        onModuleChange={handleModuleChange}
        onOpenSymbol={(symbol) => navigate(`/stocks/${encodeURIComponent(symbol.replace(/\.NS$/, ""))}`)}
        onOpenBreadth={() => setShowBreadthModal(true)}
        user={auth.user}
        onLogout={auth.logout}
        onLogin={() => setShowAuthModal(true)}
      />

      {/* Main Terminal Body */}
      <div className="app-body flex flex-1 min-h-0 overflow-hidden">
        {activeModule === "HOME" && <Suspense fallback={lazyFallback}><HomePage /></Suspense>}
        {activeModule === "MARKETS" && <Suspense fallback={lazyFallback}><MarketsPage /></Suspense>}
        {activeModule === "STOCK" && !routedSymbol && <PageErrorState title="Invalid stock symbol" message="Choose a supported stock from Markets or search." actionHref="/stocks/RELIANCE" actionLabel="Open Reliance" />}
        {marketActive && (
          <div
            ref={marketWorkspaceRef}
            className={`market-workspace flex-1 min-h-0 overflow-hidden${marketPanes.dragging ? " market-workspace--dragging" : ""}`}
            style={{ "--market-columns": marketPanes.columns } as CSSProperties}
            data-watchlist-collapsed={marketPanes.layout.collapsed.watchlist}
            data-center-collapsed={marketPanes.layout.collapsed.center}
            data-analytics-collapsed={marketPanes.layout.collapsed.analytics}
          >
            {/* Left: Watchlist */}
            <div className="market-pane market-pane--watchlist" data-collapsed={marketPanes.layout.collapsed.watchlist}>
              <Sidebar
                stocks={stocks}
                activeSymbol={activeSymbol}
                onSelectSymbol={(symbol) => navigate(`/stocks/${encodeURIComponent(symbol.replace(/\.NS$/, ""))}`)}
                onCollapse={() => marketPanes.togglePane("watchlist")}
              />
              <button className="market-pane__rail" type="button" aria-label="Show Watchlist" aria-controls="market-watchlist-content" aria-expanded={false} title="Show Watchlist" onClick={() => marketPanes.togglePane("watchlist")}>Watchlist</button>
            </div>

            {!marketPanes.layout.collapsed.watchlist && !marketPanes.layout.collapsed.center && (
              <MarketResizeHandle
                side="watchlist"
                value={marketPanes.leftWidth}
                minimum={180}
                maximum={marketPanes.leftMax}
                onChange={(width) => marketPanes.resizePane("watchlist", width)}
                onDragState={marketPanes.setDragging}
                onFinish={marketPanes.commitResize}
              />
            )}

            {/* Center: Chart + OHLC Table */}
            <div className="market-pane market-pane--center" data-collapsed={marketPanes.layout.collapsed.center}>
            <div id="market-center-content" className="market-center flex flex-col min-w-0 min-h-0 overflow-hidden">
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
                symbol={activeSymbol}
                stock={stocks.find((stock) => stock.symbol === activeSymbol) ?? null}
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
                onRetry={refresh}
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
                onAddWatchlist={() => navigate(`/watchlists?symbol=${encodeURIComponent(activeSymbol)}`)}
                onCreateAlert={() => navigate(`/alerts?symbol=${encodeURIComponent(activeSymbol)}`)}
                onShare={() => void navigator.clipboard?.writeText(window.location.href)}
                timeframe={chartRange.label}
                onTimeframeChange={(label, period, interval) => setChartRange({ label, period, interval })}
                onOpenDiff={() => setShowDiffModal(true)}
                onOpenForensics={() => setShowForensicsModal(true)}
                isXRayOpen={xray.isDrawerOpen}
                onToggleXRay={xray.toggleDrawer}
                onCollapse={() => marketPanes.togglePane("center")}
              />
              <OHLCTable
                candles={isReplayMode && replayState ? replayState.candles_slice as any : ohlc?.candles}
                selectedDate={activeCandle?.time}
                onSelectCandle={xray.selectCandle}
              />
            </div>
            <button className="market-pane__rail" type="button" aria-label="Show chart" aria-controls="market-center-content" aria-expanded={false} title="Show chart" onClick={() => marketPanes.togglePane("center")}>Chart</button>
            </div>

            {!marketPanes.layout.collapsed.center && !marketPanes.layout.collapsed.analytics && (
              <MarketResizeHandle
                side="analytics"
                value={marketPanes.rightWidth}
                minimum={280}
                maximum={marketPanes.rightMax}
                onChange={(width) => marketPanes.resizePane("analytics", width)}
                onDragState={marketPanes.setDragging}
                onFinish={marketPanes.commitResize}
              />
            )}

            {/* Right: Analytics Sidebar */}
            <div className="market-pane market-pane--analytics" data-collapsed={marketPanes.layout.collapsed.analytics}>
            <aside id="market-analytics-content" className="analytics-panel shrink-0 bg-[var(--canvas)] border-l border-[var(--border-default)] flex flex-col min-h-0 overflow-hidden">
              {/* Tab selector */}
              {/* Tab selector */}
              <div className="analytics-panel__tabs flex items-center border-b border-[var(--border-default)] bg-[var(--surface)] shrink-0">
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
                          ? "text-[var(--text-primary)] bg-[var(--surface-elevated)] border-b-[var(--accent-primary)] font-semibold"
                          : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border-b-transparent"
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
                        <span className="px-1 py-0.2 text-label bg-[#1E90FF]/20 text-[#60A5FA] border border-[#1E90FF]/30 rounded-sm font-mono whitespace-nowrap">
                          {revealedEventsCount}/{replayEvents.length}
                        </span>
                      )}
                    </button>
                  );
                })}
                <button className="market-pane__collapse" type="button" aria-label="Hide analytics" aria-controls="market-analytics-content" aria-expanded={true} title="Hide analytics" onClick={() => marketPanes.togglePane("analytics")}>×</button>
              </div>

              {/* Analytics body */}
              <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3 bg-[var(--canvas)] overscroll-contain">
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
                          <span className="text-label text-[var(--text-tertiary)] animate-pulse">Classifying regime…</span>
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
                          <span className="text-label text-[var(--text-tertiary)] animate-pulse">Tallying indicators…</span>
                        </div>
                        <div className="p-3 bg-[var(--surface-inset)] border-b border-[var(--border-subtle)] grid grid-cols-2 gap-4">
                          <Skeleton height={28} />
                          <Skeleton height={28} />
                        </div>
                      </div>
                      <div className="border border-[var(--border-default)] bg-[var(--surface)] overflow-hidden">
                        <div className="px-3 py-2.5 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-inset)]">
                          <span className="text-xs font-semibold text-[var(--text-primary)]">Structure & Patterns</span>
                          <span className="text-label text-[var(--text-tertiary)] animate-pulse">Scanning geometry…</span>
                        </div>
                        <div className="p-3 space-y-2">
                          <Skeleton height={14} width="65%" />
                          <Skeleton height={28} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <IntelligenceSnapshotCard structure={structure} />
                      <details className="intelligence-details"><summary>Explore the full technical evidence</summary><div>
                      <MarketRegimeCard regime={structure?.market_regime ?? null} loading={loading} />
                      <SignalAlignmentCard alignment={structure?.signal_alignment ?? null} loading={loading} />
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
                      </div></details>
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
            <button className="market-pane__rail" type="button" aria-label="Show analytics" aria-controls="market-analytics-content" aria-expanded={false} title="Show analytics" onClick={() => marketPanes.togglePane("analytics")}>Analytics</button>
            </div>
            {marketPanes.layout.collapsed.watchlist && marketPanes.layout.collapsed.center && marketPanes.layout.collapsed.analytics && (
              <button className="market-layout-reset" type="button" onClick={marketPanes.resetLayout}>Reset layout</button>
            )}
          </div>
        )}

        {activeModule === "WATCHLISTS" &&
          (auth.isAuthenticated ? (
            <Suspense fallback={lazyFallback}>
              <WatchlistsPage />
            </Suspense>
          ) : (
            renderAuthGate("Watchlist Manager")
          ))}

        {activeModule === "PORTFOLIO" &&
          (auth.isAuthenticated ? (
            <Suspense fallback={lazyFallback}><Routes>
              <Route path="/portfolio" element={<PortfolioView />} />
              <Route path="/portfolio/:portfolioId/:view" element={<PortfolioIntelligencePage />} />
              <Route path="/portfolio/*" element={<PortfolioView />} />
            </Routes></Suspense>
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

        {activeModule === "REPLAY" && (auth.isAuthenticated ? (
          <Suspense fallback={lazyFallback}>
            <Routes>
              <Route path="/replay" element={<ReplaySessionListPage />} />
              <Route path="/replay/new" element={<ReplaySessionSetupPage />} />
              <Route path="/replay/analytics" element={<ReplayAnalyticsPage />} />
              <Route path="/replay/:sessionId/review" element={<ReplayReviewPage />} />
              <Route path="/replay/:sessionId" element={<ReplayLabPage />} />
              <Route path="/replay/*" element={<ReplaySessionListPage />} />
            </Routes>
          </Suspense>
        ) : renderAuthGate("Replay and Behaviour Lab"))}

        {activeModule === "SETTINGS" && (path === "/settings/system" ? <Suspense fallback={lazyFallback}><SystemView user={auth.user} /></Suspense> : auth.isAuthenticated ? <Suspense fallback={lazyFallback}><SettingsPage /></Suspense> : renderAuthGate("Settings"))}
        {!["/", "/markets", "/market", "/system"].includes(path) && !path.startsWith("/stocks/") && !path.startsWith("/market/") && !path.startsWith("/watchlists") && !path.startsWith("/portfolio") && !path.startsWith("/replay") && !path.startsWith("/alerts") && !path.startsWith("/decisions") && !path.startsWith("/settings") && (
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
