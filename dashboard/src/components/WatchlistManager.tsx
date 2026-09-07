// src/components/WatchlistManager.tsx
// Multi-tenant watchlist manager — create, rename, delete, add/remove symbols.
// Graphite-and-paper design system.

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
    <div className="flex h-full overflow-hidden font-mono bg-[var(--surface-base)]">
      {/* Watchlist sidebar */}
      <div className="w-56 shrink-0 border-r border-[var(--border-subtle)] flex flex-col bg-[var(--surface-raised)]">
        <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
          <span className="text-[10px] tracking-widest text-[var(--text-tertiary)] font-bold">WATCHLISTS</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && watchlists.length === 0 ? (
            <div className="p-3 text-[10px] text-[var(--text-tertiary)] tracking-widest">LOADING…</div>
          ) : (
            watchlists.map((wl) => (
              <div
                key={wl.id}
                className={`group flex items-center justify-between px-3 py-2 cursor-pointer border-b border-[var(--border-subtle)] transition-colors ${
                  activeWl?.id === wl.id
                    ? "bg-[var(--surface-overlay)] border-l-2 border-l-[var(--accent)]"
                    : "hover:bg-[var(--surface-base)]"
                }`}
                onClick={() => selectWatchlist(wl.id)}
              >
                <div>
                  <div className={`text-xs ${activeWl?.id === wl.id ? "text-[var(--text-primary)] font-semibold" : "text-[var(--text-secondary)]"}`}>
                    {wl.name}
                  </div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">{wl.item_count ?? 0} symbols</div>
                </div>
                {!wl.is_default && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteWatchlist(wl.id); }}
                    className="opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-[var(--negative)] text-[10px] transition-all"
                  >
                    DEL
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Create new */}
        <div className="border-t border-[var(--border-subtle)] p-3 bg-[var(--surface-raised)]">
          <div className="flex gap-1">
            <input
              id="new-watchlist-name"
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createWatchlist()}
              placeholder="New watchlist"
              className="flex-1 bg-[var(--surface-overlay)] border border-[var(--border-default)] text-[var(--text-primary)] text-[10px] px-2 py-1.5 outline-none focus:border-[var(--border-strong)] placeholder-[var(--text-tertiary)]"
            />
            <button
              id="create-watchlist-btn"
              onClick={createWatchlist}
              disabled={creating}
              className="text-[10px] px-2.5 bg-[var(--surface-overlay)] border border-[var(--border-default)] hover:border-[var(--border-strong)] text-[var(--text-primary)] font-bold disabled:opacity-40 transition-colors"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Symbol list */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--surface-base)]">
        {error && (
          <div className="px-4 py-2 bg-[var(--negative-subtle)] border-b border-[var(--negative)]/20 text-[10px] text-[var(--negative)] tracking-wide flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">×</button>
          </div>
        )}

        {activeWl ? (
          <>
            <div className="px-4 py-2 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--surface-raised)]">
              <span className="text-xs text-[var(--text-primary)] tracking-wider font-bold">{activeWl.name}</span>
              {activeWl.is_default && (
                <span className="text-[10px] text-[var(--accent)] tracking-widest font-semibold">DEFAULT</span>
              )}
            </div>

            {/* Add symbol */}
            <div className="px-4 py-2 border-b border-[var(--border-subtle)] flex gap-2 bg-[var(--surface-base)]">
              <input
                id="new-symbol-input"
                type="text"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && addSymbol()}
                placeholder="SYMBOL.NS"
                className="flex-1 bg-[var(--surface-overlay)] border border-[var(--border-default)] text-[var(--text-primary)] text-[10px] px-3 py-1.5 outline-none focus:border-[var(--border-strong)] placeholder-[var(--text-tertiary)]"
              />
              <button
                id="add-symbol-btn"
                onClick={addSymbol}
                className="text-[10px] px-3 py-1.5 bg-[var(--surface-raised)] border border-[var(--border-default)] hover:border-[var(--border-strong)] text-[var(--text-primary)] font-medium transition-colors"
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
                    className="group flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-subtle)] hover:bg-[var(--surface-raised)] cursor-pointer transition-colors"
                    onClick={() => onSelectSymbol?.(item.symbol)}
                  >
                    <span className="text-xs text-[var(--text-primary)] font-semibold tracking-wider">{item.symbol}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeSymbol(item.symbol); }}
                      className="opacity-0 group-hover:opacity-100 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--negative)] transition-all"
                    >
                      REMOVE
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-4 text-[11px] text-[var(--text-tertiary)] tracking-wider">
                  NO SYMBOLS · ADD ONE ABOVE
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[11px] text-[var(--text-tertiary)] tracking-widest">
              SELECT A WATCHLIST
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
