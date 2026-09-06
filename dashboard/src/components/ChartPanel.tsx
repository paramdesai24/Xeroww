// src/components/ChartPanel.tsx
// TradingView Lightweight Charts v5 candlestick panel with institutional terminal quote bar,
// dynamic overlay layer toggles (S/R price lines, EMA 9/20, SMA 50/200), and click subscription.

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
import { TrendingUp, TrendingDown, BarChart2, Layers } from "lucide-react";
import type { QuoteData, OHLCData, OHLCBar } from "../types/market";
import type { MarketStructureSummaryResponse, SRZone } from "../types/structure";
import config from "../config";

const CHART_COLORS = config.chart.colors;

interface ChartPanelProps {
  quote: QuoteData | null;
  ohlc: OHLCData | null;
  structure?: MarketStructureSummaryResponse | null;
  loading: boolean;
  error: string | null;
  onSelectCandle?: (candle: OHLCBar) => void;
}

export default function ChartPanel({
  quote,
  ohlc,
  structure,
  loading,
  error,
  onSelectCandle,
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
        background: { type: ColorType.Solid, color: "#000000" },
        textColor: "#737373", // Dimmer axis labels
        fontFamily: "'Inter', monospace, system-ui, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1A1A1A" }, // Polished thin #1A1A1A grid
        horzLines: { color: "#1A1A1A" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#404040", labelBackgroundColor: "#171717" },
        horzLine: { color: "#404040", labelBackgroundColor: "#171717" },
      },
      rightPriceScale: {
        borderColor: "#262626",
        textColor: "#737373",
        scaleMargins: {
          top: 0.08,
          bottom: 0.08,
        },
      },
      timeScale: {
        borderColor: "#262626",
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
      upColor: CHART_COLORS.upColor,
      downColor: CHART_COLORS.downColor,
      borderUpColor: CHART_COLORS.borderUp,
      borderDownColor: CHART_COLORS.borderDown,
      wickUpColor: CHART_COLORS.wickUp,
      wickDownColor: CHART_COLORS.wickDown,
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
    chartRef.current.timeScale().fitContent();

    // Subscribe to chart clicks to update Candle Anatomy dynamically
    const handleChartClick = (param: MouseEventParams) => {
      if (!param.time || !onSelectCandle) return;
      let dateStr = "";
      if (typeof param.time === "string") {
        dateStr = param.time;
      } else if (typeof param.time === "object" && param.time !== null) {
        const t = param.time as { year: number; month: number; day: number };
        dateStr = `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
      }
      const matchingCandle = ohlc.candles.find((c) => c.time === dateStr);
      if (matchingCandle) {
        onSelectCandle(matchingCandle);
      }
    };

    chartRef.current.subscribeClick(handleChartClick);

    return () => {
      chartRef.current?.unsubscribeClick(handleChartClick);
    };
  }, [ohlc, onSelectCandle]);

  // Support / Resistance Overlays
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    // Clear existing price lines
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
        color: "#EF444499",
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
        color: "#22C55E99",
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
      // Compute EMA9
      const ema9Series = chart.addSeries(LineSeries, {
        color: "#00E5FF",
        lineWidth: 1,
        title: "EMA 9",
      });
      // Compute EMA 9 data
      const k9 = 2 / (9 + 1);
      let ema9 = closes[0];
      const ema9Data: { time: import("lightweight-charts").Time; value: number }[] = [];
      for (let i = 0; i < closes.length; i++) {
        ema9 = i === 0 ? closes[0] : closes[i] * k9 + ema9 * (1 - k9);
        if (i >= 8) ema9Data.push({ time: times[i], value: Number(ema9.toFixed(2)) });
      }
      ema9Series.setData(ema9Data);
      maSeriesRef.current.push(ema9Series);

      // Compute EMA 20
      const ema20Series = chart.addSeries(LineSeries, {
        color: "#F59E0B",
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
          color: "#A855F7",
          lineWidth: 2,
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
          color: "#3B82F6",
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
    <div className="flex flex-col flex-1 min-w-0 bg-[#000000]">
      {/* Compact Terminal Quote Bar — high density, crisp information */}
      <div className="px-5 py-2.5 bg-[#0A0A0A] border-b border-[#262626] flex items-center justify-between shrink-0 select-none flex-wrap gap-2">
        {quote ? (
          <>
            <div className="flex items-center gap-4">
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono tracking-wider text-[#FAFAFA]">
                  {quote.symbol.replace(".NS", "")}
                </span>
                <span className="text-xs text-[#A1A1AA] hidden md:inline">
                  {quote.display_name}
                </span>
              </div>

              <div className="h-4 w-px bg-[#262626]" />

              <div className="flex items-baseline gap-2">
                <span className="text-xl font-mono font-bold text-[#FAFAFA] tabular-nums">
                  ₹{quote.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
                <span
                  className={`flex items-center gap-0.5 text-xs font-mono font-semibold tabular-nums ${
                    positive
                      ? "text-[#22C55E]"
                      : negative
                      ? "text-[#EF4444]"
                      : "text-[#A1A1AA]"
                  }`}
                >
                  {positive ? (
                    <TrendingUp size={12} className="stroke-[2.5]" />
                  ) : negative ? (
                    <TrendingDown size={12} className="stroke-[2.5]" />
                  ) : null}
                  {quote.change > 0 ? "+" : ""}
                  {quote.change.toFixed(2)} ({quote.change_pct > 0 ? "+" : ""}
                  {quote.change_pct.toFixed(2)}%)
                </span>
              </div>
            </div>

            {/* Quick Session Stats strip & Layer Controls */}
            <div className="flex items-center gap-4 text-[11px] font-mono text-[#A1A1AA]">
              <div className="hidden lg:flex items-center gap-4">
                <div>
                  <span className="text-[#737373] mr-1.5">PREV</span>
                  <span className="text-[#FAFAFA] tabular-nums">
                    ₹{quote.previous_close.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[#737373] mr-1.5">RANGE</span>
                  <span className="text-[#FAFAFA] tabular-nums">
                    ₹{quote.day_low.toFixed(1)} – ₹{quote.day_high.toFixed(1)}
                  </span>
                </div>
                <div>
                  <span className="text-[#737373] mr-1.5">VOL</span>
                  <span className="text-[#FAFAFA] tabular-nums">
                    {(quote.volume / 1e5).toFixed(2)}L
                  </span>
                </div>
              </div>

              {/* Overlays Toggle Buttons */}
              <div className="flex items-center gap-1.5 border-l border-[#262626] pl-3">
                <div className="flex items-center gap-1 text-[10px] text-[#737373] mr-1">
                  <Layers size={12} />
                  <span>LAYERS:</span>
                </div>
                <button
                  onClick={() => setShowSR(!showSR)}
                  className={`px-2 py-0.5 text-[10px] font-mono border rounded transition-colors ${
                    showSR
                      ? "bg-[#172554] text-[#60A5FA] border-[#1D4ED8]"
                      : "bg-[#111111] text-[#737373] border-[#262626] hover:text-[#FAFAFA]"
                  }`}
                  title="Toggle Support / Resistance level lines"
                >
                  S/R
                </button>
                <button
                  onClick={() => setShowFastMA(!showFastMA)}
                  className={`px-2 py-0.5 text-[10px] font-mono border rounded transition-colors ${
                    showFastMA
                      ? "bg-[#042f2e] text-[#2DD4BF] border-[#0D9488]"
                      : "bg-[#111111] text-[#737373] border-[#262626] hover:text-[#FAFAFA]"
                  }`}
                  title="Toggle EMA 9 (Cyan) & EMA 20 (Amber)"
                >
                  EMA 9/20
                </button>
                <button
                  onClick={() => setShowSlowMA(!showSlowMA)}
                  className={`px-2 py-0.5 text-[10px] font-mono border rounded transition-colors ${
                    showSlowMA
                      ? "bg-[#2e1065] text-[#C084FC] border-[#7E22CE]"
                      : "bg-[#111111] text-[#737373] border-[#262626] hover:text-[#FAFAFA]"
                  }`}
                  title="Toggle SMA 50 (Purple) & SMA 200 (Blue)"
                >
                  SMA 50/200
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-[#A1A1AA] py-0.5">
            <BarChart2 size={16} />
            <span className="text-xs font-mono">
              {loading ? "INITIALIZING FEED…" : error ?? "SELECT AN ASSET"}
            </span>
          </div>
        )}
      </div>

      {/* Candlestick Chart Canvas — enlarged viewport, pure pitch-black, #1A1A1A grid */}
      <div className="flex-1 relative bg-[#000000]">
        {/* Subtle skeleton overlay during stock switches */}
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#000000]/60 backdrop-blur-[1px] transition-opacity duration-200">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#111111] border border-[#262626] text-[#A1A1AA] text-xs font-mono">
              <div className="w-2 h-2 rounded-full bg-[#6366F1] animate-ping" />
              <span>SYNCING OHLC BARS…</span>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#000000]/80">
            <div className="bg-[#171717] border border-[#262626] rounded px-5 py-3 text-center max-w-sm">
              <p className="text-[#EF4444] text-xs font-mono font-medium">MARKET DATA ERROR</p>
              <p className="text-[#A1A1AA] text-xs font-mono mt-1">{error}</p>
            </div>
          </div>
        )}

        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
}

