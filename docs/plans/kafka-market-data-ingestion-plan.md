# Kafka Market Data Ingestion Implementation Plan

## Objective

Add the first independently runnable Kafka market-data pipeline to Xeroww. The pipeline will publish canonical instrument, quote, and candle events to a three-broker KRaft cluster and consume them with explicit validation and offset management. The existing Yahoo provider, market-data service, API, analytics, cache, database, and frontend flows will remain unchanged.

## Architecture

```text
YahooFinanceProvider or another MarketDataProvider
                     |
                     v
             MarketDataService
                     |
                     v
        MarketDataEventPublisher
                     |
                     v
             KafkaEventProducer
                     |
          key = canonical symbol
                     |
                     v
       market-data topic, 6 partitions
                     |
                     v
             KafkaEventConsumer
                     |
                     v
       structured log or injected test sink
```

Kafka is an optional parallel ingestion path. FastAPI will not initialize Kafka during startup, and existing routes will not publish events automatically in this task.

## Broker Topology

- Three Apache Kafka brokers run in combined broker/controller KRaft mode.
- Each broker has a deterministic node ID: 1, 2, or 3.
- All brokers use the same deterministic KRaft cluster ID and controller quorum.
- Internal listeners advertise Docker DNS names for container clients.
- External listeners advertise distinct localhost ports for host clients.
- Persistent named volumes store each broker log directory independently.
- Broker health checks query the broker API through the internal listener.
- Internal Kafka metadata topics use replication factor three and minimum in-sync replica count two.
- Kafka does not become a dependency of the existing backend service.

## Topic Design

One topic named `market-data` is created explicitly by default.

- Partition count: 6
- Replication factor: 3
- Minimum in-sync replicas: 2
- Message key: canonical symbol encoded as UTF-8

Six partitions provide useful parallelism beyond the three-broker count without creating unnecessary topic sprawl. Using the canonical symbol as the key preserves ordering and partition affinity for all events concerning the same instrument.

## Event Contract

The event envelope is versioned independently from application releases and contains:

- `event_id`: UUID string
- `event_type`: `instrument`, `quote`, or `candle`
- `schema_version`: integer, initially 1
- `symbol`: canonical application symbol
- `observed_at`: timezone-aware ISO 8601 timestamp for the market observation
- `source`: provider identifier
- `payload`: one existing canonical provider record
- `ingested_at`: timezone-aware ISO 8601 timestamp when the event was formed

Serialization uses deterministic JSON with sorted keys and compact separators. Deserialization validates the envelope, timestamps, schema version, event type, symbol agreement, and required payload fields. Unknown schema versions and malformed messages fail explicitly.

## Configuration

Kafka settings will be added to the existing `Settings` object and sourced from environment variables:

- bootstrap servers
- topic name
- consumer group
- producer and consumer client IDs
- request timeout
- delivery timeout
- retry count
- poll timeout
- topic partition count
- topic replication factor

Host defaults use the three exposed localhost ports. Docker services override bootstrap servers with internal broker DNS names.

## Producer

`KafkaEventProducer` will:

- accept only validated `MarketDataEvent` instances
- serialize events deterministically
- publish to the configured topic with the symbol key
- expose delivery metadata containing topic, partition, offset, and key
- surface delivery failures and queue errors
- poll delivery callbacks and flush outstanding events on close
- expose an async publish method implemented with `asyncio.to_thread` so synchronous client work does not block the FastAPI event loop
- accept an injected producer client for deterministic unit tests

The producer never calls Yahoo Finance or another provider directly.

## Market Data Publisher

`MarketDataEventPublisher` will bridge the existing `MarketDataService` to the producer without modifying either side. It will provide explicit methods to publish:

- one instrument event
- one quote event
- a requested candle series

Observation timestamps come from canonical quote timestamps or candle time values. Source identity comes from provider metadata. The publisher is invoked only by explicit scripts or callers in this task.

## Consumer

`KafkaEventConsumer` will:

- subscribe to the configured topic using the configured consumer group
- disable automatic commits
- deserialize and validate each event
- invoke an injected sink, with structured logging as the default sink
- commit a message offset synchronously only after successful validation and sink handling
- log and leave malformed or failed messages uncommitted
- expose consumed topic, partition, offset, group, event ID, event type, and symbol
- close the underlying consumer cleanly
- accept an injected consumer client for deterministic unit tests

