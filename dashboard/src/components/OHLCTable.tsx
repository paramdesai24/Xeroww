import { useState } from "react";
import type { OHLCBar } from "../types/market";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./ui";

interface OHLCTableProps {
  candles: OHLCBar[] | undefined;
  selectedDate?: string | null;
  onSelectCandle?: (candle: OHLCBar) => void;
}

export default function OHLCTable({ candles, selectedDate, onSelectCandle }: OHLCTableProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  if (!candles || candles.length === 0) return null;

  const recent10 = candles.slice(-10).reverse();
  const repeatedDates = new Set(recent10.map((candle) => candle.time).filter((time, index, all) => all.indexOf(time) !== index));

  return (
    <div
      className={`flex flex-col shrink-0 ${
        open ? expanded ? "max-h-84 md:max-h-96" : "max-h-48" : "max-h-12"
      } border-t border-[var(--border-default)] select-none transition-all duration-200`}
      style={{ backgroundColor: "var(--canvas)", fontFamily: "var(--font-sans)" }}
    >
      {/* Header strip */}
      <div
        className="px-4 py-2 flex items-center justify-between border-b border-[var(--border-default)] shrink-0"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <button type="button" aria-expanded={open} aria-controls="recent-sessions-content" onClick={() => setOpen((value) => !value)} className="recent-sessions-toggle">
          <span aria-hidden="true">{open ? "▾" : "▸"}</span>
          <span>Recent Sessions</span>
          <span className="recent-sessions-note">{open ? "Last 10 sessions · Click row for candle forensics" : "Show OHLC history"}</span>
        </button>
        <div className="flex items-center gap-2.5">
          {open && <button
            id="toggle-recent-sessions-btn"
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-label font-semibold text-[var(--accent-primary)] hover:text-[var(--text-primary)] transition-colors px-2 py-0.5 border border-[var(--border-default)] hover:border-[var(--border-strong)] bg-[var(--surface-inset)]"
          >
            {expanded ? "▲ Compact (4 sessions)" : "▼ Show all 10"}
          </button>}
          {open && <span className="text-label text-[var(--text-tertiary)] hidden sm:inline">NSE Daily Feed</span>}
        </div>
      </div>

      {/* Table Container */}
      <div id="recent-sessions-content" hidden={!open} className="recent-sessions-table overflow-y-auto overflow-x-auto min-h-0 flex-1">
        <Table>
          <TableHeader>
            <tr>
              <TableHead align="left">Date</TableHead>
              <TableHead align="right">Open</TableHead>
              <TableHead align="right">High</TableHead>
              <TableHead align="right">Low</TableHead>
              <TableHead align="right">Close</TableHead>
              <TableHead align="right">Change</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {recent10.map((c, index) => {
              const isBullish = c.close >= c.open;
              const isSelected = selectedDate === c.time;
              const change = c.close - c.open;
              const changePct = c.open > 0 ? (change / c.open) * 100 : 0;
              const dirColor = isBullish ? "text-[var(--positive)]" : "text-[var(--negative)]";

              return (
                <TableRow
                  key={`${c.time}-${c.chart_time ?? index}`}
                  isSelected={isSelected}
                  onClick={() => onSelectCandle && onSelectCandle(c)}
                >
                  <TableCell className="text-label text-[var(--text-secondary)]">
                    {c.time}{repeatedDates.has(c.time) && c.chart_time != null ? ` ${new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(c.chart_time * 1000))}` : ""}
                  </TableCell>
                  <TableCell numeric className="text-label">
                    ₹{c.open.toFixed(2)}
                  </TableCell>
                  <TableCell numeric className="text-label">
                    ₹{c.high.toFixed(2)}
                  </TableCell>
                  <TableCell numeric className="text-label">
                    ₹{c.low.toFixed(2)}
                  </TableCell>
                  <TableCell numeric className={`text-label font-semibold ${dirColor}`}>
                    ₹{c.close.toFixed(2)}
                  </TableCell>
                  <TableCell numeric className={`text-label font-bold ${dirColor}`}>
                    {change >= 0 ? "+" : ""}{changePct.toFixed(2)}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
