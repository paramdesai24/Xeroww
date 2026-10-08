# Kafka to Spark market-data streaming

## Purpose

Xeroww now has a development path from live provider observations to distributed market feature computation. This layer proves the streaming boundary and operational behavior. It does not replace the existing API analytics path and does not add a warehouse or lakehouse.

## Architecture

```text
YahooFinanceProvider
        |
MarketDataService
        |
market-data worker
        |
        v
3-broker KRaft Kafka cluster
market-data topic, 6 partitions, RF 3, min ISR 2
        |
        v
Spark Structured Streaming driver
        |
        +-------------------+
        |                   |
        v                   v
Spark worker 1        Spark worker 2
        |                   |
        +---------+---------+
                  |
                  v
JSON feature batches and rejected-record batches
```

Kafka and Spark remain separate operational layers. The API does not wait for Kafka publishing or Spark processing. The live ingestion worker is a separate process and the Spark driver consumes the canonical event envelope already published to Kafka.

## Spark topology

The Compose environment contains:

- one Spark master at `spark://spark-master:7077`
- two Spark workers with one core and 640 MB each
- one standalone Spark streaming driver
- one executor per worker, with one core and 512 MB per executor
- a master web interface exposed at `http://localhost:18080`

The master web interface and its `/json/` endpoint show worker registration, executor allocation, active applications, cores, and memory.

## Kafka source

The driver reads the real `market-data` topic through Spark's Kafka source. Source configuration is explicit:

- bootstrap servers list all three brokers
- starting offsets default to `earliest` for a new checkpoint
- data loss fails the query instead of silently skipping records
- the feature and rejected-record queries use separate group suffixes
- Kafka topic, partition, offset, and broker timestamp are retained in processing data

Once a checkpoint exists, Spark resumes from checkpointed offsets. The configured starting offset applies only when no checkpoint exists.

## Event handling

The streaming job parses the versioned JSON event envelope with an explicit Spark schema. A quote is valid only when the expected event type and schema revision are present, timestamps parse correctly, identifiers are present, and price values are positive.

Valid quotes preserve:

- event identifier
- symbol and provider source
- observation timestamp
- ingestion timestamp
- price, previous close, and volume
- Kafka topic, partition, offset, and timestamp

Malformed records are written by a separate checkpointed query under the rejected output. Non-quote event types are intentionally ignored by this market feature job.

## Streaming features

Valid observations are grouped by symbol, source, and sliding event-time window. The job calculates:

- log return from price and previous close
- rolling return from the first and latest price in the window
- sample standard deviation of log returns as rolling volatility
- latest volume divided by average window volume as relative volume

Feature output also includes observation count, contributing Kafka partitions, and the maximum Kafka offset seen in the window. These fields make source partition participation visible during validation.

The default feature window is five minutes, sliding every minute, with a two-minute event-time watermark. These values are development defaults and can be changed with environment variables.

## Checkpointing and output

Named Docker volumes retain Spark state and observable output:

- `spark_checkpoints` contains independent feature and rejected-record checkpoints
- `spark_output` contains JSON output grouped by query and micro-batch identifier
- `spark_ivy_cache` retains the Kafka connector dependencies across container recreation
- each worker has its own work volume

The driver logs every completed batch with its output name, batch identifier, row count, Spark partition count, and output path. Non-empty batches are also printed in tabular form.

## Start and inspect

Start the streaming path with:

```powershell
docker compose up -d --build kafka-1 kafka-2 kafka-3 kafka-init redis market-data-worker spark-master spark-worker-1 spark-worker-2 spark-streaming
```

Inspect service health:

```powershell
docker compose ps
```

Inspect the Spark master at `http://localhost:18080`. The page should show two alive workers and an active application with two executors.

Inspect driver output:

```powershell
docker compose logs -f spark-streaming
```

Inspect checkpoint and output files:

```powershell
docker compose exec spark-streaming sh -c "find /opt/spark/checkpoints -type f | sort"
docker compose exec spark-streaming sh -c "find /opt/spark/output -type f | sort"
```

## Verify checkpoint recovery

1. Wait until the driver logs at least one completed feature batch.
2. Record the latest feature checkpoint offset file and output batch identifier.
3. Restart only the streaming driver with `docker compose restart spark-streaming`.
4. Wait for the application to register again with the master.
5. Confirm later batch identifiers and checkpoint offset files are created.
6. Confirm the job does not restart from Kafka offset zero when the checkpoint already records later offsets.

Do not delete the `spark_checkpoints` volume during this test. Removing that volume deliberately creates a new stream state.

## Configuration

The main runtime settings are:

- `KAFKA_BOOTSTRAP_SERVERS`
- `KAFKA_MARKET_DATA_TOPIC`
- `SPARK_KAFKA_CONSUMER_GROUP`
- `SPARK_CHECKPOINT_ROOT`
- `SPARK_OUTPUT_ROOT`
- `SPARK_QUERY_NAME`
- `SPARK_STARTING_OFFSETS`
- `SPARK_TRIGGER_INTERVAL`
- `SPARK_FEATURE_WINDOW`
- `SPARK_FEATURE_SLIDE`
- `SPARK_EVENT_WATERMARK`
- `SPARK_LOG_LEVEL`

## Known limitations

- The output is development JSON for inspection, not a production serving store.
- The event contract is JSON without Schema Registry, Avro, or Protobuf.
- The feature windows are intentionally small demonstrations rather than finalized quantitative definitions.
- Explicit Kafka group identifiers require only one active driver for each query name and checkpoint.
- Local Docker Desktop resource limits can delay worker heartbeats when all Kafka and Spark JVMs start simultaneously. The development configuration uses a longer network timeout to tolerate short host pauses.
- Dependency artifacts are downloaded from Maven the first time the Spark driver starts, then retained in the Ivy cache volume.
