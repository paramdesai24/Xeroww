// src/components/ChartPanel.tsx
// TradingView Lightweight Charts candlestick panel with a pitch-black canvas,
// vivid saturated candles, crisp price lines, and natural typography.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  BaselineSeries,
  HistogramSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type MouseEventParams,
} from "lightweight-charts";
import { TrendingUp, TrendingDown, BarChart2, Plus, Minus, RotateCcw, Maximize2, Minimize2 } from "lucide-react";
import type { QuoteData, OHLCData, OHLCBar, StockMeta } from "../types/market";
import type { MarketStructureSummaryResponse, SRZone } from "../types/structure";
import { typography } from "../design";
import type { AppError } from "../api/errors";
import { useTheme } from "../theme/context";
import { chartCandles } from "./market/chartCandles";
import { Pill, Toolbar } from "./ui";

interface ChartPanelProps {
  symbol: string;
  quote: QuoteData | null;
  stock?: StockMeta | null;
  ohlc: OHLCData | null;
  structure?: MarketStructureSummaryResponse | null;
  loading: boolean;
  error: AppError | null;
  onRetry?: () => void;
  onSelectCandle?: (candle: OHLCBar) => void;
  onOpenReplay?: () => void;
  onOpenDiff?: () => void;
  onOpenForensics?: () => void;
  onPlanDecision?: () => void;
  onAddWatchlist?: () => void;
  onCreateAlert?: () => void;
  onShare?: () => void;
  timeframe?: string;
  onTimeframeChange?: (label: string, period: string, interval: string) => void;
  isXRayOpen?: boolean;
  onToggleXRay?: () => void;
  onCollapse?: () => void;
}

