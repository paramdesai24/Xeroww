"""
api/services/market_breadth_service.py
──────────────────────────────────────
Provider-Independent Market Breadth Engine for Xeroww V0.6.

Principle:
"For the supported universe:
  - advancing symbols, declining symbols, unchanged
  - percentage gain buckets, percentage loss buckets
  - breadth ratio
  - top gainers, top losers, most active by volume"
"""

from typing import Any
from typing import Protocol


class MarketQuoteReader(Protocol):
    def get_stocks(self) -> list[dict[str, Any]]: ...
    def get_quote(self, symbol: str) -> dict[str, Any]: ...


class MarketBreadthService:
    """Computes deterministic market breadth metrics across the tracked universe."""

    def __init__(self, market_data: MarketQuoteReader):
        self.market_data = market_data

    def compute_breadth(self) -> dict[str, Any]:
        stocks = self.market_data.get_stocks()
        quotes: list[dict[str, Any]] = []

        for s in stocks:
            try:
                q = self.market_data.get_quote(s["symbol"])
                q.setdefault("symbol", s["symbol"])
                quotes.append(q)
            except Exception:
                continue

        total = len(quotes)
        advancing = [q for q in quotes if q["change"] > 0]
        declining = [q for q in quotes if q["change"] < 0]
        unchanged = [q for q in quotes if q["change"] == 0]

        adv_count = len(advancing)
        dec_count = len(declining)
        unc_count = len(unchanged)

        breadth_ratio = round(adv_count / dec_count, 2) if dec_count > 0 else float(adv_count)

        # Gain/Loss Buckets
        gain_above_2 = len([q for q in quotes if q["change_pct"] >= 2.0])
        gain_0_to_2 = len([q for q in quotes if 0.0 < q["change_pct"] < 2.0])
        loss_0_to_2 = len([q for q in quotes if -2.0 < q["change_pct"] < 0.0])
        loss_below_2 = len([q for q in quotes if q["change_pct"] <= -2.0])

        # Leaders
        sorted_by_change = sorted(quotes, key=lambda q: q["change_pct"], reverse=True)
        top_gainers = [
            {"symbol": q["symbol"], "change_pct": q["change_pct"], "price": q["price"]}
            for q in sorted_by_change if q["change_pct"] > 0
        ][:3]
        top_losers = [
            {"symbol": q["symbol"], "change_pct": q["change_pct"], "price": q["price"]}
            for q in reversed(sorted_by_change) if q["change_pct"] < 0
        ][:3]

        sorted_by_vol = sorted(quotes, key=lambda q: q.get("volume", 0), reverse=True)
        most_active = [
            {"symbol": q["symbol"], "volume": q.get("volume", 0), "price": q["price"]}
            for q in sorted_by_vol
        ][:3]

        return {
            "universe_size": total,
            "advancing": adv_count,
            "declining": dec_count,
            "unchanged": unc_count,
            "breadth_ratio": breadth_ratio,
            "distribution_buckets": {
                "gain_gt_2pct": gain_above_2,
                "gain_0_to_2pct": gain_0_to_2,
                "loss_0_to_2pct": loss_0_to_2,
                "loss_gt_2pct": loss_below_2,
            },
            "top_gainers": top_gainers,
            "top_losers": top_losers,
            "most_active_by_volume": most_active,
        }
