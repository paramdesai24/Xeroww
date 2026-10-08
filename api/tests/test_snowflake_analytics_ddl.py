"""Static validation for the offline Snowflake analytical schema artifact."""

import re
from pathlib import Path


DDL_PATH = Path("api/warehouse/sql/001_create_analytics_schema.sql")


def ddl() -> str:
    return DDL_PATH.read_text(encoding="utf-8")


def column_definition(sql: str, column: str) -> str:
    match = re.search(rf"^\s*{re.escape(column)}\s+(.+?)(?:,)?$", sql, re.MULTILINE)
    assert match, f"Missing column definition: {column}"
    return match.group(1).strip()


def test_expected_snowflake_objects_exist():
    sql = ddl()

    assert "CREATE SCHEMA IF NOT EXISTS ANALYTICS" in sql
    assert "CREATE TABLE IF NOT EXISTS ANALYTICS.FACT_MARKET_FEATURES" in sql
    assert "CREATE TABLE IF NOT EXISTS ANALYTICS.FEATURE_INGESTION_BATCHES" in sql
    assert "CREATE OR REPLACE VIEW ANALYTICS.LATEST_MARKET_FEATURES" in sql


def test_fact_columns_have_expected_snowflake_types_and_nullability():
    sql = ddl()
    required = {
        "record_key": "VARCHAR(64) NOT NULL",
        "logical_window_key": "VARCHAR(64) NOT NULL",
        "feature_contract_version": "NUMBER(38, 0) NOT NULL",
        "window_start": "TIMESTAMP_NTZ NOT NULL",
        "window_end": "TIMESTAMP_NTZ NOT NULL",
        "symbol": "VARCHAR NOT NULL",
        "source": "VARCHAR NOT NULL",
        "observation_count": "NUMBER(38, 0) NOT NULL",
        "log_return": "DOUBLE NOT NULL",
        "kafka_partitions": "ARRAY NOT NULL",
        "max_kafka_offset": "NUMBER(38, 0) NOT NULL",
        "feature_batch_id": "NUMBER(38, 0) NOT NULL",
        "source_file": "VARCHAR NOT NULL",
        "source_file_sha256": "VARCHAR(64) NOT NULL",
        "load_id": "VARCHAR(128) NOT NULL",
        "warehouse_ingested_at": "TIMESTAMP_TZ NOT NULL",
    }
    for column, expected in required.items():
        assert column_definition(sql, column).startswith(expected)

    for nullable_feature in ("rolling_return", "rolling_volatility", "relative_volume"):
        definition = column_definition(sql, nullable_feature)
        assert definition.startswith("DOUBLE")
        assert "NOT NULL" not in definition


def test_batch_ledger_columns_match_lifecycle_and_accounting_semantics():
    sql = ddl()

    assert column_definition(sql, "source_manifest_hash").startswith(
        "VARCHAR(64) NOT NULL"
    )
    assert column_definition(sql, "source_record_count").startswith(
        "NUMBER(38, 0) NOT NULL"
    )
    assert column_definition(sql, "load_started_at").startswith("TIMESTAMP_TZ NOT NULL")
    assert column_definition(sql, "status").startswith("VARCHAR(16) NOT NULL")
    assert column_definition(sql, "destination_table").startswith("VARCHAR NOT NULL")

    for deferred_value in (
        "inserted_record_count",
        "duplicate_record_count",
        "rejected_record_count",
        "load_completed_at",
        "failure_reason",
    ):
        assert "NOT NULL" not in column_definition(sql, deferred_value)

    for state in ("STARTED", "STAGED", "MERGED", "COMPLETED", "FAILED"):
        assert state in sql

    assert "loaded_record_count" not in sql
    assert "inserted_record_count" in sql


def test_latest_view_uses_deterministic_revision_ordering():
    sql = ddl()

    assert "PARTITION BY logical_window_key" in sql
    expected_order = re.compile(
        r"ORDER BY\s+"
        r"feature_batch_id DESC,\s+"
        r"max_kafka_offset DESC,\s+"
        r"observation_count DESC,\s+"
        r"warehouse_ingested_at DESC,\s+"
        r"record_key DESC",
        re.MULTILINE,
    )
    assert expected_order.search(sql)
    assert re.search(r"\)\s*=\s*1;", sql)


def test_provenance_is_preserved_without_fabricated_kafka_fields():
    sql = ddl()

    for column in (
        "feature_batch_id",
        "source_file",
        "source_file_sha256",
        "load_id",
        "warehouse_ingested_at",
        "source_manifest_hash",
    ):
        assert column_definition(sql, column)

    assert not re.search(r"^\s*kafka_topic\s+", sql, re.MULTILINE)
    assert not re.search(r"^\s*kafka_offsets\s+", sql, re.MULTILINE)


def test_ddl_stays_outside_postgresql_migrations_and_uses_no_foreign_dialect():
    sql = ddl().upper()

    assert DDL_PATH.parent == Path("api/warehouse/sql")
    assert not list(Path("api/database/migrations").rglob("*snowflake*"))
    for unrelated_sql in (
        "CREATE EXTENSION",
        " SERIAL",
        " JSONB",
        "PUBLIC.",
        "CREATE INDEX",
    ):
        assert unrelated_sql not in sql


def test_ddl_documents_identity_provenance_and_database_boundary():
    sql = ddl().lower()

    for statement in (
        "record_key idempotency is enforced by the loader",
        "shared by revisions of one logical window",
        "derived from the batch_id directory",
        "computed from the actual spark part-file bytes",
        "ordered source-file names and content hashes",
        "kafka topic is intentionally absent",
        "postgresql remains the operational application database",
    ):
        assert statement in sql
