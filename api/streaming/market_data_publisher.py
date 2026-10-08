"""Bridge from the existing market-data service to Kafka events."""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol

from api.services.market_provider import InstrumentRecord, QuoteRecord
from api.streaming.events import MarketDataEvent
from api.streaming.producer import DeliveryResult, KafkaEventProducer


class MarketDataReader(Protocol):
    def normalize_symbol(self, symbol: str) -> str: ...
    def get_instrument(self, symbol: str) -> InstrumentRecord: ...
    def get_quote(self, symbol: str) -> QuoteRecord: ...
    def get_candles(self, symbol: str, period: str, interval: str) -> tuple[str, list[dict]]: ...


@dataclass(frozen=True)
class PublishedMarketDataEvent:
    """One canonical event and the broker acknowledgement for it."""

    event: MarketDataEvent
    delivery: DeliveryResult


class MarketDataEventPublisher:
    """Publishes canonical records obtained through the application service boundary."""

    def __init__(
        self,
        market_data: MarketDataReader,
        producer: KafkaEventProducer,
        *,
        source: str,
    ) -> None:
        self.market_data = market_data
        self.producer = producer
        self.source = source

    def publish_instrument(self, symbol: str) -> DeliveryResult:
        record = self.market_data.get_instrument(symbol)
        event = MarketDataEvent.instrument(
            record,
            source=self.source,
            observed_at=datetime.now(timezone.utc),
        )
        return self.producer.publish(event)

    def publish_quote(self, symbol: str) -> DeliveryResult:
        record = self.market_data.get_quote(symbol)
        return self.publish_quote_record(record).delivery

    def publish_quote_record(self, record: QuoteRecord) -> PublishedMarketDataEvent:
        """Publish an already-read canonical quote without another provider call."""
        event = MarketDataEvent.quote(record, source=self.source)
        return PublishedMarketDataEvent(
            event=event,
            delivery=self.producer.publish(event),
        )

    def publish_candles(
        self,
        symbol: str,
        *,
        period: str = "1mo",
        interval: str = "1d",
    ) -> list[DeliveryResult]:
        normalized, candles = self.market_data.get_candles(
            symbol,
            period=period,
            interval=interval,
        )
        return [
            self.producer.publish(MarketDataEvent.candle(normalized, candle, source=self.source))
            for candle in candles
        ]

    def close(self) -> None:
        self.producer.close()
