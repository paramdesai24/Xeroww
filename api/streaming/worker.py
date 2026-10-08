"""Continuous canonical market-data ingestion worker."""

import logging
import signal
import threading
from collections.abc import Callable, Sequence
from typing import Protocol

from api.core.config import settings
from api.services.market_data_service import MarketDataService
from api.services.market_provider import QuoteRecord
from api.services.yahoo_provider import YahooFinanceProvider
from api.streaming.market_data_publisher import (
    MarketDataEventPublisher,
    PublishedMarketDataEvent,
)
from api.streaming.producer import KafkaEventProducer

logger = logging.getLogger(__name__)


class QuoteReader(Protocol):
    def normalize_symbol(self, symbol: str) -> str: ...
    def get_quote(self, symbol: str) -> QuoteRecord: ...


class QuotePublisher(Protocol):
    def publish_quote_record(self, record: QuoteRecord) -> PublishedMarketDataEvent: ...
    def close(self) -> None: ...


def parse_symbol_universe(
    raw_symbols: str,
    normalize: Callable[[str], str],
) -> tuple[str, ...]:
    """Normalize a comma-separated universe and remove duplicates in order."""
    symbols: list[str] = []
    seen: set[str] = set()
    for raw_symbol in raw_symbols.split(","):
        if not raw_symbol.strip():
            continue
        symbol = normalize(raw_symbol)
        if symbol not in seen:
            seen.add(symbol)
            symbols.append(symbol)
    if not symbols:
        raise ValueError("Market-data worker symbol universe cannot be empty")
    return tuple(symbols)


def quote_fingerprint(record: QuoteRecord) -> tuple[object, ...]:
    """Identify an unchanged canonical market observation."""
    return (
        record["timestamp"],
        record["price"],
        record["previous_close"],
        record["day_high"],
        record["day_low"],
        record["volume"],
    )


class ContinuousMarketDataWorker:
    """Poll canonical quotes and publish each changed observation to Kafka."""

    def __init__(
        self,
        market_data: QuoteReader,
        publisher: QuotePublisher,
        *,
        symbols: Sequence[str],
        interval_seconds: float,
        stop_event: threading.Event | None = None,
    ) -> None:
        if interval_seconds <= 0:
            raise ValueError("Market-data worker interval must be positive")
        if not symbols:
            raise ValueError("Market-data worker symbol universe cannot be empty")
        self.market_data = market_data
        self.publisher = publisher
        self.symbols = tuple(symbols)
        self.interval_seconds = interval_seconds
        self.stop_event = stop_event or threading.Event()
        self._published_fingerprints: dict[str, tuple[object, ...]] = {}

    def run_cycle(self) -> list[PublishedMarketDataEvent]:
        """Run one bounded polling cycle, isolating failures by symbol."""
        publications: list[PublishedMarketDataEvent] = []
        for symbol in self.symbols:
            if self.stop_event.is_set():
                break
            try:
                record = self.market_data.get_quote(symbol)
                fingerprint = quote_fingerprint(record)
                if self._published_fingerprints.get(symbol) == fingerprint:
                    logger.info("Market-data observation unchanged symbol=%s", symbol)
                    continue
                publication = self.publisher.publish_quote_record(record)
                self._published_fingerprints[symbol] = fingerprint
                publications.append(publication)
                logger.info(
                    "Market-data observation published symbol=%s event_id=%s "
                    "topic=%s partition=%s offset=%s observed_at=%s ingested_at=%s",
                    symbol,
                    publication.event.event_id,
                    publication.delivery.topic,
                    publication.delivery.partition,
                    publication.delivery.offset,
                    publication.event.observed_at.isoformat(),
                    publication.event.ingested_at.isoformat(),
                )
            except Exception:
                logger.exception("Market-data observation failed symbol=%s", symbol)
        return publications

    def run_forever(self) -> None:
        logger.info(
            "Market-data worker started symbols=%s interval_seconds=%s",
            ",".join(self.symbols),
            self.interval_seconds,
        )
        try:
            while not self.stop_event.is_set():
                self.run_cycle()
                self.stop_event.wait(self.interval_seconds)
        finally:
            self.publisher.close()
            logger.info("Market-data worker stopped")


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    stop_event = threading.Event()
    provider = YahooFinanceProvider()
    market_data = MarketDataService(provider)
    symbols = parse_symbol_universe(
        settings.MARKET_DATA_WORKER_SYMBOLS,
        market_data.normalize_symbol,
    )
    publisher = MarketDataEventPublisher(
        market_data,
        KafkaEventProducer(),
        source=provider.metadata.provider_id,
    )
    worker = ContinuousMarketDataWorker(
        market_data,
        publisher,
        symbols=symbols,
        interval_seconds=settings.MARKET_DATA_WORKER_INTERVAL_SECONDS,
        stop_event=stop_event,
    )

    def request_stop(signum: int, frame: object) -> None:
        logger.info("Market-data worker received shutdown signal=%s", signum)
        stop_event.set()

    signal.signal(signal.SIGTERM, request_stop)
    signal.signal(signal.SIGINT, request_stop)
    worker.run_forever()


if __name__ == "__main__":
    main()
