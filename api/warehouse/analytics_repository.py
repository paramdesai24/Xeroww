"""Read-only analytical market-feature queries backed by Snowflake."""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from typing import Any, Protocol

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from api.warehouse.snowflake_config import SnowflakeConfig

DEFAULT_FEATURE_QUERY_LIMIT = 500
MAX_FEATURE_QUERY_LIMIT = 5000
_WRITE_KEYWORDS = ("INSERT", "UPDATE", "DELETE", "MERGE", "CREATE", "ALTER", "DROP")


class AnalyticsRepositoryError(RuntimeError):
    """Base error for analytical repository operations."""


class InvalidAnalyticsQueryError(ValueError):
    """Raised when repository query inputs are invalid."""


class WarehouseUnavailableError(AnalyticsRepositoryError):
    """Raised when a Snowflake connection cannot be established."""


class WarehouseQueryError(AnalyticsRepositoryError):
    """Raised when Snowflake fails an otherwise valid read query."""


class MalformedWarehouseRowError(AnalyticsRepositoryError):
    """Raised when a returned row violates the analytical read contract."""


def normalize_analytics_symbol(symbol: str) -> str:
    if not isinstance(symbol, str) or not symbol.strip():
        raise InvalidAnalyticsQueryError("symbol must be a non-empty string")
    return symbol.strip().upper()


def normalize_analytics_time(value: datetime, name: str) -> datetime:
    if not isinstance(value, datetime):
        raise InvalidAnalyticsQueryError(f"{name} must be a datetime")
    if value.tzinfo is None or value.utcoffset() is None:
        raise InvalidAnalyticsQueryError(f"{name} must include a timezone")
    return value.astimezone(UTC)


def validate_analytics_time_range(
    start_time: datetime,
    end_time: datetime,
) -> tuple[datetime, datetime]:
    normalized_start = normalize_analytics_time(start_time, "start_time")
    normalized_end = normalize_analytics_time(end_time, "end_time")
    if normalized_end <= normalized_start:
        raise InvalidAnalyticsQueryError("end_time must be later than start_time")
    return normalized_start, normalized_end


def validate_feature_query_limit(limit: int) -> int:
    if isinstance(limit, bool) or not isinstance(limit, int):
        raise InvalidAnalyticsQueryError("limit must be an integer")
    if limit <= 0 or limit > MAX_FEATURE_QUERY_LIMIT:
        raise InvalidAnalyticsQueryError(
            f"limit must be between 1 and {MAX_FEATURE_QUERY_LIMIT}"
        )
    return limit


class MarketFeatureAnalyticsRow(BaseModel):
    """One persisted latest-revision analytical market-feature row."""

    model_config = ConfigDict(extra="forbid", frozen=True, allow_inf_nan=False)

    window_start: datetime
    window_end: datetime
    symbol: str
    source: str
    observation_count: int = Field(ge=0)
    log_return: float
    rolling_return: float | None
    rolling_volatility: float | None
    relative_volume: float | None
    kafka_partitions: tuple[int, ...]
    max_kafka_offset: int = Field(ge=0)
    feature_batch_id: int = Field(ge=0)
    source_file: str
    source_file_sha256: str
    load_id: str
    warehouse_ingested_at: datetime
    logical_window_key: str
    record_key: str
    feature_contract_version: int

    @field_validator("window_start", "window_end", mode="before")
    @classmethod
    def normalize_ntz_timestamp(cls, value: Any) -> datetime:
        if not isinstance(value, datetime):
            raise TypeError("warehouse window timestamp must be a datetime")
        if value.tzinfo is None or value.utcoffset() is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

    @field_validator("warehouse_ingested_at", mode="before")
    @classmethod
    def normalize_ingested_timestamp(cls, value: Any) -> datetime:
        if not isinstance(value, datetime):
            raise TypeError("warehouse ingestion timestamp must be a datetime")
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("warehouse ingestion timestamp must include a timezone")
        return value.astimezone(UTC)

    @field_validator("kafka_partitions", mode="before")
    @classmethod
    def normalize_partitions(cls, value: Any) -> tuple[int, ...]:
        if not isinstance(value, (list, tuple)):
            raise TypeError("kafka_partitions must be an array")
        return tuple(value)


