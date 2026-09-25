"""Assemble a partial-success market snapshot for an owned watchlist."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import math

from api.data.nifty50 import NIFTY50
from api.schemas.watchlist import WatchlistSnapshotResponse, WatchlistSnapshotRow
from api.services.market_data_service import MarketDataService
from api.services.watchlist_service import WatchlistService


_COMPANIES = {stock["symbol"]: stock["display_name"] for stock in NIFTY50}


def build_watchlist_snapshot(
    watchlists: WatchlistService,
    market: MarketDataService,
    watchlist_id: int,
) -> WatchlistSnapshotResponse:
    watchlist = watchlists.get_watchlist(watchlist_id)
    symbols = [item.symbol for item in sorted(watchlist.items, key=lambda item: item.id)]

    def read_row(symbol: str) -> WatchlistSnapshotRow:
        company_name = _COMPANIES.get(symbol, symbol)
        try:
            quote = market.get_quote(symbol)
            price = float(quote["price"])
            change = float(quote["change"])
            change_pct = float(quote["change_pct"])
            if not all(math.isfinite(value) for value in (price, change, change_pct)):
                raise ValueError("Invalid quote values")
            context = "Above previous close" if change > 0 else "Below previous close" if change < 0 else "At previous close"
            return WatchlistSnapshotRow(
                symbol=symbol,
                company_name=quote.get("display_name") or company_name,
                price=price,
                change=change,
                change_pct=change_pct,
                quote_timestamp=str(quote.get("timestamp") or "") or None,
                context=context,
                available=True,
            )
        except Exception:
            return WatchlistSnapshotRow(
                symbol=symbol,
                company_name=company_name,
                context="Quote unavailable",
                available=False,
                reason="Market data is temporarily unavailable.",
            )

    with ThreadPoolExecutor(max_workers=min(5, max(1, len(symbols)))) as executor:
        rows = list(executor.map(read_row, symbols))

    return WatchlistSnapshotResponse(
        id=watchlist.id,
        name=watchlist.name,
        is_default=watchlist.is_default,
        as_of=datetime.now(timezone.utc).isoformat(),
        data_note="Yahoo Finance delayed data. Not a live exchange feed.",
        rows=rows,
    )
