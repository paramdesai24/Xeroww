-- Xeroww analytical feature warehouse for Snowflake.
-- PostgreSQL remains the operational application database and is not the
-- analytical feature warehouse.
-- Kafka topic is intentionally absent because it is not part of the current
-- Spark feature output contract.

CREATE SCHEMA IF NOT EXISTS ANALYTICS
    COMMENT = 'Analytical market feature data loaded from validated Spark output';

CREATE TABLE IF NOT EXISTS ANALYTICS.FACT_MARKET_FEATURES (
    record_key VARCHAR(64) NOT NULL
        COMMENT 'Application-computed identity for one exact feature revision',
    logical_window_key VARCHAR(64) NOT NULL
        COMMENT 'Application-computed identity shared by revisions of one logical window',
    feature_contract_version NUMBER(38, 0) NOT NULL,

    window_start TIMESTAMP_NTZ NOT NULL
        COMMENT 'UTC event-time window start',
    window_end TIMESTAMP_NTZ NOT NULL
        COMMENT 'UTC event-time window end',

    symbol VARCHAR NOT NULL,
    source VARCHAR NOT NULL,

    observation_count NUMBER(38, 0) NOT NULL,
    log_return DOUBLE NOT NULL,
    rolling_return DOUBLE,
    rolling_volatility DOUBLE,
    relative_volume DOUBLE,

    kafka_partitions ARRAY NOT NULL,
    max_kafka_offset NUMBER(38, 0) NOT NULL,

    feature_batch_id NUMBER(38, 0) NOT NULL
        COMMENT 'Spark micro-batch identifier derived from the batch_id directory',
    source_file VARCHAR NOT NULL,
    source_file_sha256 VARCHAR(64) NOT NULL
        COMMENT 'SHA-256 computed from the actual Spark part-file bytes',
    load_id VARCHAR(128) NOT NULL,
    warehouse_ingested_at TIMESTAMP_TZ NOT NULL
)
COMMENT = 'Immutable market feature revisions; record_key idempotency is enforced by the loader, not by a database uniqueness constraint';

CREATE TABLE IF NOT EXISTS ANALYTICS.FEATURE_INGESTION_BATCHES (
    load_id VARCHAR(128) NOT NULL
        COMMENT 'Caller-assigned identity for one warehouse load attempt',
    feature_batch_id NUMBER(38, 0) NOT NULL,
    source_path VARCHAR NOT NULL
        COMMENT 'Validated Spark feature batch directory',
    source_manifest_hash VARCHAR(64) NOT NULL
        COMMENT 'SHA-256 identifying the ordered source-file names and content hashes',
    source_record_count NUMBER(38, 0) NOT NULL
        COMMENT 'After merge, equals inserted plus duplicate plus rejected record counts',
    inserted_record_count NUMBER(38, 0)
        COMMENT 'New fact records inserted during merge; null until merge accounting exists',
    duplicate_record_count NUMBER(38, 0)
        COMMENT 'Source records whose record_key already existed; null until merge accounting exists',
    rejected_record_count NUMBER(38, 0)
        COMMENT 'Records rejected after staging; expected to be zero for the validated milestone',
    load_started_at TIMESTAMP_TZ NOT NULL,
    load_completed_at TIMESTAMP_TZ,
    status VARCHAR(16) NOT NULL
        COMMENT 'Lifecycle state: STARTED, STAGED, MERGED, COMPLETED, or FAILED',
    destination_table VARCHAR NOT NULL,
    failure_reason VARCHAR
)
COMMENT = 'One row per warehouse load attempt; the loader owns lifecycle transitions and accounting invariants';

CREATE OR REPLACE VIEW ANALYTICS.LATEST_MARKET_FEATURES
    COMMENT = 'Latest deterministic Spark revision for each logical feature window'
AS
SELECT
    record_key,
    logical_window_key,
    feature_contract_version,
    window_start,
    window_end,
    symbol,
    source,
    observation_count,
    log_return,
    rolling_return,
    rolling_volatility,
    relative_volume,
    kafka_partitions,
    max_kafka_offset,
    feature_batch_id,
    source_file,
    source_file_sha256,
    load_id,
    warehouse_ingested_at
FROM ANALYTICS.FACT_MARKET_FEATURES
QUALIFY ROW_NUMBER() OVER (
    PARTITION BY logical_window_key
    ORDER BY
        feature_batch_id DESC,
        max_kafka_offset DESC,
        observation_count DESC,
        warehouse_ingested_at DESC,
        record_key DESC
) = 1;