class WarehouseQueryClient(Protocol):
    """Minimal injected query capability used by the repository."""

    def fetch_all(
        self,
        sql: str,
        parameters: tuple[Any, ...],
    ) -> Sequence[Mapping[str, Any]]: ...


class ConnectorWarehouseQueryClient:
    """Lazy Snowflake connector client restricted to SELECT statements."""

    def __init__(self, config: SnowflakeConfig) -> None:
        self.config = config

    def fetch_all(
        self,
        sql: str,
        parameters: tuple[Any, ...],
    ) -> Sequence[Mapping[str, Any]]:
        self._validate_read_only(sql)
        try:
            import snowflake.connector
        except ImportError as exc:
            raise WarehouseUnavailableError(
                "Snowflake connector is unavailable"
            ) from exc

        try:
            connection = snowflake.connector.connect(
                **self.config.connection_parameters()
            )
        except Exception as exc:  # noqa: BLE001
            raise WarehouseUnavailableError(
                f"Snowflake is unavailable: {type(exc).__name__}"
            ) from None

        cursor = None
        try:
            cursor = connection.cursor(snowflake.connector.DictCursor)
            cursor.execute(sql, parameters)
            return tuple(cursor.fetchall())
        except Exception as exc:  # noqa: BLE001
            raise WarehouseQueryError(
                f"Snowflake analytical query failed: {type(exc).__name__}"
            ) from None
        finally:
            if cursor is not None:
                cursor.close()
            connection.close()

    @staticmethod
    def _validate_read_only(sql: str) -> None:
        normalized = " ".join(sql.upper().split())
        write_pattern = rf"\b(?:{'|'.join(_WRITE_KEYWORDS)})\b"
        if not normalized.startswith("SELECT ") or re.search(write_pattern, normalized):
            raise WarehouseQueryError("Warehouse query client accepts SELECT only")


class MarketFeatureAnalyticsRepository:
    """Bounded read access to deterministic latest market features."""

    def __init__(
        self,
        config: SnowflakeConfig,
        query_client: WarehouseQueryClient | None = None,
    ) -> None:
        _ = config.feature_view_sql
        self.config = config
        self.query_client = query_client or ConnectorWarehouseQueryClient(config)

    def latest_for_symbol(
        self,
        symbol: str,
        start_time: datetime,
        end_time: datetime,
        *,
        limit: int = DEFAULT_FEATURE_QUERY_LIMIT,
    ) -> tuple[MarketFeatureAnalyticsRow, ...]:
        normalized_symbol = normalize_analytics_symbol(symbol)
        normalized_start, normalized_end = validate_analytics_time_range(
            start_time,
            end_time,
        )
        normalized_limit = validate_feature_query_limit(limit)

        sql = f"""
            SELECT
                window_start, window_end, symbol, source, observation_count,
                log_return, rolling_return, rolling_volatility, relative_volume,
                kafka_partitions, max_kafka_offset, feature_batch_id, source_file,
                source_file_sha256, load_id, warehouse_ingested_at,
                logical_window_key, record_key, feature_contract_version
            FROM {self.config.feature_view_sql}
            WHERE symbol = %s
              AND window_start >= %s
              AND window_start < %s
            ORDER BY window_start ASC, window_end ASC, record_key ASC
            LIMIT %s
        """
        rows = self.query_client.fetch_all(
            sql,
            (
                normalized_symbol,
                normalized_start.replace(tzinfo=None),
                normalized_end.replace(tzinfo=None),
                normalized_limit,
            ),
        )
        return tuple(self._map_row(row) for row in rows)

    @staticmethod
    def _map_row(row: Mapping[str, Any]) -> MarketFeatureAnalyticsRow:
        normalized = {str(key).lower(): value for key, value in row.items()}
        try:
            return MarketFeatureAnalyticsRow.model_validate(normalized)
        except ValidationError as exc:
            raise MalformedWarehouseRowError(
                "Snowflake returned a malformed analytical feature row"
            ) from exc
