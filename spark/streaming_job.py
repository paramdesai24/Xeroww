"""Kafka-backed Spark Structured Streaming market feature job."""

import json
import logging
import math
import os
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class StreamingConfig:
    """Explicit runtime configuration for one streaming query set."""

    bootstrap_servers: str
    topic: str
    consumer_group: str
    checkpoint_root: str
    output_root: str
    query_name: str
    starting_offsets: str
    trigger_interval: str
    feature_window: str
    feature_slide: str
    watermark: str

    @classmethod
    def from_env(cls) -> "StreamingConfig":
        config = cls(
            bootstrap_servers=os.getenv(
                "KAFKA_BOOTSTRAP_SERVERS",
                "kafka-1:9092,kafka-2:9092,kafka-3:9092",
            ),
            topic=os.getenv("KAFKA_MARKET_DATA_TOPIC", "market-data"),
            consumer_group=os.getenv("SPARK_KAFKA_CONSUMER_GROUP", "xeroww-spark-market-data"),
            checkpoint_root=os.getenv("SPARK_CHECKPOINT_ROOT", "/opt/spark/checkpoints"),
            output_root=os.getenv("SPARK_OUTPUT_ROOT", "/opt/spark/output"),
            query_name=os.getenv("SPARK_QUERY_NAME", "xeroww-market-features"),
            starting_offsets=os.getenv("SPARK_STARTING_OFFSETS", "earliest"),
            trigger_interval=os.getenv("SPARK_TRIGGER_INTERVAL", "10 seconds"),
            feature_window=os.getenv("SPARK_FEATURE_WINDOW", "5 minutes"),
            feature_slide=os.getenv("SPARK_FEATURE_SLIDE", "1 minute"),
            watermark=os.getenv("SPARK_EVENT_WATERMARK", "2 minutes"),
        )
        if not config.bootstrap_servers or not config.topic or not config.consumer_group:
            raise ValueError("Kafka bootstrap servers, topic, and consumer group are required")
        if not config.checkpoint_root or not config.output_root or not config.query_name:
            raise ValueError("Spark checkpoint, output, and query names are required")
        return config


def kafka_source_options(config: StreamingConfig, *, group_suffix: str) -> dict[str, str]:
    """Return deliberate Kafka source options for one independent query."""
    return {
        "kafka.bootstrap.servers": config.bootstrap_servers,
        "subscribe": config.topic,
        "startingOffsets": config.starting_offsets,
        "failOnDataLoss": "true",
        "kafka.group.id": f"{config.consumer_group}-{group_suffix}",
        "includeHeaders": "false",
    }


def parse_event_document(raw: str) -> dict[str, Any]:
    """Validate the fields needed by the streaming feature path."""
    try:
        event = json.loads(raw)
    except (TypeError, json.JSONDecodeError) as exc:
        raise ValueError(f"Invalid event JSON: {exc}") from exc
    if not isinstance(event, dict):
        raise ValueError("Event JSON must be an object")
    required = {
        "event_id",
        "event_type",
        "schema_version",
        "symbol",
        "observed_at",
        "ingested_at",
        "source",
        "payload",
    }
    missing = required - event.keys()
    if missing:
        raise ValueError(f"Missing event fields: {', '.join(sorted(missing))}")
    if event["schema_version"] != 1:
        raise ValueError(f"Unsupported schema version: {event['schema_version']}")
    if event["event_type"] != "quote":
        raise ValueError(f"Unsupported feature event type: {event['event_type']}")
    payload = event["payload"]
    if not isinstance(payload, dict):
        raise ValueError("Quote payload must be an object")
    for field in ("price", "previous_close", "volume"):
        if field not in payload:
            raise ValueError(f"Quote payload missing field: {field}")
    datetime.fromisoformat(str(event["observed_at"]).replace("Z", "+00:00"))
    datetime.fromisoformat(str(event["ingested_at"]).replace("Z", "+00:00"))
    if float(payload["price"]) <= 0 or float(payload["previous_close"]) <= 0:
        raise ValueError("Quote prices must be positive")
    return event


