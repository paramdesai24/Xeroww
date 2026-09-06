"""
routes/portfolios.py
─────────────────────
Portfolio API endpoints — simulated paper trading, all tenant-scoped.

Market prices are fetched live via MarketDataProvider on /summary and /trade.
No market data is persisted in portfolio tables.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from api.database.session import get_db
from api.core.dependencies import get_current_user
from api.models.user import User
from api.services.portfolio_service import PortfolioService
from api.schemas.portfolio import (
    PortfolioCreate,
    PortfolioResponse,
    PortfolioSummaryResponse,
    TradeOrderRequest,
    TransactionResponse,
)

router = APIRouter(prefix="/portfolios", tags=["Portfolios"])


@router.get("", response_model=list[PortfolioResponse], summary="List portfolios for current user")
def list_portfolios(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = PortfolioService(db, current_user.id)
    return svc.list_portfolios()


@router.post(
    "",
    response_model=PortfolioResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new simulated portfolio",
)
def create_portfolio(
    body: PortfolioCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    portfolio = PortfolioService.create(0, body.name, db, current_user.id)
    return portfolio


@router.get(
    "/{portfolio_id}",
    response_model=PortfolioSummaryResponse,
    summary="Get portfolio summary with live valuations",
)
def get_portfolio(
    portfolio_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = PortfolioService(db, current_user.id)
    return svc.get_summary(portfolio_id)


@router.post(
    "/{portfolio_id}/trade",
    response_model=TransactionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Execute a simulated BUY or SELL trade",
)
def execute_trade(
    portfolio_id: int,
    body: TradeOrderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = PortfolioService(db, current_user.id)
    return svc.execute_trade(
        portfolio_id=portfolio_id,
        symbol=body.symbol,
        side=body.side,
        quantity=body.quantity,
        limit_price=body.limit_price,
    )


@router.get(
    "/{portfolio_id}/transactions",
    response_model=list[TransactionResponse],
    summary="Get transaction history for a portfolio",
)
def get_transactions(
    portfolio_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = PortfolioService(db, current_user.id)
    return svc.list_transactions(portfolio_id)


@router.get(
    "/{portfolio_id}/contributions",
    summary="Get Today's Contribution and Holding Diff Analytics",
)
def get_contributions(
    portfolio_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = PortfolioService(db, current_user.id)
    return svc.get_contribution_analysis(portfolio_id)