The first consumer is deliberately a log or test sink. It does not write to a database or analytics engine.

## Topic Administration

`KafkaTopicAdmin` will use `AdminClient` to create the configured topic with explicit partitions, replication, and minimum in-sync replicas. Existing-topic responses are treated as successful, making initialization idempotent. It will also inspect cluster and topic metadata for broker and partition diagnostics.

A one-shot `kafka-init` Compose service will run the admin module after all brokers are healthy. This makes topic creation reproducible and removes manual setup.

## End-to-End Verification

`api/scripts/kafka_smoke.py` will:

1. ensure and inspect the topic
2. create a unique smoke-test consumer group
3. publish a canonical quote event with a unique symbol
4. poll until that exact event is observed
5. commit its offset after validation
6. print structured topic, partition, offset, event, and group diagnostics
7. close producer and consumer resources

The smoke path uses a canonical record and the same producer and consumer components. It does not depend on an external Yahoo network request.

## Files and Responsibilities

### `docker-compose.yml`

Add three Kafka brokers, their volumes, internal and external listeners, health checks, and one idempotent topic initialization service. Add Kafka environment variables to the init service only; do not add Kafka dependencies to the existing backend.

### `api/requirements.txt`

Declare the maintained `confluent-kafka` client with a compatible bounded version range.

### `api/.env.example`

Document host-side Kafka settings and defaults.

### `api/core/config.py`

Add typed environment-backed Kafka settings to the existing singleton.

### `api/streaming/events.py`

Define the event enum, envelope, typed payload union, constructors, deterministic serializer, deserializer, and validation errors.

### `api/streaming/producer.py`

Define producer configuration, delivery results, synchronous and asynchronous publishing, callbacks, and lifecycle handling.

### `api/streaming/consumer.py`

Define consumer configuration, safe polling, explicit commits, structured logging sink, malformed-event handling, and lifecycle handling.

### `api/streaming/admin.py`

Define topic specifications, idempotent creation, metadata inspection, diagnostics, and a module command entry point.

### `api/streaming/market_data_publisher.py`

Adapt canonical provider and service records into event envelopes and publish them without coupling the producer to Yahoo.

### `api/scripts/kafka_smoke.py`

Provide the real producer-to-broker-to-consumer proof command.

### Kafka tests

Test serialization, deserialization, version validation, payload validation, deterministic output, producer configuration and symbol keys, delivery results, async delegation, consumer configuration, malformed handling, deliberate commits, topic configuration, idempotent creation, and service-boundary publishing.

## Error Handling

- Serialization rejects unsupported event types, schema versions, mismatched payload symbols, invalid timestamps, and missing canonical fields.
- Producer queue saturation triggers a poll and retry before surfacing failure.
- Delivery callback errors become publish errors.
- Producer close raises when messages remain undelivered after the configured timeout.
- Consumer broker errors are logged and not committed.
- Malformed events and sink failures are logged and not committed.
- Topic already existing is a successful admin outcome; other admin errors surface.
- Smoke verification times out clearly if the expected event is not consumed.

## Performance and Lifecycle

- Producer acknowledgements use `all` and idempotence is enabled.
- Compression uses a client-supported lightweight codec only if available without new dependencies; otherwise no explicit compression is required.
- Publishing does not flush after every normal message. A delivery wait polls callbacks for the requested message, and close flushes remaining messages.
- Consumer polling is bounded by configuration.
- Explicit per-message commits favor correctness and observability for this proof slice. Batching can be introduced later when throughput requirements are measured.

## Testing and Validation

Run in this order:

1. focused Kafka unit tests
2. all backend tests
3. backend lint
4. Docker Compose configuration validation
5. start the three brokers and topic initialization service
6. verify all broker health checks
7. inspect cluster broker count and topic partition count
8. run the end-to-end smoke script against the host listeners
9. inspect consumer group and message diagnostics
10. confirm the existing application stack remains valid

## Known Limitations

- JSON has no external schema registry in this slice.
- The pipeline has no dead-letter topic yet; malformed records remain uncommitted and are logged.
- The consumer sink is a log or test sink only.
- Kafka is not yet the API read path.
- Authentication, encryption, and cross-host listener configuration are deferred because this is a local development cluster.
- Per-message synchronous commits are correctness-oriented and not tuned for production throughput.
