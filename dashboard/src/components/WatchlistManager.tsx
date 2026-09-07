// src/components/WatchlistManager.tsx
// Multi-tenant watchlist manager — create, rename, delete, add/remove symbols.

import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import type { Watchlist } from "../types/platform";

interface Props {
  onSelectSymbol?: (symbol: string) => void;
}

export default function WatchlistManager({ onSelectSymbol }: Props) {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeWl, setActiveWl] = useState<Watchlist | null>(null);
  const [newListName, setNewListName] = useState("");
  const [newSymbol, setNewSymbol] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const lists = await api.watchlists.list();
      setWatchlists(lists);
      if (lists.length > 0 && !activeWl) {
        const detail = await api.watchlists.get(lists[0].id);
        setActiveWl(detail);
      } else if (activeWl) {
        const detail = await api.watchlists.get(activeWl.id);
        setActiveWl(detail);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load watchlists");
    } finally {
      setLoading(false);
    }
  }, [activeWl?.id]);

  useEffect(() => { load(); }, []);

  const selectWatchlist = async (id: number) => {
    try {
      const detail = await api.watchlists.get(id);
      setActiveWl(detail);
    } catch {}
  };

  const createWatchlist = async () => {
    if (!newListName.trim()) return;
    try {
      setCreating(true);
      await api.watchlists.create(newListName.trim());
      setNewListName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const addSymbol = async () => {
    if (!newSymbol.trim() || !activeWl) return;
    try {
      await api.watchlists.addSymbol(activeWl.id, newSymbol.trim().toUpperCase());
      setNewSymbol("");
      const detail = await api.watchlists.get(activeWl.id);
      setActiveWl(detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add symbol failed");
    }
  };

  const removeSymbol = async (symbol: string) => {
    if (!activeWl) return;
    try {
      await api.watchlists.removeSymbol(activeWl.id, symbol);
      const detail = await api.watchlists.get(activeWl.id);
      setActiveWl(detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    }
  };

  const deleteWatchlist = async (id: number) => {
    try {
      await api.watchlists.delete(id);
      if (activeWl?.id === id) setActiveWl(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="flex h-full overflow-hidden" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Watchlist sidebar */}
      <div className="w-56 shrink-0 border-r border-[var(--border-subtle)] flex flex-col">
        <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
          <span className="text-[10px] tracking-widest text-[#525252] font-bold">WATCHLISTS</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && watchlists.length === 0 ? (
            <div className="p-3 text-[10px] text-[#444] tracking-widest">LOADING...</div>
          ) : (
            watchlists.map((wl) => (
              <div
                key={wl.id}
                className={`group flex items-center justify-between px-3 py-2 cursor-pointer border-b border-[#111] ${
                  activeWl?.id === wl.id ? "bg-[#0a1015] border-l-2 border-l-[var(--accent)]" : "hover:bg-[#0d0d0d]"
                }`}
                onClick={() => selectWatchlist(wl.id)}
              >
              <div>
                <div className={`text-xs ${activeWl?.id === wl.id ? "text-[var(--text-primary)]" : "text-[#666]"}`}>
                  {wl.name}
                </div>
                <div className="text-[10px] text-[#333]">{wl.item_count ?? 0} symbols</div>
              </div>
              {!wl.is_default && (
                <button
                  onClick={(e) => { e.stopPropagation(); deleteWatchlist(wl.id); }}
                  className="opacity-0 group-hover:opacity-100 text-[#333] hover:text-[#ff4d4d] text-[10px] transition-all"
                >
                  DEL
                </button>
              )}
            </div>
          )))}
        </div>

        {/* Create new */}
        <div className="border-t border-[var(--border-subtle)] p-3">
          <div className="flex gap-1">
            <input
              id="new-watchlist-name"
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createWatchlist()}
              placeholder="New watchlist"
              className="flex-1 bg-[var(--surface-overlay)] border border-[var(--border-default)] text-[var(--text-primary)] text-[10px] px-2 py-1.5 outline-none focus:border-[var(--accent)] placeholder-[#333]"
            />
            <button
              id="create-watchlist-btn"
              onClick={createWatchlist}
              disabled={creating}
              className="text-[10px] px-2 bg-[var(--accent)] text-black font-bold disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Symbol list */}
      <div className="flex-1 flex flex-col min-w-0">
        {error && (
          <div className="px-4 py-2 bg-[#1a0a0a] border-b border-[#3a1818] text-[10px] text-[#ff4d4d] tracking-wide">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-[#666]">×</button>
          </div>
        )}

        {activeWl ? (
          <>
            <div className="px-4 py-2 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <span className="text-xs text-[var(--text-primary)] tracking-wider font-bold">{activeWl.name}</span>
              {activeWl.is_default && (
                <span className="text-[10px] text-[var(--accent)] tracking-widest">DEFAULT</span>
              )}
            </div>

            {/* Add symbol */}
            <div className="px-4 py-2 border-b border-[var(--border-subtle)] flex gap-2">
              <input
                id="new-symbol-input"
                type="text"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && addSymbol()}
                placeholder="SYMBOL.NS"
                className="flex-1 bg-[var(--surface-overlay)] border border-[var(--border-default)] text-[var(--text-primary)] text-[10px] px-3 py-1.5 outline-none focus:border-[var(--accent)] placeholder-[#333]"
              />
              <button
                id="add-symbol-btn"
                onClick={addSymbol}
                className="text-[10px] px-3 py-1.5 bg-[var(--accent)] text-black font-bold hover:bg-[#00cfea] transition-colors"
              >
                ADD
              </button>
            </div>

            {/* Symbol table */}
            <div className="flex-1 overflow-y-auto">
              {activeWl.items && activeWl.items.length > 0 ? (
                activeWl.items.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center justify-between px-4 py-2.5 border-b border-[#111] hover:bg-[#0d0d0d] cursor-pointer"
                    onClick={() => onSelectSymbol?.(item.symbol)}
                  >
                    <span className="text-xs text-[var(--text-primary)] font-bold tracking-wider">{item.symbol}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeSymbol(item.symbol); }}
                      className="opacity-0 group-hover:opacity-100 text-[10px] text-[#333] hover:text-[#ff4d4d] transition-all"
                    >
                      REMOVE
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-4 text-[11px] text-[#333] tracking-wider">
                  NO SYMBOLS · ADD ONE ABOVE
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[11px] text-[#333] tracking-widest">
              SELECT A WATCHLIST
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
