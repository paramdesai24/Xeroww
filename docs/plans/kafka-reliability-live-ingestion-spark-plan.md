# Kafka Reliability, Live Ingestion, and Spark Streaming Plan

## Objective and execution gate

This plan delivers two ordered infrastructure steps. Step 1 makes the existing three-node Kafka KRaft cluster recover reliably and adds a separate continuous market-data ingestion worker. Step 2 adds Spark Structured Streaming only after every Step 1 acceptance check passes in the real Docker environment.

The existing FastAPI request path, frontend behavior, analytics services, database schema, cache behavior, provider contract, Kafka topic shape, partition count, replication factor, and minimum in-sync replica count remain unchanged.

## Confirmed reliability root cause

The broker IDs, node IDs, voter map, listeners, advertised listeners, volumes, replication settings, and topic configuration are internally consistent. The failure comes from the broker health check. Every broker launches `kafka-broker-api-versions.sh` every 15 seconds. That command starts a separate JVM. On the current 4 GB Docker Desktop runtime, observed probes took 20 to 37 seconds, several exceeded the 30 second health deadline, and the three brokers consumed sustained CPU while controller requests expired at Kafka's 2 second default. The resulting election loop generated more load and delayed consumer-group coordinator recovery.

The first fix is to keep active broker health checks but replace the heavyweight Java client probe with a lightweight TCP listener probe provided by Bash. This verifies that the Kafka process is accepting connections without creating three recurring JVMs. Runtime testing confirmed two more parts of the same resource-pressure failure. A heavy image build can delay controller RPCs beyond Kafka's 2 second defaults and restart the election loop, and three default 1 GB broker heaps overcommit a 4 GB Docker Desktop runtime before the API, database, cache, or worker start. The Docker development cluster therefore needs explicit controller request, fetch, and election timeouts plus bounded 256 MB initial and 512 MB maximum broker heaps. These settings tolerate bounded host contention without weakening replication or persistence.

## Step 1 architecture

```text
YahooFinanceProvider
        |
        v
MarketDataProvider contract
        |
        v
MarketDataService and existing quote cache
        |
        v
ContinuousMarketDataWorker
        |
        v
MarketDataEventPublisher
        |
        v
KafkaEventProducer
        |
        v
market-data topic, 6 partitions, RF 3, min ISR 2
```

The worker is an independent process and Compose service. It does not run inside FastAPI and does not add Kafka to the API startup dependency graph.

## Step 1 files and modules

### `docker-compose.yml`

- Replace the JVM-based Kafka health command with a lightweight Bash TCP connection to the internal broker listener.
- Add a separate `market-data-worker` service built from the existing backend image.
- Make the worker wait for successful topic initialization, not only open broker sockets.
- Pass Kafka bootstrap settings, polling interval, symbol universe, and Yahoo cache path through environment variables.
- Keep all three brokers, persistent volumes, KRaft roles, node IDs, listeners, replication settings, and topic settings intact.

### `api/core/config.py`

- Add typed environment settings for worker polling interval and symbol universe.
- Parse the configured universe in the worker so the shared settings object remains simple and existing application configuration behavior does not change.

### `api/.env.example`

- Document the worker interval and development symbol universe.

### `api/streaming/worker.py`

Add `ContinuousMarketDataWorker` with injected `MarketDataEventPublisher`, symbol list, interval, clock, and stop event.

Responsibilities:

1. Normalize and deduplicate the configured symbol universe while preserving order.
2. Poll each symbol through `MarketDataService.get_quote`.
3. Publish the canonical quote through `MarketDataEventPublisher`.
4. Record structured success logs containing symbol, event delivery topic, partition, and offset.
5. Catch per-symbol provider and publish failures so one bad symbol does not stop the cycle.
6. Avoid uncontrolled duplicate publishing by remembering the latest observation fingerprint per symbol and skipping an unchanged observation timestamp plus market values.
7. Sleep through a stop event so termination is prompt.
8. Close the producer exactly once during normal exit, interruption, or termination.

The module entry point will create `YahooFinanceProvider`, `MarketDataService`, `KafkaEventProducer`, and `MarketDataEventPublisher` using existing boundaries. Yahoo-specific construction stays at the executable composition root. Kafka code receives only canonical records.

### `api/streaming/market_data_publisher.py`

- Add a method that returns both the event and its delivery result when the worker needs to log and verify the event ID.
- Preserve the existing `publish_quote` return contract for current callers and tests.

### `api/tests/test_market_data_worker.py`

Focused tests will cover:

- configurable symbol normalization and deduplication
- one polling cycle across multiple symbols
- unchanged observation suppression
- a changed observation producing a second event
- per-symbol failure isolation
- delivery metadata logging inputs
- prompt stop behavior
- producer closure on worker exit
- separation of observation and ingestion timestamps through the existing event envelope

