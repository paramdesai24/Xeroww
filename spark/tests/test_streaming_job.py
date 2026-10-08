"""Focused tests for Spark streaming configuration and market features."""

import json
import logging
import math
from pathlib import Path

import pytest

from spark.streaming_job import (
    StreamingConfig,
    calculate_market_features,
    kafka_source_options,
    parse_event_document,
    write_batch,
)


def event(*, price: float, previous_close: float, volume: int, observed_at: str) -> dict:
    return {
        "event_id": f"event-{observed_at}",
        "event_type": "quote",
        "schema_version": 1,
        "symbol": "RELIANCE.NS",
        "observed_at": observed_at,
        "ingested_at": observed_at,
        "source": "yahoo",
        "payload": {
            "symbol": "RELIANCE.NS",
            "price": price,
            "previous_close": previous_close,
            "volume": volume,
        },
    }


def config() -> StreamingConfig:
    return StreamingConfig(
        bootstrap_servers="kafka-1:9092,kafka-2:9092,kafka-3:9092",
        topic="market-data",
        consumer_group="xeroww-spark-market-data",
        checkpoint_root="/checkpoints",
        output_root="/output",
        query_name="xeroww-market-features",
        starting_offsets="earliest",
        trigger_interval="10 seconds",
        feature_window="5 minutes",
        feature_slide="1 minute",
        watermark="2 minutes",
    )


def test_event_parser_preserves_timestamps_and_payload():
    document = event(
        price=110.0,
        previous_close=100.0,
        volume=1500,
        observed_at="2026-10-01T09:15:00Z",
    )

    parsed = parse_event_document(json.dumps(document))

    assert parsed["observed_at"] == "2026-10-01T09:15:00Z"
    assert parsed["ingested_at"] == "2026-10-01T09:15:00Z"
    assert parsed["payload"]["price"] == 110.0


@pytest.mark.parametrize(
    "document,error",
    [
        ("not-json", "Invalid event JSON"),
        (json.dumps([]), "Event JSON must be an object"),
        (json.dumps({}), "Missing event fields"),
        (
            json.dumps({
                **event(
                    price=110.0,
                    previous_close=100.0,
                    volume=1500,
                    observed_at="2026-10-01T09:15:00Z",
                ),
                "payload": None,
            }),
            "Quote payload must be an object",
        ),
        (
            json.dumps({
                **event(
                    price=110.0,
                    previous_close=100.0,
                    volume=1500,
                    observed_at="2026-10-01T09:15:00Z",
                ),
                "schema_version": 2,
            }),
            "Unsupported schema version",
        ),
    ],
)
def test_malformed_events_are_rejected(document, error):
    with pytest.raises(ValueError, match=error):
        parse_event_document(document)


def test_feature_calculations_cover_return_volatility_and_rvol():
    events = [
        event(
            price=100.0,
            previous_close=98.0,
            volume=1000,
            observed_at="2026-10-01T09:15:00Z",
        ),
        event(
            price=110.0,
            previous_close=100.0,
            volume=2000,
            observed_at="2026-10-01T09:16:00Z",
        ),
    ]

    features = calculate_market_features(events)

    assert features["log_return"] == pytest.approx(math.log(1.1))
    assert features["rolling_return"] == pytest.approx(0.1)
    assert features["rolling_volatility"] is not None
    assert features["relative_volume"] == pytest.approx(4 / 3)


def test_streaming_configuration_is_explicit_and_query_specific():
    options = kafka_source_options(config(), group_suffix="features")

    assert options["kafka.bootstrap.servers"].count(",") == 2
    assert options["subscribe"] == "market-data"
    assert options["startingOffsets"] == "earliest"
    assert options["failOnDataLoss"] == "true"
    assert options["kafka.group.id"] == "xeroww-spark-market-data-features"
    assert config().checkpoint_root == "/checkpoints"
    assert config().query_name == "xeroww-market-features"


def test_write_batch_persists_once_and_unpersists_after_success(caplog):
    operations = []

    class FakeRdd:
        def getNumPartitions(self):
            operations.append("partitions")
            return 2

    class FakeWriter:
        def mode(self, value):
            operations.append(("mode", value))
            return self

        def json(self, path):
            operations.append(("json", path))

    class FakeFrame:
        rdd = FakeRdd()
        write = FakeWriter()

        def persist(self):
            operations.append("persist")
            return self

        def count(self):
            operations.append("count")
            return 5

        def show(self, rows, *, truncate):
            operations.append(("show", rows, truncate))

        def unpersist(self):
            operations.append("unpersist")

    with caplog.at_level(logging.INFO, logger="spark.streaming_job"):
        write_batch(FakeFrame(), 72, "/output", "features")

    assert operations == [
        "persist",
        "count",
        "partitions",
        ("show", 50, False),
        ("mode", "append"),
        ("json", str(Path("/output") / "features" / "batch_id=72")),
        "unpersist",
    ]
    assert "Spark batch completed output=features batch_id=72 rows=5" in caplog.text


def test_write_batch_unpersists_and_does_not_log_completion_when_write_fails(caplog):
    operations = []

    class FakeRdd:
        def getNumPartitions(self):
            return 2

    class FailingWriter:
        def mode(self, value):
            return self

        def json(self, path):
            raise RuntimeError("write failed")

    class FakeFrame:
        rdd = FakeRdd()
        write = FailingWriter()

        def persist(self):
            operations.append("persist")
            return self

        def count(self):
            return 5

        def show(self, rows, *, truncate):
            return None

        def unpersist(self):
            operations.append("unpersist")

    with caplog.at_level(logging.INFO, logger="spark.streaming_job"):
        with pytest.raises(RuntimeError, match="write failed"):
            write_batch(FakeFrame(), 72, "/output", "features")

    assert operations == ["persist", "unpersist"]
    assert "Spark batch completed" not in caplog.text
