// src/components/OHLCTable.tsx
// Compact terminal table displaying the 10 most recent OHLC daily sessions below the chart.

import type { OHLCBar } from "../types/market";

interface OHLCTableProps {
  candles: OHLCBar[] | undefined;
  selectedDate?: string | null;
  onSelectCandle?: (candle: OHLCBar) => void;
}

export default function OHLCTable({
  candles,
  selectedDate,
  onSelectCandle,
}: OHLCTableProps) {
  if (!candles || candles.length === 0) {
    return null;
  }

  // Most recent 10 candles, newest first
  const recent10 = candles.slice(-10).reverse();

  return (
    <div className="bg-[#0A0A0A] border-t border-[#262626] flex flex-col shrink-0 max-h-44 overflow-hidden select-none font-mono">
      {/* Header strip */}
      <div className="px-4 py-1.5 bg-[#0A0A0A] border-b border-[#262626] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#A1A1AA]">
            Recent Session History
          </span>
          <span className="text-[9px] text-[#737373]">
            (Last 10 Days · Click row for Candle Anatomy)
          </span>
        </div>
        <span className="text-[9px] text-[#737373]">
          NSE REGULAR TRADING
        </span>
      </div>

      {/* Table container with sticky header */}
      <div className="overflow-y-auto overflow-x-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-[#0A0A0A] border-b border-[#262626] text-[10px] uppercase tracking-wider text-[#737373] z-10">
            <tr>
              <th className="py-1 px-4 font-semibold">Date</th>
              <th className="py-1 px-3 text-right font-semibold">Open</th>
              <th className="py-1 px-3 text-right font-semibold">High</th>
              <th className="py-1 px-3 text-right font-semibold">Low</th>
              <th className="py-1 px-4 text-right font-semibold">Close</th>
              <th className="py-1 px-4 text-right font-semibold">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#171717]">
            {recent10.map((c) => {
              const isBullish = c.close >= c.open;
              const isSelected = selectedDate === c.time;
              const change = c.close - c.open;
              const changePct = c.open > 0 ? (change / c.open) * 100 : 0;

              return (
                <tr
                  key={c.time}
                  onClick={() => onSelectCandle && onSelectCandle(c)}
                  className={`h-7 cursor-pointer transition-colors duration-150 ${
                    isSelected
                      ? "bg-[#171717] text-[#FAFAFA]"
                      : "hover:bg-[#111111]/80 text-[#A1A1AA]"
                  }`}
                >
                  <td className="py-1 px-4 text-slate-300 font-medium whitespace-nowrap">
                    {c.time}
                  </td>
                  <td className="py-1 px-3 text-right tabular-nums text-[#FAFAFA]">
                    ₹{c.open.toFixed(2)}
                  </td>
                  <td className="py-1 px-3 text-right tabular-nums text-[#FAFAFA]">
                    ₹{c.high.toFixed(2)}
                  </td>
                  <td className="py-1 px-3 text-right tabular-nums text-[#FAFAFA]">
                    ₹{c.low.toFixed(2)}
                  </td>
                  <td
                    className={`py-1 px-4 text-right tabular-nums font-semibold ${
                      isBullish ? "text-[#22C55E]" : "text-[#EF4444]"
                    }`}
                  >
                    ₹{c.close.toFixed(2)}
                  </td>
                  <td
                    className={`py-1 px-4 text-right tabular-nums text-[11px] font-medium ${
                      isBullish ? "text-[#22C55E]" : "text-[#EF4444]"
                    }`}
                  >
                    {change >= 0 ? "+" : ""}
                    {changePct.toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
