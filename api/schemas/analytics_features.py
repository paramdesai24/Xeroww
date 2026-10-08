"""HTTP response contracts for analytical warehouse features."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AnalyticsFeatureResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    record_key: str
    logical_window_key: str
    feature_contract_version: int
    window_start: datetime
    window_end: datetime
    symbol: str
    source: str
    observation_count: int
    log_return: float
    rolling_return: float | None
    rolling_volatility: float | None
    relative_volume: float | None
    kafka_partitions: tuple[int, ...]
    max_kafka_offset: int
    feature_batch_id: int
    source_file: str
    source_file_sha256: str
    load_id: str
    warehouse_ingested_at: datetime


class AnalyticsFeatureListResponse(BaseModel):
    symbol: str
    start_time: datetime
    end_time: datetime
    count: int
    data: tuple[AnalyticsFeatureResponse, ...]
