"""Tests for the versioned Kafka market-data event contract."""

import json
from datetime import datetime, timezone

import pytest

from api.streaming.events import EventType, EventValidationError, MarketDataEvent


def quote_record(symbol: str = "RELIANCE.NS") -> dict:
    return {
        "symbol": symbol,
        "display_name": "Reliance Industries",
        "price": 2500.0,
        "previous_close": 2475.0,
        "change": 25.0,
        "change_pct": 1.01,
        "day_high": 2510.0,
        "day_low": 2460.0,
        "volume": 1000000,
        "market_cap": 1000000000.0,
        "currency": "INR",
        "data_note": "Canonical test quote",
        "timestamp": datetime(2026, 9, 30, 9, 15, tzinfo=timezone.utc),
    }


def test_event_serialization_is_deterministic_and_round_trips():
    event = MarketDataEvent.quote(quote_record(), source="yahoo")

    first = event.serialize()
    second = event.serialize()
    restored = MarketDataEvent.deserialize(first)

    assert first == second
    assert restored == event
    assert restored.event_type is EventType.QUOTE
    assert restored.schema_version == 1
    assert restored.symbol == "RELIANCE.NS"
    assert json.loads(first)["payload"]["price"] == 2500.0


@pytest.mark.parametrize(
    "record,event_type",
    [
        (
            {
                "symbol": "^NSEI",
                "display_name": "NIFTY 50",
                "exchange": "NSE",
                "sector": "Broad Market Index",
            },
            EventType.INSTRUMENT,
        ),
        (
            {
                "time": "2026-09-30",
                "open": 100.0,
                "high": 102.0,
                "low": 99.0,
                "close": 101.0,
                "volume": 1000,
            },
            EventType.CANDLE,
        ),
    ],
)
def test_canonical_record_event_constructors(record, event_type):
    if event_type is EventType.INSTRUMENT:
        event = MarketDataEvent.instrument(record, source="yahoo")
    else:
        event = MarketDataEvent.candle("^NSEI", record, source="yahoo")

    assert event.event_type is event_type
    assert event.symbol == "^NSEI"
    assert event.observed_at.tzinfo is not None


def test_deserialization_rejects_unknown_schema_version():
    document = json.loads(MarketDataEvent.quote(quote_record(), source="yahoo").serialize())
    document["schema_version"] = 2

    with pytest.raises(EventValidationError, match="Unsupported market-data schema version"):
        MarketDataEvent.deserialize(json.dumps(document))


@pytest.mark.parametrize(
    "value",
    [
        b"not-json",
        b"{}",
        json.dumps({
            "event_id": "4eef7347-5dbc-4c61-b94e-8aa5fec63c06",
            "event_type": "quote",
            "schema_version": 1,
            "symbol": "TCS.NS",
            "observed_at": "2026-09-30T09:15:00Z",
            "source": "test",
            "payload": quote_record("RELIANCE.NS"),
            "ingested_at": "2026-09-30T09:15:01Z",
        }, default=str).encode(),
    ],
)
def test_deserialization_rejects_malformed_events(value):
    with pytest.raises(EventValidationError):
        MarketDataEvent.deserialize(value)
