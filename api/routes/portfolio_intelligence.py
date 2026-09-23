"""Authenticated Portfolio Intelligence API."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from api.core.dependencies import get_current_user, get_market_data_service
from api.database.session import get_db
from api.models.user import User
from api.schemas.portfolio_intelligence import (
    PortfolioAnalyticsResponse,
    PortfolioImpactRequest,
    PortfolioSnapshotList,
    PortfolioSnapshotResponse,
    RiskPolicyResponse,
    RiskPolicyUpdate,
)
from api.services.market_data_service import MarketDataService
from api.services.portfolio_impact_service import PortfolioImpactService
from api.services.portfolio_intelligence_service import PortfolioIntelligenceService
from api.services.portfolio_risk_policy_service import PortfolioRiskPolicyService
from api.services.portfolio_valuation_service import PortfolioValuationService


router = APIRouter(prefix="/portfolios/{portfolio_id}", tags=["Portfolio Intelligence"])


@router.post("/snapshots", response_model=PortfolioSnapshotResponse, status_code=status.HTTP_201_CREATED)
def capture_snapshot(
    portfolio_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    return PortfolioValuationService(db, current_user.id, market_data).capture(portfolio_id)


@router.get("/snapshots", response_model=PortfolioSnapshotList)
def list_snapshots(
    portfolio_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    items, total = PortfolioValuationService(db, current_user.id, market_data).list(portfolio_id, skip, limit)
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.get("/equity-curve", response_model=PortfolioAnalyticsResponse)
@router.get("/performance", response_model=PortfolioAnalyticsResponse)
def performance(
    portfolio_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    return PortfolioIntelligenceService(db, current_user.id, market_data).performance(portfolio_id)


@router.get("/attribution", response_model=PortfolioAnalyticsResponse)
def attribution(
    portfolio_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    return PortfolioIntelligenceService(db, current_user.id, market_data).attribution(portfolio_id)


@router.get("/risk", response_model=PortfolioAnalyticsResponse)
def risk(
    portfolio_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    return PortfolioIntelligenceService(db, current_user.id, market_data).risk(portfolio_id)


@router.get("/risk-policy", response_model=RiskPolicyResponse)
def get_policy(
    portfolio_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return PortfolioRiskPolicyService(db, current_user.id).get(portfolio_id)


@router.put("/risk-policy", response_model=RiskPolicyResponse)
def update_policy(
    portfolio_id: int,
    body: RiskPolicyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return PortfolioRiskPolicyService(db, current_user.id).update(portfolio_id, body)


@router.post("/impact-preview")
def impact_preview(
    portfolio_id: int,
    body: PortfolioImpactRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    valuations = PortfolioValuationService(db, current_user.id, market_data)
    snapshot = valuations.latest(portfolio_id)
    if body.expected_snapshot_id and snapshot and snapshot.id != body.expected_snapshot_id:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=409,
            detail={"code": "PORTFOLIO_CONTEXT_CHANGED", "message": "The portfolio changed after preview."},
        )
    policy = PortfolioRiskPolicyService(db, current_user.id).get(portfolio_id)
    return PortfolioImpactService(market_data).build(
        snapshot,
        policy,
        symbol=body.symbol.strip().upper(),
        quantity=body.quantity,
        entry_price=body.entry_price,
        invalidation_price=body.invalidation_price,
    )

