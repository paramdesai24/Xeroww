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
    <div className="flex h-full overflow-hidden bg-[#000000] text-[#F8FAFC]">
      {/* Watchlist sidebar */}
      <div className="w-60 shrink-0 border-r border-[#1E2538] flex flex-col bg-[#05070B]">
        <div className="px-4 py-3 border-b border-[#1E2538] flex items-center justify-between">
          <span className="text-xs font-semibold text-[#94A3B8]">Watchlists</span>
          <span className="text-[11px] font-mono text-[#64748B]">{watchlists.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && watchlists.length === 0 ? (
            <div className="p-4 text-xs text-[#64748B]">Loading watchlists…</div>
          ) : (
            watchlists.map((wl) => (
              <div
                key={wl.id}
                className={`group flex items-center justify-between px-4 py-2.5 cursor-pointer border-b border-[#1E2538]/60 transition-colors ${
                  activeWl?.id === wl.id
                    ? "bg-[#10141D] border-l-2 border-l-[#F59E0B]"
                    : "hover:bg-[#0B0E14] border-l-2 border-l-transparent"
                }`}
                onClick={() => selectWatchlist(wl.id)}
              >
                <div>
                  <div className={`text-xs ${activeWl?.id === wl.id ? "text-[#F8FAFC] font-semibold" : "text-[#94A3B8]"}`}>
                    {wl.name}
                  </div>
                  <div className="text-[11px] text-[#64748B] font-mono mt-0.5">{wl.item_count ?? 0} symbols</div>
                </div>
                {!wl.is_default && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteWatchlist(wl.id); }}
                    className="opacity-0 group-hover:opacity-100 text-[#64748B] hover:text-[#EF4444] text-xs transition-all px-1"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Create new */}
        <div className="border-t border-[#1E2538] p-3 bg-[#0B0E14]">
          <div className="flex gap-1.5">
            <input
              id="new-watchlist-name"
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createWatchlist()}
              placeholder="New watchlist name"
              className="flex-1 bg-[#10141D] border border-[#1E2538] focus:border-[#3B82F6] text-[#F8FAFC] text-xs px-2.5 py-1.5 outline-none placeholder-[#64748B] transition-colors"
            />
            <button
              id="create-watchlist-btn"
              onClick={createWatchlist}
              disabled={creating}
              className="px-3 bg-[#1E2538] hover:bg-[#2A344D] text-[#F8FAFC] text-xs font-semibold disabled:opacity-40 transition-colors"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Symbol list */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#000000]">
        {error && (
          <div className="px-4 py-2 bg-[#EF4444]/10 border-b border-[#EF4444]/20 text-xs text-[#EF4444] flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-2 text-[#94A3B8] hover:text-[#F8FAFC]">×</button>
          </div>
        )}

        {activeWl ? (
          <>
            <div className="px-4 py-3 border-b border-[#1E2538] flex items-center justify-between bg-[#05070B]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#F8FAFC]">{activeWl.name}</span>
                {activeWl.is_default && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30 font-semibold uppercase">
                    Default
                  </span>
                )}
              </div>
              <span className="text-xs text-[#64748B] font-mono">
                {activeWl.items?.length ?? 0} symbols
              </span>
            </div>

            {/* Add symbol */}
            <div className="px-4 py-2.5 border-b border-[#1E2538] flex gap-2 bg-[#0B0E14]">
              <input
                id="new-symbol-input"
                type="text"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && addSymbol()}
                placeholder="e.g. RELIANCE.NS, TCS.NS"
                className="flex-1 bg-[#10141D] border border-[#1E2538] focus:border-[#3B82F6] text-[#F8FAFC] font-mono text-xs px-3 py-1.5 outline-none placeholder-[#64748B] transition-colors"
              />
              <button
                id="add-symbol-btn"
                onClick={addSymbol}
                className="text-xs px-4 py-1.5 bg-[#F59E0B] hover:bg-[#D97706] text-black font-semibold transition-colors"
              >
                Add Symbol
              </button>
            </div>

            {/* Symbol table */}
            <div className="flex-1 overflow-y-auto">
              {activeWl.items && activeWl.items.length > 0 ? (
                activeWl.items.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center justify-between px-4 py-3 border-b border-[#1E2538]/60 hover:bg-[#0B0E14] cursor-pointer transition-colors"
                    onClick={() => onSelectSymbol?.(item.symbol)}
                  >
                    <span className="text-xs text-[#F8FAFC] font-mono font-semibold">{item.symbol}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeSymbol(item.symbol); }}
                      className="opacity-0 group-hover:opacity-100 text-xs text-[#64748B] hover:text-[#EF4444] transition-all px-2 py-0.5"
                    >
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-6 text-xs text-[#64748B]">
                  No symbols in this watchlist. Add a symbol above to monitor it.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-xs text-[#64748B]">
              Select a watchlist from the left or create a new one.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