def calculate_market_features(events: list[dict[str, Any]]) -> dict[str, float | None]:
    """Calculate the same small feature set used by the Spark expressions."""
    if not events:
        raise ValueError("At least one event is required")
    ordered = sorted(events, key=lambda event: event["observed_at"])
    prices = [float(event["payload"]["price"]) for event in ordered]
    previous_closes = [float(event["payload"]["previous_close"]) for event in ordered]
    volumes = [float(event["payload"].get("volume") or 0) for event in ordered]
    log_returns = [
        math.log(price / previous_close)
        for price, previous_close in zip(prices, previous_closes, strict=True)
    ]
    mean_log_return = sum(log_returns) / len(log_returns)
    rolling_volatility = None
    if len(log_returns) > 1:
        rolling_volatility = math.sqrt(
            sum((value - mean_log_return) ** 2 for value in log_returns)
            / (len(log_returns) - 1)
        )
    average_volume = sum(volumes) / len(volumes)
    return {
        "log_return": log_returns[-1],
        "rolling_return": (prices[-1] / prices[0]) - 1.0,
        "rolling_volatility": rolling_volatility,
        "relative_volume": volumes[-1] / average_volume if average_volume > 0 else None,
    }


def event_schema() -> Any:
    from pyspark.sql.types import (
        DoubleType,
        LongType,
        StringType,
        StructField,
        StructType,
    )

    payload = StructType([
        StructField("symbol", StringType()),
        StructField("price", DoubleType()),
        StructField("previous_close", DoubleType()),
        StructField("volume", LongType()),
    ])
    return StructType([
        StructField("event_id", StringType()),
        StructField("event_type", StringType()),
        StructField("schema_version", LongType()),
        StructField("symbol", StringType()),
        StructField("observed_at", StringType()),
        StructField("source", StringType()),
        StructField("payload", payload),
        StructField("ingested_at", StringType()),
    ])


def classify_events(kafka_frame: Any) -> Any:
    """Parse Kafka values and classify valid, ignored, and malformed records."""
    from pyspark.sql import functions as F

    parsed = kafka_frame.select(
        F.col("topic").alias("kafka_topic"),
        F.col("partition").alias("kafka_partition"),
        F.col("offset").alias("kafka_offset"),
        F.col("timestamp").alias("kafka_timestamp"),
        F.col("value").cast("string").alias("raw_value"),
        F.from_json(F.col("value").cast("string"), event_schema()).alias("event"),
    )
    observed_at = F.to_timestamp(F.col("event.observed_at"))
    ingested_at = F.to_timestamp(F.col("event.ingested_at"))
    valid_quote = (
        F.col("event").isNotNull()
        & (F.col("event.schema_version") == 1)
        & (F.col("event.event_type") == "quote")
        & F.col("event.event_id").isNotNull()
        & F.col("event.symbol").isNotNull()
        & observed_at.isNotNull()
        & ingested_at.isNotNull()
        & (F.col("event.payload.price") > 0)
        & (F.col("event.payload.previous_close") > 0)
    )
    ignored = F.col("event").isNotNull() & (F.col("event.event_type") != "quote")
    return parsed.withColumn(
        "record_status",
        F.when(valid_quote, F.lit("valid"))
        .when(ignored, F.lit("ignored"))
        .otherwise(F.lit("malformed")),
    ).withColumn("observed_at", observed_at).withColumn("ingested_at", ingested_at)


def valid_quotes(classified: Any) -> Any:
    """Project canonical quote observations and Kafka provenance."""
    from pyspark.sql import functions as F

    return classified.filter(F.col("record_status") == "valid").select(
        F.col("event.event_id").alias("event_id"),
        F.col("event.symbol").alias("symbol"),
        F.col("event.source").alias("source"),
        "observed_at",
        "ingested_at",
        F.col("event.payload.price").alias("price"),
        F.col("event.payload.previous_close").alias("previous_close"),
        F.coalesce(F.col("event.payload.volume"), F.lit(0)).alias("volume"),
        "kafka_topic",
        "kafka_partition",
        "kafka_offset",
        "kafka_timestamp",
    )


