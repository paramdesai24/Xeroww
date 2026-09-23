import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../../api/client";
import { normalizeError, type AppError } from "../../../api/errors";
import type { Portfolio, PortfolioSummary, Transaction } from "../../../types/platform";
import type { PortfolioContributionResponse } from "../../../types/structure";

type TradeInput = {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  limitPrice?: number;
};

export function usePortfolioWorkspace() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [active, setActive] = useState<PortfolioSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [contribution, setContribution] = useState<PortfolioContributionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mutation, setMutation] = useState<string | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const selectionVersion = useRef(0);

  const loadPortfolio = useCallback(async (id: number, background = false) => {
    const version = ++selectionVersion.current;
    if (background) setRefreshing(true);
    setError(null);
    try {
      const [summary, activity] = await Promise.all([
        api.portfolios.get(id),
        api.portfolios.transactions(id),
      ]);
      if (version !== selectionVersion.current) return;
      setActive(summary);
      setTransactions(activity);
      setContribution(null);
    } catch (reason) {
      if (version === selectionVersion.current) setError(normalizeError(reason, "Portfolio failed to load."));
    } finally {
      if (version === selectionVersion.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.portfolios.list();
      setPortfolios(list);
      if (list.length === 0) {
        setActive(null);
        setTransactions([]);
        setLoading(false);
        return;
      }
      const nextId = list.some((item) => item.id === active?.id) ? active.id : list[0].id;
      await loadPortfolio(nextId);
    } catch (reason) {
      setError(normalizeError(reason, "Portfolios failed to load."));
      setLoading(false);
    }
  }, [active, loadPortfolio]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async () => {
    if (active) await loadPortfolio(active.id, true);
    else await load();
  }, [active, load, loadPortfolio]);

  const loadContribution = useCallback(async () => {
    if (!active || contribution) return;
    try {
      setContribution(await api.portfolioContributions.get(active.id));
    } catch (reason) {
      setError(normalizeError(reason, "Contribution data failed to load."));
    }
  }, [active, contribution]);

  const create = useCallback(async (name: string) => {
    setMutation("create");
    setError(null);
    try {
      const created = await api.portfolios.create(name);
      setPortfolios((current) => [...current, created]);
      await loadPortfolio(created.id);
      setSuccess("Portfolio created.");
    } catch (reason) {
      setError(normalizeError(reason, "Portfolio could not be created."));
      throw reason;
    } finally {
      setMutation(null);
    }
  }, [loadPortfolio]);

  const rename = useCallback(async (name: string) => {
    if (!active) return;
    setMutation("rename");
    setError(null);
    try {
      const updated = await api.portfolios.rename(active.id, name);
      setPortfolios((current) => current.map((item) => item.id === updated.id ? updated : item));
      setActive((current) => current ? { ...current, name: updated.name } : current);
      setSuccess("Portfolio renamed.");
    } catch (reason) {
      setError(normalizeError(reason, "Portfolio could not be renamed."));
      throw reason;
    } finally {
      setMutation(null);
    }
  }, [active]);

  const trade = useCallback(async (input: TradeInput) => {
    if (!active) return;
    setMutation("trade");
    setError(null);
    try {
      await api.portfolios.trade(active.id, input.symbol, input.side, input.quantity, input.limitPrice);
      await loadPortfolio(active.id, true);
      setSuccess(`${input.side} recorded for ${input.symbol}.`);
    } catch (reason) {
      const normalized = normalizeError(reason, "Trade could not be recorded.");
      setError(normalized);
      throw normalized;
    } finally {
      setMutation(null);
    }
  }, [active, loadPortfolio]);

  return {
    portfolios,
    active,
    transactions,
    contribution,
    loading,
    refreshing,
    mutation,
    error,
    success,
    select: loadPortfolio,
    refresh,
    loadContribution,
    create,
    rename,
    trade,
    clearError: () => setError(null),
    clearSuccess: () => setSuccess(null),
  };
}