### `api/scripts/live_ingestion_smoke.py`

Add a bounded verification script that starts a consumer with a unique group, waits for a real supported symbol emitted by the worker, validates its event ID and timestamps, and prints the topic, partition, offset, group, source, and symbol. It will not call Yahoo directly, so the proof covers the running worker path.

### Documentation

Update the Kafka implementation documentation with the diagnosed failure, health-check design, worker lifecycle, configuration, start commands, restart checks, and bounded live-stream verification.

## Step 1 data and control flow

1. Compose starts all three brokers with persistent data volumes.
2. Lightweight health checks confirm each internal listener accepts connections.
3. `kafka-init` waits for all brokers, creates or validates `market-data`, and exits successfully.
4. `market-data-worker` starts only after `kafka-init` succeeds.
5. The worker asks `MarketDataService` for each configured canonical quote.
6. Existing quote caching prevents excess provider calls inside the configured cache lifetime.
7. The worker compares the canonical observation fingerprint with its last successful publication for that symbol.
8. New observations become `MarketDataEvent` quote envelopes. `observed_at` comes from the provider record and `ingested_at` is assigned when the envelope is formed.
9. `KafkaEventProducer` publishes with the canonical symbol key and waits for broker acknowledgement.
10. Only acknowledged events update the worker's duplicate-suppression state.
11. Shutdown sets the stop event, ends the current bounded cycle, and flushes the producer.

## Step 1 interfaces and configuration

New settings:

- `MARKET_DATA_WORKER_INTERVAL_SECONDS`: positive polling interval, with a development default that does not flood Yahoo or Kafka.
- `MARKET_DATA_WORKER_SYMBOLS`: comma-separated symbols drawn from the existing supported universe.

The worker accepts a publisher protocol rather than a Yahoo implementation. Existing `MarketDataProvider`, `MarketDataService`, `MarketDataEvent`, and `KafkaEventProducer` interfaces remain authoritative.

## Step 1 error handling and edge cases

- Reject an empty configured symbol universe at startup with a clear error.
- Reject non-positive polling intervals.
- Normalize duplicate aliases before polling.
- Continue a cycle when one provider request fails.
- Do not mark an observation published when Kafka delivery fails.
- Log cycle counts and per-symbol failures without logging serialized payloads.
- Treat naive provider timestamps through the existing event conversion, which normalizes them to UTC.
- Permit the next cycle to retry after a transient Yahoo or Kafka failure.
- Keep signal handlers at the module entry point so the worker class stays deterministic in tests.

## Step 1 performance considerations

- Use a small default development universe rather than all NIFTY 50 symbols.
- Reuse one provider, service, publisher, and Kafka producer for the process lifetime.
- Retain existing quote-cache semantics.
- Poll symbols sequentially because the external provider is the limiting dependency and the development universe is intentionally small.
- Suppress only exact repeated observations. Do not infer market freshness or discard changed quotes.
- Remove recurring Kafka CLI JVM health probes to preserve broker CPU and memory.

## Step 1 verification sequence

1. Run focused Kafka and worker unit tests.
2. Run all backend tests.
3. Run Ruff on the backend.
4. Validate the resolved Compose configuration.
5. Stop the Kafka services while retaining volumes.
6. Start all Kafka brokers and topic initialization.
7. Verify all three health states and inspect KRaft quorum status.
8. Verify `market-data` has 6 partitions, replication factor 3, and min ISR 2.
9. Run the synthetic producer-to-consumer smoke test.
10. Restart the entire Kafka group without deleting volumes.
11. Recheck quorum, topic metadata, and the synthetic smoke path.
12. Restart one broker, wait for it to become healthy, and recheck quorum and in-sync replicas.
13. Start the worker and bounded live-ingestion consumer.
14. Verify at least two real quote events, delivery metadata, unique event IDs, observation timestamps, ingestion timestamps, partitions, offsets, and consumer group.
15. Verify the API health endpoint and one existing market-data endpoint.

If any critical Step 1 check fails, stop with no Spark files, dependencies, or services added.

## Step 2 architecture

Step 2 is conditional on the completed Step 1 gate.

```text
market-data Kafka partitions
            |
            v
Spark Structured Streaming query
            |
            v
validated quote observations by symbol and event time
            |
            v
log return, rolling return, rolling volatility, RVOL
            |
            v
observable console and durable development output
```

Docker topology:

- one Spark master
- two Spark workers registered with the master
- one independently restartable streaming driver
- a persistent checkpoint volume

## Step 2 files and modules

### `spark/Dockerfile`

