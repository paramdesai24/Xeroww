"""Run a real producer to Kafka to consumer market-data smoke test."""

import json
import logging
import time
from datetime import datetime, timezone
from uuid import uuid4

from api.streaming.admin import KafkaTopicAdmin
from api.streaming.consumer import KafkaEventConsumer
from api.streaming.events import MarketDataEvent
from api.streaming.producer import KafkaEventProducer


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

    admin = KafkaTopicAdmin()
    spec = admin.ensure_topic()
    topic = admin.inspect_topic(spec.name)

    run_id = uuid4().hex
    group_id = f"xeroww-smoke-{run_id}"
    symbol = f"XEROWW-SMOKE-{run_id[:8]}"
    event = MarketDataEvent.quote(
        {
            "symbol": symbol,
            "display_name": "Xeroww Kafka Smoke Instrument",
            "price": 101.0,
            "previous_close": 100.0,
            "change": 1.0,
            "change_pct": 1.0,
            "day_high": 102.0,
            "day_low": 99.0,
            "volume": 1000,
            "market_cap": None,
            "currency": "INR",
            "data_note": "Kafka integration smoke event",
            "timestamp": datetime.now(timezone.utc),
        },
        source="xeroww-smoke",
    )

    consumer = KafkaEventConsumer(group_id=group_id)
    producer = KafkaEventProducer()
    try:
        delivery = producer.publish(event)
        deadline = time.monotonic() + 30
        consumed = None
        while time.monotonic() < deadline:
            candidate = consumer.poll_once(timeout=1.0)
            if candidate and candidate.event.event_id == event.event_id:
                consumed = candidate
                break
        if consumed is None:
            raise RuntimeError(f"Kafka smoke event {event.event_id} was not consumed within 30 seconds")
        print(json.dumps({
            "status": "passed",
            "brokers": topic.broker_count,
            "topic": topic.topic,
            "partitions": topic.partition_count,
            "event_id": str(event.event_id),
            "symbol": symbol,
            "producer_partition": delivery.partition,
            "producer_offset": delivery.offset,
            "consumer_partition": consumed.partition,
            "consumer_offset": consumed.offset,
            "consumer_group": consumed.consumer_group,
        }, sort_keys=True))
    finally:
        producer.close()
        consumer.close()


if __name__ == "__main__":
    main()
