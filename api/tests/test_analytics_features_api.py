from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from api.main import app
from api.routes.analytics_features import (
    get_analytical_features,
    get_market_feature_analytics_repository,
)
from api.warehouse.analytics_repository import (
    DEFAULT_FEATURE_QUERY_LIMIT,
    MalformedWarehouseRowError,
    MarketFeatureAnalyticsRow,
    WarehouseQueryError,
    WarehouseUnavailableError,
)


def _record() -> MarketFeatureAnalyticsRow:
    return MarketFeatureAnalyticsRow(
        record_key="c" * 64,
        logical_window_key="b" * 64,
        feature_contract_version=1,
        window_start=datetime(2026, 9, 29, 3, 30, tzinfo=UTC),
        window_end=datetime(2026, 9, 29, 3, 35, tzinfo=UTC),
        symbol="AAPL",
        source="yahoo",
        observation_count=5,
        log_return=0.001248,
        rolling_return=None,
        rolling_volatility=None,
        relative_volume=None,
        kafka_partitions=(0, 1),
        max_kafka_offset=874,
        feature_batch_id=87,
        source_file="/opt/spark/output/features/batch_id=87/part-00000.json",
        source_file_sha256="a" * 64,
        load_id="load-batch-87",
        warehouse_ingested_at=datetime(2026, 9, 29, 4, 0, tzinfo=UTC),
    )


@dataclass
class FakeAnalyticsRepository:
    records: tuple[MarketFeatureAnalyticsRow, ...] = ()
    error: Exception | None = None
    calls: list[tuple[str, datetime, datetime, int]] = field(default_factory=list)

    def latest_for_symbol(
        self,
        symbol: str,
        start_time: datetime,
        end_time: datetime,
        *,
        limit: int,
    ) -> tuple[MarketFeatureAnalyticsRow, ...]:
        self.calls.append((symbol, start_time, end_time, limit))
        if self.error is not None:
            raise self.error
        return self.records


def _call(
    repository: FakeAnalyticsRepository,
    *,
    symbol: str = "aapl",
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    limit: int = DEFAULT_FEATURE_QUERY_LIMIT,
):
    offset = timezone(timedelta(hours=5, minutes=30))
    return get_analytical_features(
        symbol=symbol,
        start_time=start_time or datetime(2026, 9, 29, 9, 0, tzinfo=offset),
        end_time=end_time or datetime(2026, 9, 29, 10, 0, tzinfo=offset),
        repository=repository,
        limit=limit,
    )


def test_valid_request_normalizes_inputs_and_preserves_response() -> None:
    repository = FakeAnalyticsRepository(records=(_record(),))
    response = _call(repository, limit=25)

    assert repository.calls == [
        (
            "AAPL",
            datetime(2026, 9, 29, 3, 30, tzinfo=UTC),
            datetime(2026, 9, 29, 4, 30, tzinfo=UTC),
            25,
        )
    ]
    assert response.symbol == "AAPL"
    assert response.start_time == datetime(2026, 9, 29, 3, 30, tzinfo=UTC)
    assert response.end_time == datetime(2026, 9, 29, 4, 30, tzinfo=UTC)
    assert response.count == 1
    record = response.data[0]
    assert record.record_key == "c" * 64
    assert record.logical_window_key == "b" * 64
    assert record.feature_contract_version == 1
    assert record.rolling_return is None
    assert record.rolling_volatility is None
    assert record.relative_volume is None
    assert record.kafka_partitions == (0, 1)
    assert record.max_kafka_offset == 874
    assert record.feature_batch_id == 87
    assert record.source_file_sha256 == "a" * 64
    assert record.load_id == "load-batch-87"


def test_default_and_explicit_limits_are_forwarded() -> None:
    repository = FakeAnalyticsRepository()
    _call(repository)
    _call(repository, limit=5000)
    assert repository.calls[0][3] == DEFAULT_FEATURE_QUERY_LIMIT
    assert repository.calls[1][3] == 5000


@pytest.mark.parametrize("limit", [0, -1, 5001])
def test_invalid_limit_is_rejected_before_repository(limit: int) -> None:
    repository = FakeAnalyticsRepository()
    with pytest.raises(HTTPException) as error:
        _call(repository, limit=limit)
    assert error.value.status_code == 422
    assert repository.calls == []


def test_missing_times_and_limit_bounds_exist_in_fastapi_contract() -> None:
    operation = app.openapi()["paths"]["/analytics/features/{symbol}"]["get"]
    parameters = {parameter["name"]: parameter for parameter in operation["parameters"]}
    assert parameters["start_time"]["required"] is True
    assert parameters["end_time"]["required"] is True
    assert parameters["limit"]["schema"]["minimum"] == 1
    assert parameters["limit"]["schema"]["maximum"] == 5000
    assert parameters["limit"]["schema"]["default"] == DEFAULT_FEATURE_QUERY_LIMIT


def test_naive_time_is_rejected_before_repository() -> None:
    repository = FakeAnalyticsRepository()
    naive_time = datetime(2026, 9, 29, 3, 30, tzinfo=UTC).replace(tzinfo=None)
    with pytest.raises(HTTPException) as error:
        _call(repository, start_time=naive_time)
    assert error.value.status_code == 422
    assert repository.calls == []


def test_non_increasing_time_range_is_rejected() -> None:
    repository = FakeAnalyticsRepository()
    instant = datetime(2026, 9, 29, 4, 30, tzinfo=UTC)
    with pytest.raises(HTTPException) as error:
        _call(repository, start_time=instant, end_time=instant)
    assert error.value.status_code == 422
    assert repository.calls == []


def test_blank_symbol_is_rejected_before_repository() -> None:
    repository = FakeAnalyticsRepository()
    with pytest.raises(HTTPException) as error:
        _call(repository, symbol=" ")
    assert error.value.status_code == 422
    assert repository.calls == []


def test_empty_result_is_successful() -> None:
    response = _call(FakeAnalyticsRepository())
    assert response.count == 0
    assert response.data == ()


@pytest.mark.parametrize(
    ("error", "expected_status"),
    [
        (WarehouseUnavailableError("secret connector detail"), 503),
        (WarehouseQueryError("secret query detail"), 502),
        (MalformedWarehouseRowError("bad row"), 502),
    ],
)
def test_repository_errors_are_safely_mapped(
    error: Exception,
    expected_status: int,
) -> None:
    with pytest.raises(HTTPException) as response_error:
        _call(FakeAnalyticsRepository(error=error))
    assert response_error.value.status_code == expected_status
    assert "secret" not in str(response_error.value.detail)
    assert "bad row" not in str(response_error.value.detail)


def test_route_is_registered_without_opening_snowflake() -> None:
    paths = {route.path for route in app.routes}
    assert "/analytics/features/{symbol}" in paths


def test_missing_warehouse_configuration_maps_to_503(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("SNOWFLAKE_DATABASE", raising=False)
    with pytest.raises(HTTPException) as error:
        get_market_feature_analytics_repository()
    assert error.value.status_code == 503