Build one reproducible Spark image with the Kafka Structured Streaming connector version matched to the Spark and Scala versions. The image will be shared by master, workers, and driver.

### `spark/streaming_job.py`

Define pure helpers for event schema, parsing, timestamp selection, validation, and feature expressions, plus the executable Structured Streaming query.

The job will:

- read the real Kafka topic with explicit bootstrap servers and starting-offset behavior
- expose Kafka topic, partition, offset, and message timestamp columns
- parse the existing JSON envelope using an explicit schema
- keep valid quote events and route malformed records to an observable rejected-record output
- use `observed_at` as event time with a bounded watermark
- compute log return and rolling features by symbol using event-time windows where supported by streaming semantics
- configure a stable query name and checkpoint location
- write observable development output without adding a warehouse or database

### `spark/tests/test_streaming_job.py`

Test pure parsing and feature helpers with a local Spark session:

- valid event parsing
- malformed event classification
- observation timestamp preservation
- log-return calculation
- rolling-return calculation
- rolling-volatility calculation
- RVOL calculation where volume history is available
- explicit Kafka source and checkpoint configuration

### `docker-compose.yml`

Add master, two workers, and the streaming driver only after Step 1 passes. The driver will depend on successful Kafka topic initialization and Spark master availability. Named volumes will retain checkpoints and any development output required for validation.

### Documentation

Document topology, Kafka source options, partition visibility, checkpoint behavior, calculations, startup, worker inspection, query inspection, restart proof, malformed-record handling, and known local-development limits. Include the architecture diagram above.

## Step 2 data flow and calculations

1. Spark reads key, value, Kafka timestamp, topic, partition, and offset.
2. The value is parsed against the version 1 event schema.
3. Invalid JSON, unknown schema versions, missing quote fields, and invalid timestamps are separated from valid observations.
4. Valid quote observations retain event ID, symbol, source, observed time, ingestion time, price, previous close, and volume.
5. Records are repartitioned by symbol so symbol histories stay together across executors.
6. Feature computation produces:
   - log return: natural log of current price divided by the preceding price
   - rolling return: current price divided by the earliest price in the configured window minus one
   - rolling volatility: sample standard deviation of log returns in the configured window
   - RVOL: current volume divided by average volume in the configured window
7. Output includes Kafka partition and offset so distributed source work remains visible.
8. Checkpoints retain source offsets and query state across driver restarts.

## Step 2 error handling and edge cases

- Never silently drop malformed events. Count and expose them separately.
- Exclude non-quote event types from price features without treating them as malformed.
- Avoid division by zero or logarithms of non-positive prices.
- Return null features until enough history exists.
- Use deterministic checkpoint and query names. Reject accidental concurrent use of the same checkpoint.
- Keep event-time lateness policy explicit.
- Do not claim exactly-once behavior for console output. Validate offset recovery from checkpoints instead.

## Step 2 performance considerations

- Match Kafka partition parallelism to the existing six partitions.
- Run two workers with explicit cores and memory that fit the remaining Docker Desktop capacity.
- Avoid collecting streaming data to the driver for calculations.
- Keep state windows bounded and use a watermark to limit retained state.
- Use a development trigger interval that produces observable batches without busy polling.

## Step 2 verification sequence

1. Run local Spark unit tests for parsing and feature calculations.
2. Run all backend tests and Ruff again.
3. Validate Compose configuration.
4. Start the Spark master and both workers.
5. Verify both workers are registered through Spark's master API or UI.
6. Start the streaming driver against the real `market-data` topic.
7. Verify the query is active and reports Kafka partitions and offsets.
8. Observe computed features from real worker-produced events.
9. Verify checkpoint files and committed source progress exist.
10. Restart only the streaming driver.
11. Verify the same checkpoint is reused and previously completed offsets are not replayed from the beginning.
12. Confirm work appears on both Spark workers through executor and task diagnostics.

## Scope exclusions

No Snowflake, Iceberg, Kubernetes, Schema Registry, Avro, Protobuf, Kafka UI, new frontend behavior, new market-data source, expanded symbol catalogue, database schema change, analytics refactor, or API read-path change belongs to this work.

## Implementation order

1. Apply and verify the lightweight Kafka health check.
2. Complete clean-start, full-restart, individual-restart, quorum, topic, and synthetic smoke proofs.
3. Implement worker configuration, worker loop, focused tests, Compose service, live smoke script, and docs.
4. Run every Step 1 acceptance check and record evidence.
5. If and only if Step 1 is fully green, add the Spark image, topology, job, tests, and docs.
6. Run the full Step 2 distributed-execution and checkpoint-recovery proof.
7. Leave all completed changes uncommitted for review.
