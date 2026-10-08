"""Focused tests for continuous canonical market-data ingestion."""

import threading
from datetime import datetime, timezone

import pytest

from api.streaming.events import MarketDataEvent
from api.streaming.market_data_publisher import PublishedMarketDataEvent
from api.streaming.producer import DeliveryResult
from api.streaming.worker import (
    ContinuousMarketDataWorker,
    parse_symbol_universe,
    quote_fingerprint,
)


def quote(symbol: str, *, price: float = 100.0, minute: int = 0) -> dict:
    return {
        "symbol": symbol,
        "display_name": symbol,
        "price": price,
        "previous_close": 99.0,
        "change": price - 99.0,
        "change_pct": 1.0,
        "day_high": price + 1.0,
        "day_low": price - 1.0,
        "volume": 1000,
        "market_cap": None,
        "currency": "INR",
        "data_note": "Worker test",
        "timestamp": datetime(2026, 10, 1, 9, minute, tzinfo=timezone.utc),
    }


class Reader:
    def __init__(self, records: dict[str, dict | Exception]) -> None:
        self.records = records
        self.calls: list[str] = []

    def normalize_symbol(self, symbol: str) -> str:
        return symbol.strip().upper()

    def get_quote(self, symbol: str) -> dict:
        self.calls.append(symbol)
        record = self.records[symbol]
        if isinstance(record, Exception):
            raise record
        return dict(record)


class Publisher:
    def __init__(self) -> None:
        self.records: list[dict] = []
        self.closed = False

    def publish_quote_record(self, record: dict) -> PublishedMarketDataEvent:
        self.records.append(record)
        event = MarketDataEvent.quote(record, source="test-provider")
        return PublishedMarketDataEvent(
            event=event,
            delivery=DeliveryResult(
                topic="market-data",
                partition=len(self.records) % 6,
                offset=len(self.records) - 1,
                key=record["symbol"],
            ),
        )

    def close(self) -> None:
        self.closed = True


def test_symbol_universe_is_normalized_deduplicated_and_nonempty():
    reader = Reader({})

    assert parse_symbol_universe(
        " reliance.ns, TCS.NS,RELIANCE.NS ",
        reader.normalize_symbol,
    ) == ("RELIANCE.NS", "TCS.NS")

    with pytest.raises(ValueError, match="cannot be empty"):
        parse_symbol_universe(" , ", reader.normalize_symbol)


def test_cycle_publishes_each_symbol_and_preserves_event_timestamps():
    observed_at = datetime(2026, 10, 1, 9, 1, tzinfo=timezone.utc)
    reader = Reader({"RELIANCE.NS": quote("RELIANCE.NS", minute=1)})
    publisher = Publisher()
    worker = ContinuousMarketDataWorker(
        reader,
        publisher,
        symbols=("RELIANCE.NS",),
        interval_seconds=30,
    )

    publications = worker.run_cycle()

    assert reader.calls == ["RELIANCE.NS"]
    assert len(publications) == 1
    assert publications[0].event.observed_at == observed_at
    assert publications[0].event.ingested_at >= observed_at
    assert publications[0].delivery.key == "RELIANCE.NS"


def test_unchanged_observation_is_suppressed_but_changed_quote_is_published():
    record = quote("TCS.NS")
    reader = Reader({"TCS.NS": record})
    publisher = Publisher()
    worker = ContinuousMarketDataWorker(
        reader,
        publisher,
        symbols=("TCS.NS",),
        interval_seconds=30,
    )

    assert len(worker.run_cycle()) == 1
    assert worker.run_cycle() == []

    reader.records["TCS.NS"] = quote("TCS.NS", price=101.0, minute=1)
    assert len(worker.run_cycle()) == 1
    assert len(publisher.records) == 2
    assert quote_fingerprint(publisher.records[0]) != quote_fingerprint(publisher.records[1])


def test_symbol_failure_does_not_stop_remaining_publications():
    reader = Reader({
        "BAD.NS": RuntimeError("provider unavailable"),
        "INFY.NS": quote("INFY.NS"),
    })
    publisher = Publisher()
    worker = ContinuousMarketDataWorker(
        reader,
        publisher,
        symbols=("BAD.NS", "INFY.NS"),
        interval_seconds=30,
    )

    publications = worker.run_cycle()

    assert reader.calls == ["BAD.NS", "INFY.NS"]
    assert [item.event.symbol for item in publications] == ["INFY.NS"]


def test_failed_delivery_is_retried_on_the_next_cycle():
    reader = Reader({"HDFCBANK.NS": quote("HDFCBANK.NS")})

    class FailingOncePublisher(Publisher):
        def __init__(self) -> None:
            super().__init__()
            self.attempts = 0

        def publish_quote_record(self, record: dict) -> PublishedMarketDataEvent:
            self.attempts += 1
            if self.attempts == 1:
                raise RuntimeError("Kafka unavailable")
            return super().publish_quote_record(record)

    publisher = FailingOncePublisher()
    worker = ContinuousMarketDataWorker(
        reader,
        publisher,
        symbols=("HDFCBANK.NS",),
        interval_seconds=30,
    )

    assert worker.run_cycle() == []
    assert len(worker.run_cycle()) == 1
    assert publisher.attempts == 2


def test_pre_stopped_worker_closes_publisher_without_polling():
    reader = Reader({"ICICIBANK.NS": quote("ICICIBANK.NS")})
    publisher = Publisher()
    stop_event = threading.Event()
    stop_event.set()
    worker = ContinuousMarketDataWorker(
        reader,
        publisher,
        symbols=("ICICIBANK.NS",),
        interval_seconds=30,
        stop_event=stop_event,
    )

    worker.run_forever()

    assert reader.calls == []
    assert publisher.closed is True


@pytest.mark.parametrize("interval", [0, -1])
def test_worker_rejects_non_positive_interval(interval):
    with pytest.raises(ValueError, match="must be positive"):
        ContinuousMarketDataWorker(
            Reader({}),
            Publisher(),
            symbols=("RELIANCE.NS",),
            interval_seconds=interval,
        )
