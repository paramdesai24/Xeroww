"""
services/portfolio_service.py
──────────────────────────────
Portfolio domain service for Xeroww simulated (paper) trading.

Design Principles:
  - All portfolio calculations live here — NEVER in route handlers.
  - Market prices are fetched live via MarketDataProvider at valuation time.
  - Market data is NEVER stored in portfolio tables.
  - Weighted average cost (WAC) is maintained per holding on BUY.
  - Realized P&L is computed and recorded on SELL.
  - Cash balance is strictly validated before every BUY.

Future: This service can be consumed by a Kafka/Spark consumer event handler
        without any interface changes — the domain logic is isolated here.
"""

from datetime import datetime
from typing import Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from api.models.portfolio import Portfolio, Holding, PortfolioTransaction, TradeSide
from api.schemas.portfolio import (
    HoldingResponse,
    PortfolioSummaryResponse,
    TransactionResponse,
)
from api.core.config import settings


class PortfolioService:
    """Encapsulates all portfolio business logic. Injected per-request."""

    def __init__(self, db: Session, user_id: int, provider=None):
        self.db = db
        self.user_id = user_id
        self._provider = provider  # MarketDataProvider instance (injected)

    def _get_provider(self):
        if self._provider is None:
            from api.core.dependencies import get_market_data_service
            self._provider = get_market_data_service()
        return self._provider

    # -----------------------------------------------------------------------
    # Queries
    # -----------------------------------------------------------------------

    def list_portfolios(self) -> list[Portfolio]:
        return (
            self.db.query(Portfolio)
            .filter(Portfolio.user_id == self.user_id)
            .order_by(Portfolio.created_at)
            .all()
        )

    def get_portfolio(self, portfolio_id: int) -> Portfolio:
        portfolio = (
            self.db.query(Portfolio)
            .filter(Portfolio.id == portfolio_id, Portfolio.user_id == self.user_id)
            .first()
        )
        if not portfolio:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Portfolio {portfolio_id} not found.",
            )
        return portfolio

    def get_summary(self, portfolio_id: int) -> PortfolioSummaryResponse:
        """
        Build a live portfolio summary with market valuations.
        Fetches current price for each holding via MarketDataProvider.
        """
        portfolio = self.get_portfolio(portfolio_id)
        provider = self._get_provider()

        holding_responses: list[HoldingResponse] = []
        total_holdings_value = 0.0
        total_cost_basis = 0.0

        for holding in portfolio.holdings:
            current_price = None
            current_value = None
            unrealized_pnl = None
            unrealized_pnl_pct = None

            try:
                quote = provider.get_quote(holding.symbol)
                current_price = quote["price"]
                current_value = round(current_price * holding.quantity, 2)
                cost_basis = holding.average_price * holding.quantity
                unrealized_pnl = round(current_value - cost_basis, 2)
                unrealized_pnl_pct = round(
                    (unrealized_pnl / cost_basis * 100) if cost_basis > 0 else 0.0, 2
                )
                total_holdings_value += current_value
                total_cost_basis += cost_basis
            except Exception:
                # Provider failure — return partial data gracefully
                pass

            holding_responses.append(HoldingResponse(
                symbol=holding.symbol,
                quantity=holding.quantity,
                average_price=round(holding.average_price, 2),
                current_price=current_price,
                current_value=current_value,
                unrealized_pnl=unrealized_pnl,
                unrealized_pnl_pct=unrealized_pnl_pct,
                allocation_pct=None,  # Computed after full pass
            ))

        # Compute allocation percentages after all holdings are valued
        total_value = portfolio.cash_balance + total_holdings_value
        for hr in holding_responses:
            if hr.current_value is not None and total_value > 0:
                hr.allocation_pct = round(hr.current_value / total_value * 100, 2)

        total_unrealized_pnl = round(total_holdings_value - total_cost_basis, 2)
        total_unrealized_pnl_pct = round(
            (total_unrealized_pnl / total_cost_basis * 100) if total_cost_basis > 0 else 0.0, 2
        )

        return PortfolioSummaryResponse(
            id=portfolio.id,
            name=portfolio.name,
            cash_balance=round(portfolio.cash_balance, 2),
            holdings_value=round(total_holdings_value, 2),
            total_value=round(total_value, 2),
            total_unrealized_pnl=total_unrealized_pnl,
            total_unrealized_pnl_pct=total_unrealized_pnl_pct,
            holdings=holding_responses,
            created_at=portfolio.created_at,
        )

    def get_contribution_analysis(self, portfolio_id: int) -> dict[str, Any]:
        """
        Compute Today's Contribution for each holding in the portfolio:
        - Value, allocation %
        - Daily P&L contribution (₹ and % of portfolio)
        - Identifies largest contributor, largest detractor, and biggest allocation.
        Strictly factual with zero trading advice.
        """
        portfolio = self.get_portfolio(portfolio_id)
        provider = self._get_provider()

        holdings_data: list[dict[str, Any]] = []
        total_holdings_value = 0.0
        total_day_pnl = 0.0

        for holding in portfolio.holdings:
            try:
                quote = provider.get_quote(holding.symbol)
                cur_price = quote["price"]
                prev_close = quote["previous_close"] or cur_price
                price_change = round(cur_price - prev_close, 2)
                price_change_pct = round((price_change / prev_close * 100) if prev_close > 0 else 0.0, 2)
                cur_val = round(cur_price * holding.quantity, 2)
                pnl_inr = round(price_change * holding.quantity, 2)

                total_holdings_value += cur_val
                total_day_pnl += pnl_inr

                holdings_data.append({
                    "symbol": holding.symbol,
                    "quantity": holding.quantity,
                    "current_price": cur_price,
                    "previous_close": prev_close,
                    "price_change": price_change,
                    "price_change_pct": price_change_pct,
                    "current_value": cur_val,
                    "pnl_contribution_inr": pnl_inr,
                    "allocation_pct": 0.0,
                    "pnl_contribution_pct": 0.0,
                })
            except Exception:
                continue

        total_value = portfolio.cash_balance + total_holdings_value
        day_pnl_pct = round((total_day_pnl / total_value * 100) if total_value > 0 else 0.0, 2)

        for h in holdings_data:
            if total_value > 0:
                h["allocation_pct"] = round(h["current_value"] / total_value * 100, 2)
                h["pnl_contribution_pct"] = round(h["pnl_contribution_inr"] / total_value * 100, 2)

        largest_contributor = max(holdings_data, key=lambda x: x["pnl_contribution_inr"]) if holdings_data else None
        largest_detractor = min(holdings_data, key=lambda x: x["pnl_contribution_inr"]) if holdings_data else None
        biggest_alloc = max(holdings_data, key=lambda x: x["allocation_pct"]) if holdings_data else None

        return {
            "portfolio_id": portfolio.id,
            "portfolio_name": portfolio.name,
            "total_value": round(total_value, 2),
            "day_pnl_inr": round(total_day_pnl, 2),
            "day_pnl_pct": day_pnl_pct,
            "holdings": holdings_data,
            "largest_contributor": largest_contributor if largest_contributor and largest_contributor["pnl_contribution_inr"] > 0 else None,
            "largest_detractor": largest_detractor if largest_detractor and largest_detractor["pnl_contribution_inr"] < 0 else None,
            "biggest_allocation": biggest_alloc,
        }

    def list_transactions(self, portfolio_id: int) -> list[TransactionResponse]:
        portfolio = self.get_portfolio(portfolio_id)
        txns = (
            self.db.query(PortfolioTransaction)
            .filter(PortfolioTransaction.portfolio_id == portfolio.id)
            .order_by(PortfolioTransaction.timestamp.desc())
            .all()
        )
        return [TransactionResponse.model_validate(t) for t in txns]

    # -----------------------------------------------------------------------
    # Simulated Trading
    # -----------------------------------------------------------------------

    def execute_trade(
        self,
        portfolio_id: int,
        symbol: str,
        side: str,
        quantity: float,
        limit_price: float | None = None,
    ) -> TransactionResponse:
        """
        Execute a simulated (paper) trade.

        BUY: Validates cash, deducts from balance, updates WAC holding.
        SELL: Validates holding quantity, computes realized P&L, updates cash.
        """
        portfolio = self.get_portfolio(portfolio_id)
        symbol = symbol.strip().upper()
        side_enum = TradeSide(side.upper())

        # Get execution price — use live market price unless limit provided
        provider = self._get_provider()
        if limit_price is not None:
            execution_price = limit_price
        else:
            try:
                quote = provider.get_quote(symbol)
                execution_price = quote["price"]
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Failed to fetch live price for {symbol}: {e}",
                )

        if side_enum == TradeSide.BUY:
            return self._execute_buy(portfolio, symbol, quantity, execution_price)
        else:
            return self._execute_sell(portfolio, symbol, quantity, execution_price)

    def _execute_buy(
        self,
        portfolio: Portfolio,
        symbol: str,
        quantity: float,
        price: float,
    ) -> TransactionResponse:
        total_cost = round(quantity * price, 2)

        if portfolio.cash_balance < total_cost:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Insufficient cash. Required: ₹{total_cost:,.2f}. "
                    f"Available: ₹{portfolio.cash_balance:,.2f}."
                ),
            )

        # Update or create holding with weighted average cost
        holding = (
            self.db.query(Holding)
            .filter(Holding.portfolio_id == portfolio.id, Holding.symbol == symbol)
            .first()
        )
        if holding:
            total_qty = holding.quantity + quantity
            holding.average_price = (
                (holding.quantity * holding.average_price) + (quantity * price)
            ) / total_qty
            holding.quantity = total_qty
        else:
            holding = Holding(
                portfolio_id=portfolio.id,
                symbol=symbol,
                quantity=quantity,
                average_price=price,
            )
            self.db.add(holding)

        portfolio.cash_balance -= total_cost
        portfolio.updated_at = datetime.utcnow()

        txn = PortfolioTransaction(
            portfolio_id=portfolio.id,
            symbol=symbol,
            side=TradeSide.BUY,
            quantity=quantity,
            execution_price=price,
            realized_pnl=None,
            timestamp=datetime.utcnow(),
        )
        self.db.add(txn)
        self.db.commit()
        self.db.refresh(txn)

        try:
            from api.events import get_event_bus, AssetBought
            get_event_bus().publish(
                AssetBought.create(
                    portfolio_id=portfolio.id,
                    symbol=symbol,
                    quantity=quantity,
                    price=price,
                    total_cost=total_cost,
                    user_id=self.user_id,
                )
            )
        except Exception:
            pass

        return TransactionResponse.model_validate(txn)

    def _execute_sell(
        self,
        portfolio: Portfolio,
        symbol: str,
        quantity: float,
        price: float,
    ) -> TransactionResponse:
        holding = (
            self.db.query(Holding)
            .filter(Holding.portfolio_id == portfolio.id, Holding.symbol == symbol)
            .first()
        )

        if not holding:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No holding found for '{symbol}' in this portfolio.",
            )

        if holding.quantity < quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Cannot sell {quantity} units of '{symbol}'. "
                    f"Only {holding.quantity} units held."
                ),
            )

        realized_pnl = round((price - holding.average_price) * quantity, 2)
        proceeds = round(quantity * price, 2)

        holding.quantity -= quantity
        if holding.quantity <= 0:
            self.db.delete(holding)
        else:
            holding.updated_at = datetime.utcnow()

        portfolio.cash_balance += proceeds
        portfolio.updated_at = datetime.utcnow()

        txn = PortfolioTransaction(
            portfolio_id=portfolio.id,
            symbol=symbol,
            side=TradeSide.SELL,
            quantity=quantity,
            execution_price=price,
            realized_pnl=realized_pnl,
            timestamp=datetime.utcnow(),
        )
        self.db.add(txn)
        self.db.commit()
        self.db.refresh(txn)

        try:
            from api.events import get_event_bus, AssetSold
            get_event_bus().publish(
                AssetSold.create(
                    portfolio_id=portfolio.id,
                    symbol=symbol,
                    quantity=quantity,
                    price=price,
                    proceeds=proceeds,
                    realized_pnl=realized_pnl,
                    user_id=self.user_id,
                )
            )
        except Exception:
            pass

        return TransactionResponse.model_validate(txn)

    # -----------------------------------------------------------------------
    # Factory
    # -----------------------------------------------------------------------

    @classmethod
    def create(cls, portfolio_id_for_user: int, name: str, db: Session, user_id: int) -> Portfolio:
        """Create a new simulated portfolio with default cash balance."""
        portfolio = Portfolio(
            user_id=user_id,
            name=name.strip(),
            cash_balance=settings.DEFAULT_PORTFOLIO_CASH,
        )
        db.add(portfolio)
        db.commit()
        db.refresh(portfolio)

        try:
            from api.events import get_event_bus, PortfolioCreated
            get_event_bus().publish(
                PortfolioCreated.create(
                    portfolio_id=portfolio.id,
                    name=portfolio.name,
                    user_id=user_id,
                    initial_cash=portfolio.cash_balance,
                )
            )
        except Exception:
            pass

        return portfolio

