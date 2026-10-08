"""Contract for feature records emitted by the Spark streaming job."""

from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

FEATURE_CONTRACT_VERSION = 1
_SHA256_PATTERN = re.compile(r"^[0-9a-fA-F]{64}$")
_BATCH_PATH_PATTERN = re.compile(r"(?:^|[\\/])batch_id=([^\\/]+)(?=[\\/]|$)")


def extract_feature_batch_id(source_file: str) -> int:
    """Extract and validate the Spark micro-batch ID from an output file path."""
    if not isinstance(source_file, str) or not source_file.strip():
        raise ValueError("source_file must be a non-empty path")
    matches = _BATCH_PATH_PATTERN.findall(source_file.strip())
    if len(matches) != 1 or not matches[0].isdigit():
        raise ValueError("source_file must contain exactly one batch_id=<non-negative integer> segment")
    return int(matches[0])


def _canonical_timestamp(value: datetime) -> str:
    return value.astimezone(UTC).isoformat(timespec="microseconds").replace("+00:00", "Z")


def _canonical_float(value: float | None) -> float | None:
    if value is None:
        return None
    return 0.0 if value == 0.0 else value


def _sha256(parts: list[Any]) -> str:
    encoded = json.dumps(parts, ensure_ascii=True, allow_nan=False, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


class MarketFeatureRecord(BaseModel):
    """One exact revision of one Spark market-feature window."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    feature_contract_version: Literal[1] = FEATURE_CONTRACT_VERSION
    window_start: datetime
    window_end: datetime
    symbol: str = Field(min_length=1)
    source: str = Field(min_length=1)
    observation_count: int = Field(ge=0)
    log_return: float
    rolling_return: float | None
    rolling_volatility: float | None
    relative_volume: float | None
    kafka_partitions: tuple[int, ...]
    max_kafka_offset: int = Field(ge=0)

    feature_batch_id: int = Field(ge=0)
    source_file: str = Field(min_length=1)
    source_file_sha256: str
    load_id: str = Field(min_length=1)

    @field_validator("window_start", "window_end", mode="before")
    @classmethod
    def validate_timestamp(cls, value: Any) -> datetime:
        if isinstance(value, str):
            try:
                value = datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError as exc:
                raise ValueError("timestamp must be valid ISO 8601") from exc
        if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("timestamp must include a timezone")
        return value.astimezone(UTC)

    @field_validator("symbol", mode="before")
    @classmethod
    def normalize_symbol(cls, value: Any) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("symbol must be a non-empty string")
        return value.strip().upper()

    @field_validator("source", mode="before")
    @classmethod
    def normalize_source(cls, value: Any) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("source must be a non-empty string")
        return value.strip().lower()

    @field_validator("source_file", "load_id", mode="before")
    @classmethod
    def validate_non_empty_metadata(cls, value: Any) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("metadata value must be a non-empty string")
        return value.strip()

    @field_validator("source_file_sha256", mode="before")
    @classmethod
    def normalize_source_hash(cls, value: Any) -> str:
        if not isinstance(value, str) or not _SHA256_PATTERN.fullmatch(value.strip()):
            raise ValueError("source_file_sha256 must be a 64-character hexadecimal SHA-256")
        return value.strip().lower()

    @field_validator("observation_count", "max_kafka_offset", "feature_batch_id", mode="before")
    @classmethod
    def validate_integer(cls, value: Any) -> int:
        if isinstance(value, bool) or not isinstance(value, int):
            raise ValueError("value must be an integer")
        return value

    @field_validator(
        "log_return",
        "rolling_return",
        "rolling_volatility",
        "relative_volume",
        mode="before",
    )
    @classmethod
    def validate_finite_number(cls, value: Any) -> float | None:
        if value is None:
            return None
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("feature value must be numeric or null")
        normalized = float(value)
        if not math.isfinite(normalized):
            raise ValueError("feature value must be finite")
        return _canonical_float(normalized)

    @field_validator("kafka_partitions", mode="before")
    @classmethod
    def normalize_partitions(cls, value: Any) -> tuple[int, ...]:
        if not isinstance(value, list) or not value:
            raise ValueError("kafka_partitions must be a non-empty array")
        if any(isinstance(item, bool) or not isinstance(item, int) or item < 0 for item in value):
            raise ValueError("kafka_partitions must contain non-negative integers")
        if len(set(value)) != len(value):
            raise ValueError("kafka_partitions must not contain duplicates")
        return tuple(sorted(value))

    @model_validator(mode="after")
    def validate_window_and_batch_path(self) -> MarketFeatureRecord:
        if self.window_end <= self.window_start:
            raise ValueError("window_end must be later than window_start")
        path_batch_id = extract_feature_batch_id(self.source_file)
        if path_batch_id != self.feature_batch_id:
            raise ValueError("feature_batch_id must match the source_file batch_id segment")
        return self

    @property
    def logical_window_key(self) -> str:
        """Identity shared by every revision of the same logical feature window."""
        return _sha256([
            self.feature_contract_version,
            _canonical_timestamp(self.window_start),
            _canonical_timestamp(self.window_end),
            self.symbol,
            self.source,
        ])

    @property
    def record_key(self) -> str:
        """Identity of this exact normalized feature revision."""
        return _sha256([
            self.logical_window_key,
            self.observation_count,
            _canonical_float(self.log_return),
            _canonical_float(self.rolling_return),
            _canonical_float(self.rolling_volatility),
            _canonical_float(self.relative_volume),
            list(self.kafka_partitions),
            self.max_kafka_offset,
            self.feature_batch_id,
        ])

    @classmethod
    def from_spark_json(
        cls,
        record: dict[str, Any],
        *,
        source_file: str,
        source_file_sha256: str,
        load_id: str,
        feature_batch_id: int | None = None,
    ) -> MarketFeatureRecord:
        """Build the contract from one Spark JSON object plus loader metadata."""
        batch_id = extract_feature_batch_id(source_file) if feature_batch_id is None else feature_batch_id
        return cls.model_validate({
            **record,
            "feature_batch_id": batch_id,
            "source_file": source_file,
            "source_file_sha256": source_file_sha256,
            "load_id": load_id,
        })
