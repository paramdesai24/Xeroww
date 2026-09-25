import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../../api/client";
import { normalizeError, type AppError } from "../../../api/errors";
import type { Watchlist, WatchlistSnapshot } from "../../../types/platform";

type Mutation = "create" | "rename" | "delete" | "add" | "remove" | null;

export function useWatchlistWorkspace() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<WatchlistSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mutation, setMutation] = useState<Mutation>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const requestId = useRef(0);
  const activeRef = useRef<number | null>(null);

  const readSnapshot = useCallback(async (id: number, retain = true) => {
    const currentRequest = ++requestId.current;
    if (retain) setRefreshing(true);
    else setSnapshot(null);
    setError(null);
    try {
      const next = await api.watchlists.snapshot(id);
      if (currentRequest === requestId.current && activeRef.current === id) setSnapshot(next);
    } catch (reason) {
      if (currentRequest === requestId.current) setError(normalizeError(reason, "Watchlist could not load."));
    } finally {
      if (currentRequest === requestId.current) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, []);

  const readLists = useCallback(async (preferredId?: number | null) => {
    try {
      const lists = await api.watchlists.list();
      setWatchlists(lists);
      const selected = preferredId && lists.some((list) => list.id === preferredId)
        ? preferredId
        : activeRef.current && lists.some((list) => list.id === activeRef.current)
          ? activeRef.current
          : lists[0]?.id ?? null;
      if (selected !== activeRef.current) {
        activeRef.current = selected;
        setActiveId(selected);
      } else if (selected !== null) {
        await readSnapshot(selected);
      } else {
        setSnapshot(null);
        setLoading(false);
      }
    } catch (reason) {
      setError(normalizeError(reason, "Watchlists could not load."));
      setLoading(false);
    }
  }, [readSnapshot]);

  useEffect(() => { queueMicrotask(() => void readLists()); }, [readLists]);
  useEffect(() => {
    if (activeId !== null) queueMicrotask(() => void readSnapshot(activeId, false));
  }, [activeId, readSnapshot]);

  const select = (id: number) => {
    if (id === activeRef.current) return;
    activeRef.current = id;
    setActiveId(id);
    setSuccess(null);
  };

  const run = async (kind: Exclude<Mutation, null>, action: () => Promise<unknown>, message: string, preferredId?: number) => {
    setMutation(kind);
    setError(null);
    try {
      await action();
      setSuccess(message);
      await readLists(preferredId);
      return true;
    } catch (reason) {
      setError(normalizeError(reason, "The change could not be saved."));
      return false;
    } finally {
      setMutation(null);
    }
  };

  const create = async (name: string) => {
    setMutation("create");
    setError(null);
    try {
      const created = await api.watchlists.create(name);
      setSuccess("Watchlist created.");
      await readLists(created.id);
      return true;
    } catch (reason) {
      setError(normalizeError(reason, "Watchlist could not be created."));
      return false;
    } finally {
      setMutation(null);
    }
  };

  return {
    watchlists, activeId, active: watchlists.find((list) => list.id === activeId) ?? null,
    snapshot, loading, refreshing, mutation, error, success, select,
    refresh: () => activeRef.current === null ? readLists() : readSnapshot(activeRef.current),
    create,
    rename: (name: string) => activeId === null ? Promise.resolve(false) : run("rename", () => api.watchlists.rename(activeId, name), "Watchlist renamed."),
    removeList: () => activeId === null ? Promise.resolve(false) : run("delete", () => api.watchlists.delete(activeId), "Watchlist deleted."),
    addSymbol: (symbol: string) => activeId === null ? Promise.resolve(false) : run("add", () => api.watchlists.addSymbol(activeId, symbol), `${symbol} added.`),
    removeSymbol: (symbol: string) => activeId === null ? Promise.resolve(false) : run("remove", () => api.watchlists.removeSymbol(activeId, symbol), `${symbol} removed.`),
    clearError: () => setError(null), clearSuccess: () => setSuccess(null),
  };
}
