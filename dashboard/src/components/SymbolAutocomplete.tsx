import { useEffect, useId, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type { StockMeta } from "../types/market";
import { searchSymbols } from "../utils/symbolSearch";

interface SymbolAutocompleteProps {
  value: string;
  onChange: (symbol: string) => void;
}

export default function SymbolAutocomplete({ value, onChange }: SymbolAutocompleteProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [stocks, setStocks] = useState<StockMeta[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const matches = useMemo(() => searchSymbols(stocks, value), [stocks, value]);

  useEffect(() => {
    api.getStocks().then(setStocks).catch(() => setStocks([]));
  }, []);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const select = (stock: StockMeta) => {
    onChange(stock.symbol);
    setOpen(false);
    setActiveIndex(0);
  };

  return (
    <div className="symbol-autocomplete" ref={rootRef}>
      <input
        required
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-activedescendant={open && matches[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value.toUpperCase());
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && matches.length) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => Math.min(current + 1, matches.length - 1));
          } else if (event.key === "ArrowUp" && matches.length) {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
          } else if (event.key === "Enter" && open && matches[activeIndex]) {
            event.preventDefault();
            select(matches[activeIndex]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Search company or ticker"
      />
      {open && value.trim() && (
        <div className="symbol-autocomplete__menu" id={listId} role="listbox">
          {matches.length ? matches.map((stock, index) => (
            <button
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? "is-active" : ""}
              id={`${listId}-${index}`}
              key={stock.symbol}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => select(stock)}
            >
              <span><strong>{stock.display_name}</strong><small>{stock.sector}</small></span>
              <code>{stock.symbol.replace(".NS", "")}</code>
            </button>
          )) : <p>No supported company matches “{value.trim()}”.</p>}
        </div>
      )}
    </div>
  );
}
