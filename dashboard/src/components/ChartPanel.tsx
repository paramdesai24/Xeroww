// src/components/ChartPanel.tsx
// TradingView Lightweight Charts v5 candlestick panel with quote header.

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { TrendingUp, TrendingDown, BarChart2 } from "lucide-react";
import type { QuoteData, OHLCData } from "../types/market";
import config from "../config";

// Color palette from central config (dashboard/src/config.ts)
const CHART_COLORS = config.chart.colors;

interface ChartPanelProps {
  quote: QuoteData | null;
  ohlc: OHLCData | null;
  loading: boolean;
  error: string | null;
}

export default function ChartPanel({ quote, ohlc, loading, error }: ChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // Use 'unknown' for the series type to avoid version-specific type mismatches
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Initialize chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: CHART_COLORS.background },
        textColor: CHART_COLORS.text,
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: CHART_COLORS.gridLines },
        horzLines: { color: CHART_COLORS.gridLines },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: CHART_COLORS.crosshair, labelBackgroundColor: "#1e293b" },
        horzLine: { color: CHART_COLORS.crosshair, labelBackgroundColor: "#1e293b" },
      },
      rightPriceScale: {
        borderColor: "#1c2333",
        textColor: CHART_COLORS.text,
      },
      timeScale: {
        borderColor: "#1c2333",
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    // Lightweight Charts v5 API: addSeries(SeriesType, options)
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

    // Resize observer
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

  // Update candle data when ohlc changes
  useEffect(() => {
    if (!seriesRef.current || !ohlc?.candles) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = ohlc.candles.map((c) => ({
      time: c.time as unknown as import("lightweight-charts").Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [ohlc]);

  const positive = (quote?.change_pct ?? 0) > 0;
  const negative = (quote?.change_pct ?? 0) < 0;

  return (
    <div className="flex flex-col flex-1 min-w-0 bg-[#0D1117]">
      {/* Quote header */}
      <div className="px-6 py-4 border-b border-slate-800 flex items-start justify-between">
        {quote ? (
          <>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  {quote.symbol.replace(".NS", "")}
                </h1>
                <span className="text-slate-500 text-sm">{quote.display_name}</span>
              </div>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-3xl font-bold text-white">
                  ₹{quote.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
                <span
                  className={`flex items-center gap-1 text-base font-semibold ${
                    positive ? "text-emerald-400" : negative ? "text-red-400" : "text-slate-400"
                  }`}
                >
                  {positive ? <TrendingUp size={16} /> : negative ? <TrendingDown size={16} /> : null}
                  {quote.change > 0 ? "+" : ""}
                  {quote.change.toFixed(2)} ({quote.change_pct > 0 ? "+" : ""}
                  {quote.change_pct.toFixed(2)}%)
                </span>
              </div>
            </div>
            <div className="text-right text-xs text-slate-500 mt-1">
              <p>Prev Close: ₹{quote.previous_close.toLocaleString("en-IN")}</p>
              <p>Vol: {quote.volume.toLocaleString("en-IN")}</p>
              {quote.market_cap && (
                <p>MCap: ₹{(quote.market_cap / 1e12).toFixed(2)}T</p>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-slate-500">
            <BarChart2 size={18} />
            <span className="text-sm">{loading ? "Loading quote…" : error ?? "Select a stock"}</span>
          </div>
        )}
      </div>

      {/* Chart area */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0D1117]/80">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-400 text-sm">Loading market data…</span>
            </div>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-6 py-4 text-center">
              <p className="text-red-400 font-medium">Failed to load chart data</p>
              <p className="text-slate-500 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