def build_feature_windows(quotes: Any, config: StreamingConfig) -> Any:
    """Build event-time feature windows that Spark can update incrementally."""
    from pyspark.sql import functions as F

    observations = quotes.withColumn(
        "log_return",
        F.log(F.col("price") / F.col("previous_close")),
    ).withWatermark("observed_at", config.watermark)
    grouped = observations.groupBy(
        F.window("observed_at", config.feature_window, config.feature_slide),
        "symbol",
        "source",
    ).agg(
        F.count("event_id").alias("observation_count"),
        F.min_by("price", "observed_at").alias("first_price"),
        F.max_by("price", "observed_at").alias("latest_price"),
        F.max_by("log_return", "observed_at").alias("log_return"),
        F.stddev_samp("log_return").alias("rolling_volatility"),
        F.avg("volume").alias("average_volume"),
        F.max_by("volume", "observed_at").alias("latest_volume"),
        F.collect_set("kafka_partition").alias("kafka_partitions"),
        F.max("kafka_offset").alias("max_kafka_offset"),
    )
    return grouped.select(
        F.col("window.start").alias("window_start"),
        F.col("window.end").alias("window_end"),
        "symbol",
        "source",
        "observation_count",
        "log_return",
        ((F.col("latest_price") / F.col("first_price")) - 1.0).alias("rolling_return"),
        "rolling_volatility",
        F.when(
            F.col("average_volume") > 0,
            F.col("latest_volume") / F.col("average_volume"),
        ).alias("relative_volume"),
        "kafka_partitions",
        "max_kafka_offset",
    )


def write_batch(frame: Any, batch_id: int, output_root: str, output_name: str) -> None:
    """Make distributed micro-batch output and provenance visible."""
    output_path = str(Path(output_root) / output_name / f"batch_id={batch_id}")
    persisted_frame = frame.persist()
    try:
        row_count = persisted_frame.count()
        partitions = persisted_frame.rdd.getNumPartitions()
        if row_count:
            persisted_frame.show(50, truncate=False)
            persisted_frame.write.mode("append").json(output_path)
        logger.info(
            "Spark batch completed output=%s batch_id=%s rows=%s partitions=%s path=%s",
            output_name,
            batch_id,
            row_count,
            partitions,
            output_path,
        )
    finally:
        persisted_frame.unpersist()


def read_kafka_stream(spark: Any, config: StreamingConfig, group_suffix: str) -> Any:
    reader = spark.readStream.format("kafka")
    for key, value in kafka_source_options(config, group_suffix=group_suffix).items():
        reader = reader.option(key, value)
    return reader.load()


def start_queries(spark: Any, config: StreamingConfig) -> tuple[Any, Any]:
    """Start the feature and rejected-record queries with independent checkpoints."""
    from pyspark.sql import functions as F

    feature_events = classify_events(read_kafka_stream(spark, config, "features"))
    features = build_feature_windows(valid_quotes(feature_events), config)
    feature_query = (
        features.writeStream.queryName(config.query_name)
        .outputMode("update")
        .option("checkpointLocation", str(Path(config.checkpoint_root) / "features"))
        .trigger(processingTime=config.trigger_interval)
        .foreachBatch(
            lambda frame, batch_id: write_batch(
                frame,
                batch_id,
                config.output_root,
                "features",
            )
        )
        .start()
    )

    rejected_events = classify_events(read_kafka_stream(spark, config, "rejected"))
    rejected = rejected_events.filter(F.col("record_status") == "malformed").select(
        "kafka_topic",
        "kafka_partition",
        "kafka_offset",
        "kafka_timestamp",
        "raw_value",
        F.lit("event_contract_validation_failed").alias("reason"),
    )
    rejected_query = (
        rejected.writeStream.queryName(f"{config.query_name}-rejected")
        .outputMode("append")
        .option("checkpointLocation", str(Path(config.checkpoint_root) / "rejected"))
        .trigger(processingTime=config.trigger_interval)
        .foreachBatch(
            lambda frame, batch_id: write_batch(
                frame,
                batch_id,
                config.output_root,
                "rejected",
            )
        )
        .start()
    )
    return feature_query, rejected_query


def main() -> None:
    from pyspark.sql import SparkSession

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    config = StreamingConfig.from_env()
    spark = (
        SparkSession.builder.appName(config.query_name)
        .config("spark.sql.session.timeZone", "UTC")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel(os.getenv("SPARK_LOG_LEVEL", "WARN"))
    logger.info(
        "Spark streaming started master=%s topic=%s query=%s checkpoint=%s",
        spark.sparkContext.master,
        config.topic,
        config.query_name,
        config.checkpoint_root,
    )
    queries = start_queries(spark, config)
    try:
        spark.streams.awaitAnyTermination()
    finally:
        for query in queries:
            if query.isActive:
                query.stop()
        spark.stop()


if __name__ == "__main__":
    main()
