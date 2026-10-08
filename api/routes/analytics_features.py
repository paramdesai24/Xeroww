"""Read-only HTTP boundary for historical analytical warehouse features."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from api.schemas.analytics_features import (
    AnalyticsFeatureListResponse,
    AnalyticsFeatureResponse,
)
from api.warehouse.analytics_repository import (
    DEFAULT_FEATURE_QUERY_LIMIT,
    MAX_FEATURE_QUERY_LIMIT,
    InvalidAnalyticsQueryError,
    MalformedWarehouseRowError,
    MarketFeatureAnalyticsRepository,
    WarehouseQueryError,
    WarehouseUnavailableError,
    normalize_analytics_symbol,
    validate_analytics_time_range,
    validate_feature_query_limit,
)
from api.warehouse.snowflake_config import (
    SnowflakeConfig,
    SnowflakeConfigurationError,
)

router = APIRouter(prefix="/analytics/features", tags=["Analytical Warehouse"])


def get_market_feature_analytics_repository() -> MarketFeatureAnalyticsRepository:
    try:
        return MarketFeatureAnalyticsRepository(SnowflakeConfig.from_env())
    except SnowflakeConfigurationError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The analytical warehouse is unavailable.",
        ) from None


@router.get(
    "/{symbol}",
    response_model=AnalyticsFeatureListResponse,
    summary="Get historical analytical features for a symbol",
)
def get_analytical_features(
    symbol: Annotated[str, Path(min_length=1)],
    start_time: Annotated[datetime, Query()],
    end_time: Annotated[datetime, Query()],
    repository: Annotated[
        MarketFeatureAnalyticsRepository,
        Depends(get_market_feature_analytics_repository),
    ],
    limit: Annotated[int, Query(ge=1, le=MAX_FEATURE_QUERY_LIMIT)] = (
        DEFAULT_FEATURE_QUERY_LIMIT
    ),
) -> AnalyticsFeatureListResponse:
    try:
        normalized_symbol = normalize_analytics_symbol(symbol)
        normalized_start, normalized_end = validate_analytics_time_range(
            start_time,
            end_time,
        )
        normalized_limit = validate_feature_query_limit(limit)
        records = repository.latest_for_symbol(
            normalized_symbol,
            normalized_start,
            normalized_end,
            limit=normalized_limit,
        )
    except InvalidAnalyticsQueryError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from None
    except WarehouseUnavailableError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The analytical warehouse is unavailable.",
        ) from None
    except (WarehouseQueryError, MalformedWarehouseRowError):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The analytical warehouse returned an invalid response.",
        ) from None

    return AnalyticsFeatureListResponse(
        symbol=normalized_symbol,
        start_time=normalized_start,
        end_time=normalized_end,
        count=len(records),
        data=tuple(
            AnalyticsFeatureResponse.model_validate(record) for record in records
        ),
    )
