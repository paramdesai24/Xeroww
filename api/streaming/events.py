"""Versioned canonical market-data event envelope and JSON boundary."""

import json
from datetime import date, datetime, time, timezone
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from api.services.market_provider import CandleRecord, InstrumentRecord, QuoteRecord


SCHEMA_VERSION = 1


class EventValidationError(ValueError):
    """Raised when a Kafka value does not satisfy the market-data event contract."""


class EventType(str, Enum):
    INSTRUMENT = "instrument"
    QUOTE = "quote"
    CANDLE = "candle"


Payload = InstrumentRecord | QuoteRecord | CandleRecord

_REQUIRED_PAYLOAD_FIELDS: dict[EventType, frozenset[str]] = {
    EventType.INSTRUMENT: frozenset({"symbol", "display_name", "exchange", "sector"}),
    EventType.QUOTE: frozenset({
        "symbol", "display_name", "price", "previous_close", "change", "change_pct",
        "day_high", "day_low", "volume", "market_cap", "currency", "data_note", "timestamp",
    }),
    EventType.CANDLE: frozenset({"time", "open", "high", "low", "close", "volume"}),
}


def _utc_datetime(value: datetime | date | str) -> datetime:
    if isinstance(value, str):
        normalized = value.replace("Z", "+00:00")
        try:
            parsed: datetime | date = datetime.fromisoformat(normalized)
        except ValueError:
            parsed = date.fromisoformat(value)
    else:
        parsed = value
    if isinstance(parsed, date) and not isinstance(parsed, datetime):
        parsed = datetime.combine(parsed, time.min)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


class MarketDataEvent(BaseModel):
    """Schema version 1 envelope for canonical market-data records."""

    model_config = ConfigDict(extra="forbid")

    event_id: UUID = Field(default_factory=uuid4)
    event_type: EventType
    schema_version: int = SCHEMA_VERSION
    symbol: str = Field(min_length=1)
    observed_at: datetime
    source: str = Field(min_length=1)
    payload: dict[str, Any]
    ingested_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @model_validator(mode="after")
    def validate_contract(self) -> "MarketDataEvent":
        if self.schema_version != SCHEMA_VERSION:
            raise ValueError(f"Unsupported market-data schema version: {self.schema_version}")
        missing = _REQUIRED_PAYLOAD_FIELDS[self.event_type] - self.payload.keys()
        if missing:
            raise ValueError(
                f"{self.event_type.value} payload is missing fields: {', '.join(sorted(missing))}"
            )
        payload_symbol = self.payload.get("symbol")
        if payload_symbol is not None and payload_symbol != self.symbol:
            raise ValueError("Event symbol must match payload symbol")
        if self.event_type is EventType.QUOTE:
            normalized_payload = dict(self.payload)
            normalized_payload["timestamp"] = _utc_datetime(
                normalized_payload["timestamp"]
            ).isoformat().replace("+00:00", "Z")
            self.payload = normalized_payload
        if self.observed_at.tzinfo is None or self.ingested_at.tzinfo is None:
            raise ValueError("Event timestamps must include timezone information")
        self.observed_at = self.observed_at.astimezone(timezone.utc)
        self.ingested_at = self.ingested_at.astimezone(timezone.utc)
        return self

    @classmethod
    def instrument(
        cls,
        record: InstrumentRecord,
        *,
        source: str,
        observed_at: datetime | date | str | None = None,
    ) -> "MarketDataEvent":
        return cls(
            event_type=EventType.INSTRUMENT,
            symbol=record["symbol"],
            observed_at=_utc_datetime(observed_at or datetime.now(timezone.utc)),
            source=source,
            payload=dict(record),
        )

    @classmethod
    def quote(cls, record: QuoteRecord, *, source: str) -> "MarketDataEvent":
        return cls(
            event_type=EventType.QUOTE,
            symbol=record["symbol"],
            observed_at=_utc_datetime(record["timestamp"]),
            source=source,
            payload=dict(record),
        )

    @classmethod
    def candle(
        cls,
        symbol: str,
        record: CandleRecord,
        *,
        source: str,
    ) -> "MarketDataEvent":
        return cls(
            event_type=EventType.CANDLE,
            symbol=symbol,
            observed_at=_utc_datetime(record["time"]),
            source=source,
            payload=dict(record),
        )

    def serialize(self) -> bytes:
        """Return deterministic compact JSON encoded as UTF-8."""
        document = self.model_dump(mode="json")
        return json.dumps(
            document,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
        ).encode("utf-8")

    @classmethod
    def deserialize(cls, value: bytes | str) -> "MarketDataEvent":
        """Decode and validate one Kafka message value."""
        try:
            raw = value.decode("utf-8") if isinstance(value, bytes) else value
            return cls.model_validate(json.loads(raw))
        except (UnicodeDecodeError, json.JSONDecodeError, ValidationError, TypeError) as exc:
            raise EventValidationError(f"Invalid market-data event: {exc}") from exc
