"""Verify that the running worker publishes current provider observations."""

import json
import logging
import os
import time
from datetime import datetime, timezone
from uuid import uuid4

from api.streaming.consumer import ConsumedEvent, KafkaEventConsumer


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    timeout_seconds = float(os.getenv("LIVE_INGESTION_SMOKE_TIMEOUT_SECONDS", "120"))
    required_events = int(os.getenv("LIVE_INGESTION_SMOKE_REQUIRED_EVENTS", "2"))
    started_at = datetime.now(timezone.utc)
    group_id = f"xeroww-live-smoke-{uuid4().hex}"
    consumed: list[ConsumedEvent] = []
    event_ids: set[str] = set()

    with KafkaEventConsumer(group_id=group_id) as consumer:
        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline and len(consumed) < required_events:
            candidate = consumer.poll_once(timeout=1.0)
            if candidate is None:
                continue
            event = candidate.event
            event_id = str(event.event_id)
            if (
                event.source != "yahoo"
                or event.ingested_at < started_at
                or event_id in event_ids
            ):
                continue
            event_ids.add(event_id)
            consumed.append(candidate)

    if len(consumed) < required_events:
        raise RuntimeError(
            f"Received {len(consumed)} current Yahoo events, expected {required_events} "
            f"within {timeout_seconds} seconds"
        )

    print(json.dumps({
        "status": "passed",
        "consumer_group": group_id,
        "events": [
            {
                "event_id": str(item.event.event_id),
                "symbol": item.event.symbol,
                "observed_at": item.event.observed_at.isoformat(),
                "ingested_at": item.event.ingested_at.isoformat(),
                "partition": item.partition,
                "offset": item.offset,
            }
            for item in consumed
        ],
    }, sort_keys=True))


if __name__ == "__main__":
    main()
