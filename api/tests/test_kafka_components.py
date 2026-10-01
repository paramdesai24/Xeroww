"""Tests for Kafka configuration, producer, consumer, admin, and service bridge."""

from datetime import datetime, timezone
from types import SimpleNamespace

from api.streaming.admin import KafkaTopicAdmin, admin_config, topic_specification
from api.streaming.consumer import KafkaEventConsumer, consumer_config
from api.streaming.events import MarketDataEvent
from api.streaming.market_data_publisher import MarketDataEventPublisher
from api.streaming.producer import KafkaEventProducer, producer_config


def kafka_settings():
    return SimpleNamespace(
        KAFKA_BOOTSTRAP_SERVERS="broker-1:9092,broker-2:9092,broker-3:9092",
        KAFKA_MARKET_DATA_TOPIC="market-data",
        KAFKA_CONSUMER_GROUP="xeroww-market-data",
        KAFKA_PRODUCER_CLIENT_ID="producer-test",
        KAFKA_CONSUMER_CLIENT_ID="consumer-test",
        KAFKA_REQUEST_TIMEOUT_MS=10000,
        KAFKA_DELIVERY_TIMEOUT_MS=30000,
        KAFKA_RETRIES=3,
        KAFKA_POLL_TIMEOUT_SECONDS=1.0,
        KAFKA_TOPIC_PARTITIONS=6,
        KAFKA_TOPIC_REPLICATION_FACTOR=3,
    )


def quote_event(symbol: str = "RELIANCE.NS") -> MarketDataEvent:
    return MarketDataEvent.quote({
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
        "data_note": "Test",
        "timestamp": datetime(2026, 9, 30, 9, 15, tzinfo=timezone.utc),
    }, source="test")


class FakeProducedMessage:
    def topic(self):
        return "market-data"

    def partition(self):
        return 4

    def offset(self):
        return 12


class FakeProducer:
    def __init__(self):
        self.produced = None
        self.callback = None
        self.flushed = False

    def produce(self, **kwargs):
        self.produced = kwargs
        self.callback = kwargs["on_delivery"]

    def poll(self, timeout):
        if self.callback:
            callback, self.callback = self.callback, None
            callback(None, FakeProducedMessage())

    def flush(self, timeout):
        self.flushed = True
        return 0


class FakeConsumedMessage:
    def __init__(self, value: bytes):
        self._value = value

    def value(self):
        return self._value

    def error(self):
        return None

    def topic(self):
        return "market-data"

    def partition(self):
        return 2

    def offset(self):
        return 8


class FakeConsumer:
    def __init__(self, messages):
        self.messages = list(messages)
        self.subscriptions = []
        self.stored = []
        self.committed = []
        self.closed = False

    def subscribe(self, topics):
        self.subscriptions = topics

    def poll(self, timeout):
        return self.messages.pop(0) if self.messages else None

    def store_offsets(self, message):
        self.stored.append(message)

    def commit(self, message, asynchronous):
        self.committed.append((message, asynchronous))

    def close(self):
        self.closed = True


class FakeFuture:
    def result(self):
        return None


class FakeAdmin:
    def __init__(self):
        self.topics = []

    def create_topics(self, topics, request_timeout):
        self.topics = topics
        return {"market-data": FakeFuture()}


def test_client_configurations_are_explicit_and_safe():
    config = kafka_settings()

    producer = producer_config(config)
    consumer = consumer_config(config)
    admin = admin_config(config)

    assert producer["bootstrap.servers"] == config.KAFKA_BOOTSTRAP_SERVERS
    assert producer["acks"] == "all"
    assert producer["enable.idempotence"] is True
    assert consumer["group.id"] == "xeroww-market-data"
    assert consumer["enable.auto.commit"] is False
    assert consumer["enable.auto.offset.store"] is False
    assert admin["bootstrap.servers"] == config.KAFKA_BOOTSTRAP_SERVERS


def test_producer_uses_symbol_key_and_reports_delivery():
    client = FakeProducer()
    producer = KafkaEventProducer(kafka_settings(), client=client)
    event = quote_event()

    result = producer.publish(event)
    producer.close()

    assert client.produced["topic"] == "market-data"
    assert client.produced["key"] == b"RELIANCE.NS"
    assert MarketDataEvent.deserialize(client.produced["value"]) == event
    assert result.partition == 4
    assert result.offset == 12
    assert client.flushed is True


def test_consumer_rejects_malformed_then_commits_valid_event_only():
    event = quote_event()
    malformed = FakeConsumedMessage(b"not-json")
    valid = FakeConsumedMessage(event.serialize())
    client = FakeConsumer([malformed, valid])
    received = []
    consumer = KafkaEventConsumer(kafka_settings(), sink=received.append, client=client)

    assert consumer.poll_once() is None
    consumed = consumer.poll_once()
    consumer.close()

    assert consumed.event == event
    assert received == [event]
    assert client.stored == [valid]
    assert client.committed == [(valid, False)]
    assert client.closed is True


def test_topic_configuration_is_explicit_and_idempotent_ready():
    config = kafka_settings()
    client = FakeAdmin()
    spec = topic_specification(config)

    resolved = KafkaTopicAdmin(config, client=client).ensure_topic()

    assert resolved == spec
    assert spec.name == "market-data"
    assert spec.partitions == 6
    assert spec.replication_factor == 3
    assert spec.min_insync_replicas == 2
    assert len(client.topics) == 1


def test_market_data_publisher_uses_existing_service_boundary():
    class Reader:
        def get_quote(self, symbol):
            return dict(quote_event(symbol).payload)

    class Producer:
        def __init__(self):
            self.event = None

        def publish(self, event):
            self.event = event
            return "delivered"

    producer = Producer()
    publisher = MarketDataEventPublisher(Reader(), producer, source="boundary-test")

    assert publisher.publish_quote("TCS.NS") == "delivered"
    assert producer.event.symbol == "TCS.NS"
    assert producer.event.source == "boundary-test"
