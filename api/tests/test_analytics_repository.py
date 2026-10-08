from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta, timezone
from typing import Any

import pytest

from api.warehouse.analytics_repository import (
    MAX_FEATURE_QUERY_LIMIT,
    ConnectorWarehouseQueryClient,
    InvalidAnalyticsQueryError,
    MalformedWarehouseRowError,
    MarketFeatureAnalyticsRepository,
    WarehouseQueryError,
    WarehouseUnavailableError,
)
from api.warehouse.snowflake_config import SnowflakeConfig, SnowflakeConfigurationError


def _config() -> SnowflakeConfig:
    return SnowflakeConfig(
        enabled=False,
        database="XEROWW",
        schema="ANALYTICS",
        feature_view="LATEST_MARKET_FEATURES",
    )


def _naive_utc(*args: int) -> datetime:
    return datetime(*args, tzinfo=UTC).replace(tzinfo=None)


def _row(**overrides: Any) -> dict[str, Any]:
    row: dict[str, Any] = {
        "WINDOW_START": _naive_utc(2026, 9, 29, 3, 30),
        "WINDOW_END": _naive_utc(2026, 9, 29, 3, 35),
        "SYMBOL": "AAPL",
        "SOURCE": "yahoo",
        "OBSERVATION_COUNT": 5,
        "LOG_RETURN": 0.001248,
        "ROLLING_RETURN": None,
        "ROLLING_VOLATILITY": None,
        "RELATIVE_VOLUME": None,
        "KAFKA_PARTITIONS": [0, 1],
        "MAX_KAFKA_OFFSET": 874,
        "FEATURE_BATCH_ID": 87,
        "SOURCE_FILE": "/opt/spark/output/features/batch_id=87/part-00000.json",
        "SOURCE_FILE_SHA256": "a" * 64,
        "LOAD_ID": "load-batch-87",
        "WAREHOUSE_INGESTED_AT": datetime(2026, 9, 29, 4, 0, tzinfo=UTC),
        "LOGICAL_WINDOW_KEY": "b" * 64,
        "RECORD_KEY": "c" * 64,
        "FEATURE_CONTRACT_VERSION": 1,
    }
    row.update(overrides)
    return row


@dataclass
class FakeQueryClient:
    rows: tuple[dict[str, Any], ...] = ()
    error: Exception | None = None
    calls: list[tuple[str, tuple[Any, ...]]] = field(default_factory=list)

    def fetch_all(
        self,
        sql: str,
        parameters: tuple[Any, ...],
    ) -> tuple[dict[str, Any], ...]:
        self.calls.append((sql, parameters))
        if self.error is not None:
            raise self.error
        return self.rows


def test_query_is_parameterized_bounded_and_uses_latest_view() -> None:
    client = FakeQueryClient(rows=(_row(),))
    repository = MarketFeatureAnalyticsRepository(_config(), client)
    offset = timezone(timedelta(hours=5, minutes=30))

    records = repository.latest_for_symbol(
        " aapl ",
        datetime(2026, 9, 29, 9, 0, tzinfo=offset),
        datetime(2026, 9, 29, 10, 0, tzinfo=offset),
        limit=25,
    )

    assert len(records) == 1
    sql, parameters = client.calls[0]
    assert 'FROM "XEROWW"."ANALYTICS"."LATEST_MARKET_FEATURES"' in sql
    assert "AAPL" not in sql
    assert parameters == (
        "AAPL",
        _naive_utc(2026, 9, 29, 3, 30),
        _naive_utc(2026, 9, 29, 4, 30),
        25,
    )
    assert "LIMIT %s" in sql
    assert "postgres" not in sql.lower()


def test_read_model_preserves_all_fields_and_nullable_features() -> None:
    client = FakeQueryClient(rows=(_row(),))
    repository = MarketFeatureAnalyticsRepository(_config(), client)

    record = repository.latest_for_symbol(
        "AAPL",
        datetime(2026, 9, 29, 3, 0, tzinfo=UTC),
        datetime(2026, 9, 29, 5, 0, tzinfo=UTC),
    )[0]

    assert record.window_start == datetime(2026, 9, 29, 3, 30, tzinfo=UTC)
    assert record.window_end == datetime(2026, 9, 29, 3, 35, tzinfo=UTC)
    assert record.warehouse_ingested_at == datetime(2026, 9, 29, 4, 0, tzinfo=UTC)
    assert record.symbol == "AAPL"
    assert record.source == "yahoo"
    assert record.observation_count == 5
    assert record.log_return == 0.001248
    assert record.rolling_return is None
    assert record.rolling_volatility is None
    assert record.relative_volume is None
    assert record.kafka_partitions == (0, 1)
    assert record.max_kafka_offset == 874
    assert record.feature_batch_id == 87
    assert record.source_file.endswith("part-00000.json")
    assert record.source_file_sha256 == "a" * 64
    assert record.load_id == "load-batch-87"
    assert record.logical_window_key == "b" * 64
    assert record.record_key == "c" * 64
    assert record.feature_contract_version == 1


