"""Kafka consumer with validated events and deliberate offset commits."""

import logging
from dataclasses import dataclass
from typing import Any, Callable

from confluent_kafka import Consumer

from api.core.config import Settings, settings
from api.streaming.events import MarketDataEvent


logger = logging.getLogger(__name__)
EventSink = Callable[[MarketDataEvent], None]


@dataclass(frozen=True)
class ConsumedEvent:
    event: MarketDataEvent
    topic: str
    partition: int
    offset: int
    consumer_group: str


def consumer_config(config: Settings = settings, *, group_id: str | None = None) -> dict[str, Any]:
    """Build the librdkafka consumer configuration from application settings."""
    return {
        "bootstrap.servers": config.KAFKA_BOOTSTRAP_SERVERS,
        "client.id": config.KAFKA_CONSUMER_CLIENT_ID,
        "group.id": group_id or config.KAFKA_CONSUMER_GROUP,
        "enable.auto.commit": False,
        "enable.auto.offset.store": False,
        "auto.offset.reset": "earliest",
        "session.timeout.ms": config.KAFKA_REQUEST_TIMEOUT_MS,
    }


def structured_log_sink(event: MarketDataEvent) -> None:
    logger.info(
        "Kafka market-data event event_id=%s type=%s symbol=%s source=%s observed_at=%s",
        event.event_id,
        event.event_type.value,
        event.symbol,
        event.source,
        event.observed_at.isoformat(),
    )


class KafkaEventConsumer:
    """Consumes, validates, handles, and then explicitly commits one event."""

    def __init__(
        self,
        config: Settings = settings,
        *,
        group_id: str | None = None,
        sink: EventSink = structured_log_sink,
        client: Any | None = None,
    ) -> None:
        self.settings = config
        self.group_id = group_id or config.KAFKA_CONSUMER_GROUP
        self.sink = sink
        self.client = client or Consumer(consumer_config(config, group_id=self.group_id))
        self.client.subscribe([config.KAFKA_MARKET_DATA_TOPIC])
        self._closed = False
        logger.info(
            "Kafka consumer configured brokers=%s topic=%s group=%s client_id=%s",
            config.KAFKA_BOOTSTRAP_SERVERS,
            config.KAFKA_MARKET_DATA_TOPIC,
            self.group_id,
            config.KAFKA_CONSUMER_CLIENT_ID,
        )

    def poll_once(self, timeout: float | None = None) -> ConsumedEvent | None:
        message = self.client.poll(
            self.settings.KAFKA_POLL_TIMEOUT_SECONDS if timeout is None else timeout
        )
        if message is None:
            return None
        if message.error():
            logger.error("Kafka consumer error group=%s error=%s", self.group_id, message.error())
            return None

        try:
            event = MarketDataEvent.deserialize(message.value())
            self.sink(event)
        except Exception as exc:
            logger.error(
                "Kafka message rejected topic=%s partition=%s offset=%s group=%s error=%s",
                message.topic(),
                message.partition(),
                message.offset(),
                self.group_id,
                exc,
            )
            return None

        self.client.store_offsets(message=message)
        self.client.commit(message=message, asynchronous=False)
        consumed = ConsumedEvent(
            event=event,
            topic=message.topic(),
            partition=message.partition(),
            offset=message.offset(),
            consumer_group=self.group_id,
        )
        logger.info(
            "Kafka event consumed topic=%s partition=%s offset=%s group=%s event_id=%s",
            consumed.topic,
            consumed.partition,
            consumed.offset,
            consumed.consumer_group,
            event.event_id,
        )
        return consumed

    def close(self) -> None:
        if not self._closed:
            self.client.close()
            self._closed = True

    def __enter__(self) -> "KafkaEventConsumer":
        return self

    def __exit__(self, exc_type: Any, exc: Any, traceback: Any) -> None:
        self.close()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    consumer = KafkaEventConsumer()
    try:
        while True:
            consumer.poll_once()
    except KeyboardInterrupt:
        logger.info("Kafka consumer interrupted")
    finally:
        consumer.close()


if __name__ == "__main__":
    main()
