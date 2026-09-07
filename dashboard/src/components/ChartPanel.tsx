// src/components/ChartPanel.tsx
// TradingView Lightweight Charts v5 candlestick panel — v2 pitch-black canvas,
// vivid saturated candles, crisp price lines, and natural typography.

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type MouseEventParams,
} from "lightweight-charts";
import { TrendingUp, TrendingDown, BarChart2 } from "lucide-react";
import type { QuoteData, OHLCData, OHLCBar } from "../types/market";
import type { MarketStructureSummaryResponse, SRZone } from "../types/structure";

interface ChartPanelProps {
  quote: QuoteData | null;
  ohlc: OHLCData | null;
  structure?: MarketStructureSummaryResponse | null;
  loading: boolean;
  error: string | null;
  onSelectCandle?: (candle: OHLCBar) => void;
  onOpenReplay?: () => void;
  onOpenDiff?: () => void;
  onOpenForensics?: () => void;
}

export default function ChartPanel({
  quote,
  ohlc,
  structure,
  loading,
  error,
  onSelectCandle,
  onOpenReplay,
  onOpenDiff,
  onOpenForensics,
}: ChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const maSeriesRef = useRef<ISeriesApi<"Line">[]>([]);

  // Overlay state toggles
  const [showSR, setShowSR] = useState<boolean>(true);
  const [showFastMA, setShowFastMA] = useState<boolean>(false); // EMA 9 & EMA 20
  const [showSlowMA, setShowSlowMA] = useState<boolean>(false); // SMA 50 & SMA 200

  // Initialize chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#000000" }, // pitch black canvas
        textColor: "#A0A0A8", // bright legible axis labels
        fontFamily: "'JetBrains Mono', 'Public Sans', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1A1A1A" },
        horzLines: { color: "#1A1A1A" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#3B82F688", labelBackgroundColor: "#161616" }, // elegant secondary accent crosshair
        horzLine: { color: "#3B82F688", labelBackgroundColor: "#161616" },
      },
      rightPriceScale: {
        borderColor: "#232323",
        textColor: "#A0A0A8",
        scaleMargins: {
          top: 0.08,
          bottom: 0.08,
        },
      },
      timeScale: {
        borderColor: "#232323",
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22C55E",
      downColor: "#EF4444",
      borderUpColor: "#22C55E",
      borderDownColor: "#EF4444",
      wickUpColor: "#22C55E",
      wickDownColor: "#EF4444",
    });

    chartRef.current = chart;
    seriesRef.current = series as ISeriesApi<"Candlestick">;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
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
    };
  }, []);

  // Update candle data and handle chart clicks
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current || !ohlc?.candles) return;

    const data = ohlc.candles.map((c) => ({
      time: c.time as unknown as import("lightweight-charts").Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    seriesRef.current.setData(data);

    // Subscribe to crosshair click for candle forensic selection
    const handleCrosshairMove = (param: MouseEventParams) => {
      if (!param.time || !onSelectCandle || !ohlc?.candles) return;
      const clickedTime = String(param.time);
      const matched = ohlc.candles.find((c) => String(c.time) === clickedTime);
      if (matched) {
        onSelectCandle(matched);
      }
    };

    chartRef.current.subscribeClick(handleCrosshairMove);

    return () => {
      chartRef.current?.unsubscribeClick(handleCrosshairMove);
    };
  }, [ohlc, onSelectCandle]);

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
  }, [showSR, structure]);

  // Moving Average Overlays
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // Clear previous MA series
    maSeriesRef.current.forEach((s) => {
      chart.removeSeries(s);
    });
    maSeriesRef.current = [];

    if (!ohlc?.candles || ohlc.candles.length === 0) return;

    const closes = ohlc.candles.map((c) => c.close);
    const times = ohlc.candles.map((c) => c.time as unknown as import("lightweight-charts").Time);

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
  }, [showFastMA, showSlowMA, ohlc]);

  const positive = (quote?.change_pct ?? 0) > 0;
  const negative = (quote?.change_pct ?? 0) < 0;

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden" style={{ backgroundColor: "var(--canvas)" }}>
      {/* Quote Bar — natural case, clear size jumps, crisp layout */}
      <div
        className="px-5 py-2.5 flex items-center justify-between shrink-0 select-none flex-wrap gap-2 border-b border-[var(--border-default)]"
        style={{ backgroundColor: "var(--surface)" }}
      >
        {quote ? (
          <>
            <div className="flex items-center gap-4">
              <div className="flex items-baseline gap-2">
                <span
                  className="text-lg font-bold tracking-tight text-[var(--text-primary)]"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  {quote.symbol.replace(".NS", "")}
                </span>
                <span
                  className="text-xs text-[var(--text-secondary)] hidden md:inline"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  {quote.display_name}
                </span>
              </div>

              <div style={{ height: 16, width: 1, backgroundColor: "var(--border-default)" }} />

              <div className="flex items-baseline gap-2">
                <span
                  className="text-xl font-bold text-[var(--text-primary)] tabular-nums"
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
            </div>

            {/* Quick Session Stats & Overlay Controls */}
            <div className="flex items-center gap-4 text-xs">
              <div className="hidden lg:flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                <div>
                  <span className="text-[var(--text-tertiary)] mr-1.5 font-normal">Prev</span>
                  <span className="text-[var(--text-primary)] font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
                    ₹{quote.previous_close.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-tertiary)] mr-1.5 font-normal">Range</span>
                  <span className="text-[var(--text-primary)] font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
                    ₹{quote.day_low.toFixed(1)} – ₹{quote.day_high.toFixed(1)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-tertiary)] mr-1.5 font-normal">Vol</span>
                  <span className="text-[var(--text-primary)] font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
                    {(quote.volume / 1e5).toFixed(2)}L
                  </span>
                </div>
              </div>

              {/* Overlays Toggle Buttons */}
              <div className="flex items-center gap-1.5 border-l border-[var(--border-default)] pl-3">
                <span className="text-[11px] text-[var(--text-tertiary)] mr-1 font-medium">Layers:</span>
                <button
                  onClick={() => setShowSR(!showSR)}
                  className={`px-2 py-0.5 text-xs font-semibold border rounded-sm transition-colors duration-150 ${
                    showSR
                      ? "bg-[var(--accent-subtle)] text-[var(--accent-primary)] border-[var(--accent-primary)]"
                      : "bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-default)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                  }`}
                  title="Toggle Support / Resistance level lines"
                >
                  S/R
                </button>
                <button
                  onClick={() => setShowFastMA(!showFastMA)}
                  className={`px-2 py-0.5 text-xs font-semibold border rounded-sm transition-colors duration-150 ${
                    showFastMA
                      ? "bg-[var(--accent-sec-subtle)] text-[var(--accent-secondary)] border-[var(--accent-secondary)]"
                      : "bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-default)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                  }`}
                  title="Toggle EMA 9 & EMA 20"
                >
                  EMA 9/20
                </button>
                <button
                  onClick={() => setShowSlowMA(!showSlowMA)}
                  className={`px-2 py-0.5 text-xs font-semibold border rounded-sm transition-colors duration-150 ${
                    showSlowMA
                      ? "bg-[var(--surface-elevated)] text-[var(--text-primary)] border-[var(--border-strong)]"
                      : "bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-default)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                  }`}
                  title="Toggle SMA 50 & SMA 200"
                >
                  SMA 50/200
                </button>
              </div>

              {/* Intelligence Feature Buttons */}
              <div className="flex items-center gap-1.5 border-l border-[var(--border-default)] pl-3">
                {onOpenReplay && (
                  <button
                    id="trigger-replay-btn"
                    onClick={onOpenReplay}
                    className="px-2.5 py-1 text-xs font-semibold rounded-sm bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] hover:border-[var(--accent-primary)] transition-colors duration-150"
                    title="Launch Historical Market Replay Scrubber"
                  >
                    Replay
                  </button>
                )}
                {onOpenDiff && (
                  <button
                    id="trigger-diff-btn"
                    onClick={onOpenDiff}
                    className="px-2.5 py-1 text-xs font-medium rounded-sm bg-[var(--surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors duration-150"
                    title="Inspect What Changed Diff"
                  >
                    Diff
                  </button>
                )}
                {onOpenForensics && (
                  <button
                    id="trigger-forensics-btn"
                    onClick={onOpenForensics}
                    className="px-2.5 py-1 text-xs font-medium rounded-sm bg-[var(--surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors duration-150"
                    title="Inspect Candle Forensics & Provenance"
                  >
                    Forensics
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-[var(--text-tertiary)] py-1 text-xs">
            <BarChart2 size={16} />
            <span>{loading ? "Initializing feed…" : error ?? "Select an asset"}</span>
          </div>
        )}
      </div>

      {/* Candlestick Chart Canvas — True pitch black #000000 */}
      <div className="flex-1 min-h-0 relative bg-[var(--canvas)] overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 transition-opacity duration-150">
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-sm bg-[var(--surface-elevated)] border border-[var(--border-default)] text-[var(--text-secondary)] text-xs font-medium">
              <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-ping" />
              <span>Syncing OHLC bars…</span>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
            <div className="bg-[var(--surface-elevated)] border border-[var(--border-default)] rounded-sm px-6 py-4 text-center max-w-sm">
              <p className="text-[var(--negative)] text-xs font-semibold">Market data error</p>
              <p className="text-[var(--text-secondary)] text-xs mt-1">{error}</p>
            </div>
          </div>
        )}

        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
