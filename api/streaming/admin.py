"""Idempotent Kafka topic administration and cluster diagnostics."""

import json
import logging
import time
from dataclasses import asdict, dataclass
from typing import Any

from confluent_kafka import KafkaError, KafkaException
from confluent_kafka.admin import AdminClient, NewTopic

from api.core.config import Settings, settings


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class TopicSpecification:
    name: str
    partitions: int
    replication_factor: int
    min_insync_replicas: int = 2


@dataclass(frozen=True)
class TopicDiagnostics:
    topic: str
    broker_count: int
    partition_count: int
    brokers: tuple[int, ...]


def topic_specification(config: Settings = settings) -> TopicSpecification:
    return TopicSpecification(
        name=config.KAFKA_MARKET_DATA_TOPIC,
        partitions=config.KAFKA_TOPIC_PARTITIONS,
        replication_factor=config.KAFKA_TOPIC_REPLICATION_FACTOR,
    )


def admin_config(config: Settings = settings) -> dict[str, Any]:
    return {
        "bootstrap.servers": config.KAFKA_BOOTSTRAP_SERVERS,
        "client.id": f"{config.KAFKA_PRODUCER_CLIENT_ID}-admin",
        "socket.timeout.ms": config.KAFKA_REQUEST_TIMEOUT_MS,
    }


class KafkaTopicAdmin:
    def __init__(self, config: Settings = settings, client: Any | None = None) -> None:
        self.settings = config
        self.client = client or AdminClient(admin_config(config))

    def ensure_topic(self, spec: TopicSpecification | None = None) -> TopicSpecification:
        resolved = spec or topic_specification(self.settings)
        topic = NewTopic(
            resolved.name,
            num_partitions=resolved.partitions,
            replication_factor=resolved.replication_factor,
            config={"min.insync.replicas": str(resolved.min_insync_replicas)},
        )
        future = self.client.create_topics(
            [topic],
            request_timeout=self.settings.KAFKA_REQUEST_TIMEOUT_MS / 1000,
        )[resolved.name]
        try:
            future.result()
            logger.info(
                "Kafka topic created topic=%s partitions=%s replication_factor=%s",
                resolved.name,
                resolved.partitions,
                resolved.replication_factor,
            )
        except KafkaException as exc:
            error = exc.args[0] if exc.args else None
            if not isinstance(error, KafkaError) or error.code() != KafkaError.TOPIC_ALREADY_EXISTS:
                raise
            logger.info("Kafka topic already exists topic=%s", resolved.name)
        return resolved

    def inspect_topic(self, topic: str | None = None) -> TopicDiagnostics:
        topic_name = topic or self.settings.KAFKA_MARKET_DATA_TOPIC
        metadata = self.client.list_topics(
            topic=topic_name,
            timeout=self.settings.KAFKA_REQUEST_TIMEOUT_MS / 1000,
        )
        topic_metadata = metadata.topics.get(topic_name)
        if topic_metadata is None or topic_metadata.error is not None:
            raise RuntimeError(f"Kafka topic metadata unavailable for '{topic_name}'")
        diagnostics = TopicDiagnostics(
            topic=topic_name,
            broker_count=len(metadata.brokers),
            partition_count=len(topic_metadata.partitions),
            brokers=tuple(sorted(metadata.brokers)),
        )
        logger.info(
            "Kafka reachable brokers=%s topic=%s partitions=%s",
            diagnostics.brokers,
            diagnostics.topic,
            diagnostics.partition_count,
        )
        return diagnostics

    def wait_for_topic(
        self,
        topic: str | None = None,
        timeout_seconds: float = 10.0,
        poll_interval_seconds: float = 0.5,
    ) -> TopicDiagnostics:
        topic_name = topic or self.settings.KAFKA_MARKET_DATA_TOPIC
        deadline = time.monotonic() + timeout_seconds
        while True:
            try:
                return self.inspect_topic(topic_name)
            except RuntimeError:
                if time.monotonic() >= deadline:
                    raise
                time.sleep(poll_interval_seconds)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    admin = KafkaTopicAdmin()
    spec = admin.ensure_topic()
    diagnostics = admin.wait_for_topic(spec.name)
    if diagnostics.partition_count != spec.partitions:
        raise RuntimeError(
            f"Topic '{spec.name}' has {diagnostics.partition_count} partitions, expected {spec.partitions}"
        )
    print(json.dumps(asdict(diagnostics), sort_keys=True))


if __name__ == "__main__":
    main()
