// src/components/ChartPanel.tsx
// TradingView Lightweight Charts v5 candlestick panel with institutional terminal quote bar & click subscription.

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
} from "lightweight-charts";
import { TrendingUp, TrendingDown, BarChart2 } from "lucide-react";
import type { QuoteData, OHLCData, OHLCBar } from "../types/market";
import config from "../config";

const CHART_COLORS = config.chart.colors;

interface ChartPanelProps {
  quote: QuoteData | null;
  ohlc: OHLCData | null;
  loading: boolean;
  error: string | null;
  onSelectCandle?: (candle: OHLCBar) => void;
}

export default function ChartPanel({
  quote,
  ohlc,
  loading,
  error,
  onSelectCandle,
}: ChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

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

  const positive = (quote?.change_pct ?? 0) > 0;
  const negative = (quote?.change_pct ?? 0) < 0;

  return (
    <div className="flex flex-col flex-1 min-w-0 bg-[#000000]">
      {/* Compact Terminal Quote Bar — high density, crisp information */}
      <div className="px-5 py-2.5 bg-[#0A0A0A] border-b border-[#262626] flex items-center justify-between shrink-0 select-none">
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

            {/* Quick Session Stats strip */}
            <div className="hidden lg:flex items-center gap-5 text-[11px] font-mono text-[#A1A1AA]">
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
              {quote.market_cap && (
                <div>
                  <span className="text-[#737373] mr-1.5">MCAP</span>
                  <span className="text-[#FAFAFA] tabular-nums">
                    ₹{(quote.market_cap / 1e12).toFixed(2)}T
                  </span>
                </div>
              )}
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