export default function ChartPanel({
  symbol,
  quote,
  stock,
  ohlc,
  structure,
  loading,
  error,
  onRetry,
  onSelectCandle,
  onOpenReplay,
  onOpenDiff,
  onOpenForensics,
  onPlanDecision,
  onAddWatchlist,
  onCreateAlert,
  onShare,
  timeframe = "1M",
  onTimeframeChange,
  isXRayOpen,
  onToggleXRay,
  onCollapse,
}: ChartPanelProps) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const maSeriesRef = useRef<ISeriesApi<"Line">[]>([]);

  // Overlay state toggles
  const [showSR, setShowSR] = useState<boolean>(true);
  const [showFastMA, setShowFastMA] = useState<boolean>(false); // EMA 9 & EMA 20
  const [showSlowMA, setShowSlowMA] = useState<boolean>(false); // SMA 50 & SMA 200
  const [chartType, setChartType] = useState<"candles" | "hollow" | "line" | "area" | "baseline">("candles");
  const [hoveredBar, setHoveredBar] = useState<OHLCBar | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setIsFullscreen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen]);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (error?.status !== 429) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [error]);
  const retrySeconds = error?.retryAt ? Math.max(0, Math.ceil((error.retryAt - clock) / 1000)) : 0;
  const chartBars = useMemo(() => chartCandles(ohlc), [ohlc]);

  // Initialize chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const palette = resolvedTheme === "light"
      ? {
          canvas: "#F6F8F8",
          text: "#4C5F6D",
          grid: "#E1E9EA",
          border: "#D7E0E3",
          accent: "#3B82F6",
          label: "#FBFCFB",
          positive: "#16803A",
          negative: "#C92A2A",
        }
      : {
          canvas: "#050607",
          text: "#9AA4B2",
          grid: "#101317",
          border: "#1B222B",
          accent: "#3B82F6",
          label: "#11161D",
          positive: "#22C55E",
          negative: "#EF4444",
        };

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: palette.canvas },
        textColor: palette.text,
        fontFamily: typography.chart.family,
        fontSize: typography.chart.axisSize,
      },
      grid: {
        vertLines: { color: palette.grid },
        horzLines: { color: palette.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: palette.accent, labelBackgroundColor: palette.label },
        horzLine: { color: palette.accent, labelBackgroundColor: palette.label },
      },
      rightPriceScale: {
        borderColor: palette.border,
        textColor: palette.text,
        scaleMargins: {
          top: 0.08,
          bottom: 0.08,
        },
      },
      timeScale: {
        borderColor: palette.border,
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    const series = chartType === "line"
      ? chart.addSeries(LineSeries, { color: palette.accent, lineWidth: 2 })
      : chartType === "area"
        ? chart.addSeries(AreaSeries, { lineColor: palette.accent, topColor: `${palette.accent}55`, bottomColor: `${palette.accent}05` })
        : chartType === "baseline"
          ? chart.addSeries(BaselineSeries, { baseValue: { type: "price", price: quote?.previous_close ?? 0 }, topLineColor: palette.positive, topFillColor1: `${palette.positive}44`, topFillColor2: `${palette.positive}05`, bottomLineColor: palette.negative, bottomFillColor1: `${palette.negative}05`, bottomFillColor2: `${palette.negative}44` })
          : chart.addSeries(CandlestickSeries, {
              upColor: chartType === "hollow" ? "transparent" : palette.positive,
              downColor: chartType === "hollow" ? "transparent" : palette.negative,
              borderUpColor: palette.positive,
              borderDownColor: palette.negative,
              wickUpColor: palette.positive,
              wickDownColor: palette.negative,
            });

    chartRef.current = chart;
    seriesRef.current = series as ISeriesApi<any>;
    const volumeSeries = chart.addSeries(HistogramSeries, { priceScaleId: "", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: .82, bottom: 0 } });
    volumeSeriesRef.current = volumeSeries;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        if (containerRef.current.clientWidth < 1 || containerRef.current.clientHeight < 1) return;
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLinesRef.current = [];
      maSeriesRef.current = [];
    };
  }, [resolvedTheme, chartType, quote?.previous_close]);

  // Update candle data and handle chart clicks
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    if (!chartBars.length) {
      seriesRef.current.setData([]);
      volumeSeriesRef.current?.setData([]);
      return;
    }

    const data = chartBars.map(({ bar, time }) => chartType === "candles" || chartType === "hollow" ? ({
      time, open: bar.open, high: bar.high, low: bar.low, close: bar.close,
    }) : ({ time, value: bar.close }));

    seriesRef.current.setData(data as any);
    volumeSeriesRef.current?.setData(chartBars.map(({ bar, time }) => ({
      time,
      value: bar.volume,
      color: bar.close >= bar.open ? (resolvedTheme === "light" ? "#16803A33" : "#22C55E44") : (resolvedTheme === "light" ? "#C6282833" : "#EF444444"),
    })));

    const handleCrosshairMove = (param: MouseEventParams) => {
      const matched = param.time ? chartBars.find((item) => String(item.time) === String(param.time))?.bar ?? null : null;
      setHoveredBar((previous) => previous?.chart_time === matched?.chart_time && previous?.time === matched?.time ? previous : matched);
    };
    chartRef.current.subscribeCrosshairMove(handleCrosshairMove);

    // Subscribe to crosshair click for candle forensic selection
    const handleCandleClick = (param: MouseEventParams) => {
      if (!param.time || !onSelectCandle) return;
      const clickedTime = String(param.time);
      const matched = chartBars.find((item) => String(item.time) === clickedTime)?.bar;
      if (matched) {
        onSelectCandle(matched);
      }
    };

    chartRef.current.subscribeClick(handleCandleClick);

    return () => {
      chartRef.current?.unsubscribeClick(handleCandleClick);
      chartRef.current?.unsubscribeCrosshairMove(handleCrosshairMove);
    };
  }, [chartBars, onSelectCandle, resolvedTheme, chartType]);

  // Support / Resistance Lines
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    // Remove old lines
    priceLinesRef.current.forEach((line) => {
      series.removePriceLine(line);
    });
    priceLinesRef.current = [];

    if (!showSR || !structure?.support_resistance) return;

    const resZones = (structure.support_resistance.resistance_zones || []).slice(0, 3);
    const supZones = (structure.support_resistance.support_zones || []).slice(0, 3);

    resZones.forEach((zone: SRZone) => {
      const line = series.createPriceLine({
        price: zone.price,
        color: "#EF4444",
        lineWidth: zone.strength >= 7 ? 2 : 1,
        lineStyle: zone.strength >= 7 ? LineStyle.Solid : LineStyle.Dashed,
        axisLabelVisible: true,
        title: `RES ₹${zone.price.toFixed(1)} (${zone.touches}x)`,
      });
      priceLinesRef.current.push(line);
    });

    supZones.forEach((zone: SRZone) => {
      const line = series.createPriceLine({
        price: zone.price,
        color: "#22C55E",
        lineWidth: zone.strength >= 7 ? 2 : 1,
        lineStyle: zone.strength >= 7 ? LineStyle.Solid : LineStyle.Dashed,
        axisLabelVisible: true,
        title: `SUP ₹${zone.price.toFixed(1)} (${zone.touches}x)`,
      });
      priceLinesRef.current.push(line);
    });
  }, [showSR, structure, resolvedTheme, chartType]);

  // Moving Average Overlays
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // Clear previous MA series
    maSeriesRef.current.forEach((s) => {
      chart.removeSeries(s);
    });
    maSeriesRef.current = [];

    if (!chartBars.length) return;

    const closes = chartBars.map(({ bar }) => bar.close);
    const times = chartBars.map(({ time }) => time);

    // Fast MAs: EMA 9 & EMA 20
    if (showFastMA) {
      // Compute EMA 9 (secondary electric blue)
      const ema9Series = chart.addSeries(LineSeries, {
        color: "#3B82F6",
        lineWidth: 1,
        title: "EMA 9",
      });
      const k9 = 2 / (9 + 1);
      let ema9 = closes[0];
      const ema9Data: { time: import("lightweight-charts").Time; value: number }[] = [];
      for (let i = 0; i < closes.length; i++) {
        ema9 = i === 0 ? closes[0] : closes[i] * k9 + ema9 * (1 - k9);
        if (i >= 8) ema9Data.push({ time: times[i], value: Number(ema9.toFixed(2)) });
      }
      ema9Series.setData(ema9Data);
      maSeriesRef.current.push(ema9Series);

      // Compute EMA 20 (Dodger Blue primary)
      const ema20Series = chart.addSeries(LineSeries, {
        color: "#1E90FF",
        lineWidth: 1,
        title: "EMA 20",
      });
      const k20 = 2 / (20 + 1);
      let ema20 = closes[0];
      const ema20Data: { time: import("lightweight-charts").Time; value: number }[] = [];
      for (let i = 0; i < closes.length; i++) {
        ema20 = i === 0 ? closes[0] : closes[i] * k20 + ema20 * (1 - k20);
        if (i >= 19) ema20Data.push({ time: times[i], value: Number(ema20.toFixed(2)) });
      }
      ema20Series.setData(ema20Data);
      maSeriesRef.current.push(ema20Series);
    }

    // Slow MAs: SMA 50 & SMA 200
    if (showSlowMA) {
      if (closes.length >= 50) {
        const sma50Series = chart.addSeries(LineSeries, {
          color: "#A0A0A8",
          lineWidth: 1,
          title: "SMA 50",
        });
        const sma50Data: { time: import("lightweight-charts").Time; value: number }[] = [];
        for (let i = 49; i < closes.length; i++) {
          const sum = closes.slice(i - 49, i + 1).reduce((a, b) => a + b, 0);
          sma50Data.push({ time: times[i], value: Number((sum / 50).toFixed(2)) });
        }
        sma50Series.setData(sma50Data);
        maSeriesRef.current.push(sma50Series);
      }

      if (closes.length >= 200) {
        const sma200Series = chart.addSeries(LineSeries, {
          color: "#6B6B72",
          lineWidth: 2,
          title: "SMA 200",
        });
        const sma200Data: { time: import("lightweight-charts").Time; value: number }[] = [];
        for (let i = 199; i < closes.length; i++) {
          const sum = closes.slice(i - 199, i + 1).reduce((a, b) => a + b, 0);
          sma200Data.push({ time: times[i], value: Number((sum / 200).toFixed(2)) });
        }
        sma200Series.setData(sma200Data);
        maSeriesRef.current.push(sma200Series);
      }
    }
  }, [showFastMA, showSlowMA, chartBars, resolvedTheme, chartType]);

  const positive = (quote?.change_pct ?? 0) > 0;
  const negative = (quote?.change_pct ?? 0) < 0;

  // Programmatic chart zoom and scaling controls
  const handleZoomIn = () => {
    if (!chartRef.current) return;
    const timeScale = chartRef.current.timeScale();
    const range = timeScale.getVisibleLogicalRange();
    if (!range) return;
    const currentSpan = range.to - range.from;
    if (currentSpan <= 6) return; // Prevent over-zooming
    const delta = Math.max(1, Math.round(currentSpan * 0.18));
    timeScale.setVisibleLogicalRange({
      from: range.from + delta,
      to: range.to - delta,
    });
  };

  const handleZoomOut = () => {
    if (!chartRef.current) return;
    const timeScale = chartRef.current.timeScale();
    const range = timeScale.getVisibleLogicalRange();
    if (!range) return;
    const currentSpan = range.to - range.from;
    const delta = Math.max(1, Math.round(currentSpan * 0.18));
    timeScale.setVisibleLogicalRange({
      from: range.from - delta,
      to: range.to + delta,
    });
  };

  const handleResetZoom = () => {
    if (!chartRef.current) return;
    chartRef.current.timeScale().fitContent();
  };

  const quoteStats = (
    <>
      <div className="quote-bar__stat"><span className="quote-bar__stat-label">Open</span><span className="quote-bar__stat-value">₹{ohlc?.candles.at(-1)?.open.toLocaleString("en-IN", { maximumFractionDigits: 2 }) ?? "--"}</span></div>
      <div className="quote-bar__stat"><span className="quote-bar__stat-label">High</span><span className="quote-bar__stat-value">₹{quote?.day_high.toFixed(2)}</span></div>
      <div className="quote-bar__stat"><span className="quote-bar__stat-label">Low</span><span className="quote-bar__stat-value">₹{quote?.day_low.toFixed(2)}</span></div>
      <div className="quote-bar__stat"><span className="quote-bar__stat-label">Volume</span><span className="quote-bar__stat-value">{quote ? (quote.volume / 1e5).toFixed(2) : "0.00"}L</span></div>
    </>
  );
  const timeframes = [
    ["1D", "1d", "5m"], ["5D", "5d", "15m"], ["1M", "1mo", "1d"], ["3M", "3mo", "1d"],
    ["6M", "6mo", "1d"], ["1Y", "1y", "1d"], ["5Y", "5y", "1wk"], ["Max", "max", "1mo"],
  ] as const;

  return (
    <div className={`chart-panel flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden${isFullscreen ? " chart-panel--fullscreen" : ""}`} style={{ backgroundColor: "var(--canvas)" }}>
      {/* Quote Bar — natural case, clear size jumps, crisp layout */}
      <div
        className="quote-bar flex shrink-0 select-none border-b border-[var(--border-default)]"
        style={{ backgroundColor: "var(--surface)" }}
      >
        {quote ? (
          <>
            <div className="quote-bar__identity flex items-center">
              <div className="quote-bar__asset flex items-baseline gap-2">
                <h1 className="type-page-title text-[var(--text-primary)] m-0">
                  {quote.symbol.replace(".NS", "")}
                </h1>
                <span className="quote-bar__company"><strong>{quote.display_name}</strong><small>{stock?.sector ?? "Equity"} · {stock?.exchange ?? "NSE"}</small></span>
              </div>

              <div className="quote-bar__divider" />

              <div className="quote-bar__price flex items-baseline gap-2">
                <span
                  className="type-metric text-[var(--text-primary)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  ₹{quote.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span
                  className={`flex items-center gap-0.5 text-xs font-semibold tabular-nums ${
                    positive ? "text-[var(--positive)]" : negative ? "text-[var(--negative)]" : "text-[var(--text-tertiary)]"
                  }`}
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {positive ? (
                    <TrendingUp size={12} strokeWidth={2.5} />
                  ) : negative ? (
                    <TrendingDown size={12} strokeWidth={2.5} />
                  ) : null}
                  {quote.change > 0 ? "+" : ""}
                  {quote.change.toFixed(2)} ({quote.change_pct > 0 ? "+" : ""}
                  {quote.change_pct.toFixed(2)}%)
                </span>
              </div>

              <div className="quote-bar__header-actions">
                {onPlanDecision && <button onClick={onPlanDecision}>Decision</button>}
                <details className="quote-bar__more"><summary>More</summary><div className="quote-bar__more-panel">
                  {onAddWatchlist && <button onClick={onAddWatchlist}>Add to watchlist</button>}
                  {onCreateAlert && <button onClick={onCreateAlert}>Create alert</button>}
                  {onShare && <button onClick={onShare}>Share stock</button>}
                  <div className="quote-bar__more-stats">{quoteStats}</div>
                </div></details>
              </div>
              {onCollapse && <button className="market-pane__collapse quote-bar__collapse" type="button" aria-label="Hide chart" aria-controls="market-center-content" aria-expanded={true} title="Hide chart" onClick={onCollapse}>×</button>}
            </div>

            {/* Overlay and intelligence controls */}
            <Toolbar className="quote-bar__controls flex items-center text-xs" tabIndex={0} aria-label="Chart layers and Workspace actions, scroll for more">
              <div className="quote-bar__layers quote-bar__layers--type" role="group" aria-label="Chart type">
                <select className="quote-bar__select" aria-label="Chart type" value={chartType} onChange={(event) => setChartType(event.target.value as typeof chartType)}>
                  <option value="candles">Candles</option><option value="hollow">Hollow candles</option><option value="line">Line</option><option value="area">Area</option><option value="baseline">Baseline</option>
                </select>
              </div>
              {onTimeframeChange && <div className="quote-bar__layers quote-bar__layers--range" role="group" aria-label="Chart timeframe">
                <select className="quote-bar__select quote-bar__select--range" aria-label="Chart timeframe" value={timeframe} onChange={(event) => {
                  const selected = timeframes.find(([label]) => label === event.target.value);
                  if (selected) onTimeframeChange(selected[0], selected[1], selected[2]);
                }}>
                  {timeframes.map(([label]) => <option key={label} value={label}>{label === "5D" ? "1W" : label.toUpperCase()}</option>)}
                </select>
              </div>}
              <div className="quote-bar__layers" role="group" aria-label="Chart indicators">
                <select className="quote-bar__select quote-bar__select--indicators" aria-label="Toggle chart indicator" defaultValue="" onChange={(event) => {
                  if (event.target.value === "sr") setShowSR((value) => !value);
                  if (event.target.value === "ema") setShowFastMA((value) => !value);
                  if (event.target.value === "sma") setShowSlowMA((value) => !value);
                  event.currentTarget.value = "";
                }}>
                  <option value="">Indicators · {Number(showSR) + Number(showFastMA) + Number(showSlowMA)}</option>
                  <option value="sr">S/R · {showSR ? "On" : "Off"}</option>
                  <option value="ema">EMA 9/20 · {showFastMA ? "On" : "Off"}</option>
                  <option value="sma">SMA 50/200 · {showSlowMA ? "On" : "Off"}</option>
                </select>
              </div>

              {/* Intelligence Feature Buttons */}
              <div className="quote-bar__actions flex items-center gap-2 shrink-0">
                <button className="quote-bar__control" type="button" onClick={() => setIsFullscreen((value) => !value)} title={isFullscreen ? "Exit fullscreen chart" : "Fullscreen chart"} aria-label={isFullscreen ? "Exit fullscreen chart" : "Fullscreen chart"}>
                  {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
                {onPlanDecision && <Pill onClick={onPlanDecision}>Decision</Pill>}
                {onOpenReplay && <Pill onClick={onOpenReplay}>Replay</Pill>}
                {onOpenDiff && <Pill onClick={onOpenDiff}>Diff</Pill>}
                {onOpenForensics && <Pill onClick={onOpenForensics}>Forensics</Pill>}
                {onToggleXRay && (
                  <button
                    id="trigger-xray-btn"
                    onClick={onToggleXRay}
                    className="quote-bar__control quote-bar__control--workspace"
                    aria-pressed={isXRayOpen}
                    title="Toggle Flagship X-Ray Inspection Drawer (Click any candlestick)"
                  >
                    <span className="quote-bar__control-dot" />
                    <span>X-Ray</span>
                  </button>
                )}
              </div>
            </Toolbar>
          </>
        ) : (
          <div className="quote-bar__fallback flex items-center gap-2 text-[var(--text-tertiary)] py-1 text-xs">
            <BarChart2 size={16} />
            <span>{loading ? `Loading ${symbol}…` : error ? `${symbol}: ${error.status === 429 ? "Requests temporarily limited" : "Quote unavailable"}` : symbol}</span>
            {onCollapse && <button className="market-pane__collapse" type="button" aria-label="Hide chart" aria-controls="market-center-content" aria-expanded={true} title="Hide chart" onClick={onCollapse}>×</button>}
          </div>
        )}
      </div>

      {/* Candlestick Chart Canvas — True pitch black #000000 */}
      <div className="flex-1 min-h-0 relative bg-[var(--canvas)] overflow-hidden">
        {ohlc?.candles.length ? <div className="chart-crosshair-ribbon" aria-live="off">
          <span>{(hoveredBar ?? ohlc.candles.at(-1))?.time}</span>
          {(["open", "high", "low", "close"] as const).map((key) => <span key={key}><small>{key[0].toUpperCase()}</small> ₹{(hoveredBar ?? ohlc.candles.at(-1))?.[key].toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>)}
          <span><small>Vol</small> {(((hoveredBar ?? ohlc.candles.at(-1))?.volume ?? 0) / 1e5).toFixed(2)}L</span>
        </div> : null}
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 transition-opacity duration-150">
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-sm bg-[var(--surface-elevated)] border border-[var(--border-default)] text-[var(--text-secondary)] text-xs font-medium">
              <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-ping" />
              <span>Syncing OHLC bars…</span>
            </div>
          </div>
        )}

        {error && !loading && !ohlc && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
            <div className="bg-[var(--surface-elevated)] border border-[var(--border-default)] rounded-sm px-6 py-4 text-center max-w-sm">
              <p className="type-card-title">{error.status === 429 ? "Requests temporarily limited" : "Market feed unavailable"}</p>
              <p className="type-body text-[var(--text-secondary)] mt-1">{error.status === 429 ? `Try again${retrySeconds ? ` in ${retrySeconds}s` : " now"}.` : "Price history could not be loaded. Try again shortly."}</p>
              {onRetry && <button className="quote-bar__control mt-3" disabled={retrySeconds > 0} onClick={onRetry}>Retry</button>}
            </div>
          </div>
        )}

        {error && !loading && ohlc && <div className="absolute top-3 left-3 z-10 bg-[var(--surface-elevated)] border border-[var(--border-default)] px-3 py-2 type-meta">Quote unavailable. Historical bars remain visible.</div>}

        <div ref={containerRef} className="w-full h-full" />

        {/* Zoom & Scaling Control Bar — Bottom Right Corner */}
        {ohlc && ohlc.candles && ohlc.candles.length > 0 && !loading && (
          <div
            id="chart-zoom-controls"
            className="absolute bottom-9 left-1/2 -translate-x-1/2 z-20 flex items-center bg-[#12141A]/95 backdrop-blur-md border border-[#232734] rounded-md p-0.5 shadow-lg shadow-black/60 gap-0.5 select-none"
            title="Chart Scale & Zoom Controls"
          >
            <button
              id="btn-zoom-in"
              onClick={handleZoomIn}
              className="w-7 h-7 flex items-center justify-center rounded text-[#9CA3AF] hover:text-white hover:bg-[#1E2538] active:scale-95 transition-all duration-150"
              title="Zoom In (+)"
              aria-label="Zoom In"
            >
              <Plus size={15} strokeWidth={2.2} />
            </button>
            <button
              id="btn-zoom-out"
              onClick={handleZoomOut}
              className="w-7 h-7 flex items-center justify-center rounded text-[#9CA3AF] hover:text-white hover:bg-[#1E2538] active:scale-95 transition-all duration-150"
              title="Zoom Out (-)"
              aria-label="Zoom Out"
            >
              <Minus size={15} strokeWidth={2.2} />
            </button>
            <div className="w-[1px] h-3.5 bg-[#232734] mx-0.5" />
            <button
              id="btn-zoom-reset"
              onClick={handleResetZoom}
              className="w-7 h-7 flex items-center justify-center rounded text-[#9CA3AF] hover:text-white hover:bg-[#1E2538] active:scale-95 transition-all duration-150"
              title="Reset View / Fit All Candles"
              aria-label="Reset Zoom"
            >
              <RotateCcw size={13} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
