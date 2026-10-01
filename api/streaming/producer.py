"""Kafka producer for validated canonical market-data events."""

import asyncio
import logging
import threading
import time
from dataclasses import dataclass
from typing import Any

from confluent_kafka import Producer

from api.core.config import Settings, settings
from api.streaming.events import MarketDataEvent


logger = logging.getLogger(__name__)


class KafkaPublishError(RuntimeError):
    """Raised when Kafka does not acknowledge a market-data event."""


@dataclass(frozen=True)
class DeliveryResult:
    topic: str
    partition: int
    offset: int
    key: str


def producer_config(config: Settings = settings) -> dict[str, Any]:
    """Build the librdkafka producer configuration from application settings."""
    return {
        "bootstrap.servers": config.KAFKA_BOOTSTRAP_SERVERS,
        "client.id": config.KAFKA_PRODUCER_CLIENT_ID,
        "acks": "all",
        "enable.idempotence": True,
        "retries": config.KAFKA_RETRIES,
        "request.timeout.ms": config.KAFKA_REQUEST_TIMEOUT_MS,
        "delivery.timeout.ms": config.KAFKA_DELIVERY_TIMEOUT_MS,
    }


class KafkaEventProducer:
    """Publishes market-data events and reports broker delivery metadata."""

    def __init__(self, config: Settings = settings, client: Any | None = None) -> None:
        self.settings = config
        self.client = client or Producer(producer_config(config))
        self._closed = False
        logger.info(
            "Kafka producer configured brokers=%s topic=%s client_id=%s",
            config.KAFKA_BOOTSTRAP_SERVERS,
            config.KAFKA_MARKET_DATA_TOPIC,
            config.KAFKA_PRODUCER_CLIENT_ID,
        )

    def publish(self, event: MarketDataEvent) -> DeliveryResult:
        if self._closed:
            raise KafkaPublishError("Kafka producer is closed")

        delivered = threading.Event()
        outcome: dict[str, Any] = {}

        def on_delivery(error: Any, message: Any) -> None:
            if error is not None:
                outcome["error"] = error
            else:
                outcome["result"] = DeliveryResult(
                    topic=message.topic(),
                    partition=message.partition(),
                    offset=message.offset(),
                    key=event.symbol,
                )
            delivered.set()

        attempts = 0
        while True:
            try:
                self.client.produce(
                    topic=self.settings.KAFKA_MARKET_DATA_TOPIC,
                    key=event.symbol.encode("utf-8"),
                    value=event.serialize(),
                    on_delivery=on_delivery,
                )
                break
            except BufferError as exc:
                attempts += 1
                if attempts > self.settings.KAFKA_RETRIES:
                    raise KafkaPublishError("Kafka producer queue remained full") from exc
                self.client.poll(0.1)

        deadline = time.monotonic() + (self.settings.KAFKA_DELIVERY_TIMEOUT_MS / 1000)
        while not delivered.is_set() and time.monotonic() < deadline:
            self.client.poll(0.1)

        if not delivered.is_set():
            raise KafkaPublishError(
                f"Kafka delivery timed out after {self.settings.KAFKA_DELIVERY_TIMEOUT_MS} ms"
            )
        if "error" in outcome:
            raise KafkaPublishError(f"Kafka delivery failed: {outcome['error']}")

        result: DeliveryResult = outcome["result"]
        logger.info(
            "Kafka delivery succeeded topic=%s partition=%s offset=%s key=%s event_id=%s",
            result.topic,
            result.partition,
            result.offset,
            result.key,
            event.event_id,
        )
        return result

    async def publish_async(self, event: MarketDataEvent) -> DeliveryResult:
        """Publish without blocking an asynchronous application event loop."""
        return await asyncio.to_thread(self.publish, event)

    def close(self) -> None:
        if self._closed:
            return
        remaining = self.client.flush(self.settings.KAFKA_DELIVERY_TIMEOUT_MS / 1000)
        self._closed = True
        if remaining:
            raise KafkaPublishError(f"Kafka producer closed with {remaining} undelivered messages")

    def __enter__(self) -> "KafkaEventProducer":
        return self

    def __exit__(self, exc_type: Any, exc: Any, traceback: Any) -> None:
        self.close()