@pytest.mark.parametrize("limit", [0, -1, MAX_FEATURE_QUERY_LIMIT + 1, True, 1.5])
def test_limit_validation_rejects_invalid_values(limit: Any) -> None:
    repository = MarketFeatureAnalyticsRepository(_config(), FakeQueryClient())
    with pytest.raises(InvalidAnalyticsQueryError, match="limit"):
        repository.latest_for_symbol(
            "AAPL",
            datetime(2026, 9, 29, 3, 0, tzinfo=UTC),
            datetime(2026, 9, 29, 4, 0, tzinfo=UTC),
            limit=limit,
        )


def test_invalid_symbol_and_time_range_are_rejected_before_query() -> None:
    client = FakeQueryClient()
    repository = MarketFeatureAnalyticsRepository(_config(), client)
    with pytest.raises(InvalidAnalyticsQueryError, match="symbol"):
        repository.latest_for_symbol(
            " ",
            datetime(2026, 9, 29, 3, 0, tzinfo=UTC),
            datetime(2026, 9, 29, 4, 0, tzinfo=UTC),
        )
    with pytest.raises(InvalidAnalyticsQueryError, match="timezone"):
        repository.latest_for_symbol(
            "AAPL",
            _naive_utc(2026, 9, 29, 3, 0),
            datetime(2026, 9, 29, 4, 0, tzinfo=UTC),
        )
    with pytest.raises(InvalidAnalyticsQueryError, match="later"):
        repository.latest_for_symbol(
            "AAPL",
            datetime(2026, 9, 29, 4, 0, tzinfo=UTC),
            datetime(2026, 9, 29, 3, 0, tzinfo=UTC),
        )
    assert client.calls == []


def test_empty_result_is_distinct_from_query_failure() -> None:
    repository = MarketFeatureAnalyticsRepository(_config(), FakeQueryClient())
    assert (
        repository.latest_for_symbol(
            "AAPL",
            datetime(2026, 9, 29, 3, 0, tzinfo=UTC),
            datetime(2026, 9, 29, 4, 0, tzinfo=UTC),
        )
        == ()
    )

    failing = MarketFeatureAnalyticsRepository(
        _config(),
        FakeQueryClient(error=WarehouseQueryError("query failed")),
    )
    with pytest.raises(WarehouseQueryError, match="query failed"):
        failing.latest_for_symbol(
            "AAPL",
            datetime(2026, 9, 29, 3, 0, tzinfo=UTC),
            datetime(2026, 9, 29, 4, 0, tzinfo=UTC),
        )


def test_unavailable_warehouse_error_is_not_swallowed() -> None:
    repository = MarketFeatureAnalyticsRepository(
        _config(),
        FakeQueryClient(error=WarehouseUnavailableError("unavailable")),
    )
    with pytest.raises(WarehouseUnavailableError, match="unavailable"):
        repository.latest_for_symbol(
            "AAPL",
            datetime(2026, 9, 29, 3, 0, tzinfo=UTC),
            datetime(2026, 9, 29, 4, 0, tzinfo=UTC),
        )


def test_malformed_row_is_rejected() -> None:
    malformed = _row()
    del malformed["RECORD_KEY"]
    repository = MarketFeatureAnalyticsRepository(
        _config(), FakeQueryClient(rows=(malformed,))
    )
    with pytest.raises(MalformedWarehouseRowError):
        repository.latest_for_symbol(
            "AAPL",
            datetime(2026, 9, 29, 3, 0, tzinfo=UTC),
            datetime(2026, 9, 29, 4, 0, tzinfo=UTC),
        )


def test_generated_sql_is_select_only() -> None:
    client = FakeQueryClient()
    repository = MarketFeatureAnalyticsRepository(_config(), client)
    repository.latest_for_symbol(
        "AAPL",
        datetime(2026, 9, 29, 3, 0, tzinfo=UTC),
        datetime(2026, 9, 29, 4, 0, tzinfo=UTC),
    )
    sql = client.calls[0][0]
    assert sql.lstrip().upper().startswith("SELECT")
    assert not re.search(
        r"\b(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP)\b", sql, re.IGNORECASE
    )


def test_connector_client_rejects_writes_before_connecting() -> None:
    client = ConnectorWarehouseQueryClient(_config())
    with pytest.raises(WarehouseQueryError, match="SELECT only"):
        client.fetch_all("DELETE FROM anything", ())


def test_repository_rejects_unsafe_view_identifier() -> None:
    config = SnowflakeConfig(
        enabled=False,
        database="XEROWW",
        schema="ANALYTICS",
        feature_view="LATEST_MARKET_FEATURES; DROP TABLE FACT_MARKET_FEATURES",
    )
    with pytest.raises(SnowflakeConfigurationError, match="identifier"):
        MarketFeatureAnalyticsRepository(config, FakeQueryClient())
