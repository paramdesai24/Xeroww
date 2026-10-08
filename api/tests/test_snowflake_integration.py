from __future__ import annotations

import json
import os
import time
from dataclasses import replace
from pathlib import Path

import pytest

from api.warehouse.load_features import load_one_feature_batch
from api.warehouse.snowflake_config import SnowflakeConfig
from api.warehouse.snowflake_ingestion import (
    SnowflakeLoadCollisionError,
    SnowflakeWarehouseIngestion,
)

pytestmark = pytest.mark.skipif(
    os.getenv("XEROWW_SNOWFLAKE_INTEGRATION") != "1",
    reason="set XEROWW_SNOWFLAKE_INTEGRATION=1 to run Snowflake integration tests",
)


def _write_batch(
    output_root: Path,
    batch_id: int,
    *,
    symbol: str,
    log_return: float,
    max_kafka_offset: int,
) -> None:
    batch_dir = output_root / f"batch_id={batch_id}"
    batch_dir.mkdir()
    (batch_dir / "_SUCCESS").touch()
    record = {
        "window_start": "2026-09-29T03:30:00.000Z",
        "window_end": "2026-09-29T03:35:00.000Z",
        "symbol": symbol,
        "source": "integration-test",
        "observation_count": 5,
        "log_return": log_return,
        "rolling_return": None,
        "rolling_volatility": None,
        "relative_volume": None,
        "kafka_partitions": [0],
        "max_kafka_offset": max_kafka_offset,
    }
    (batch_dir / "part-00000.json").write_text(
        json.dumps(record) + "\n",
        encoding="utf-8",
    )


def _apply_repository_ddl(connection: object, config: SnowflakeConfig) -> None:
    if config.schema.upper() != "ANALYTICS":
        raise AssertionError(
            "The repository DDL targets the ANALYTICS schema; "
            "SNOWFLAKE_SCHEMA must be ANALYTICS"
        )
    ddl_path = (
        Path(__file__).parents[1]
        / "warehouse"
        / "sql"
        / "001_create_analytics_schema.sql"
    )
    connection.execute_string(ddl_path.read_text(encoding="utf-8"))


def test_real_snowflake_ingestion_acceptance(tmp_path: Path) -> None:
    import snowflake.connector

    batch_id = time.time_ns()
    revision_batch_id = batch_id + 1
    symbol = f"XEROWW_INTEGRATION_{batch_id}"
    first_load_id = f"integration-{batch_id}-first"
    duplicate_load_id = f"integration-{batch_id}-duplicate"
    revision_load_id = f"integration-{batch_id}-revision"
    failed_load_id = f"integration-{batch_id}-failed"
    retry_load_id = f"integration-{batch_id}-retry"
    load_ids = (
        first_load_id,
        duplicate_load_id,
        revision_load_id,
        failed_load_id,
        retry_load_id,
    )
    _write_batch(
        tmp_path,
        batch_id,
        symbol=symbol,
        log_return=0.001248,
        max_kafka_offset=batch_id,
    )
    _write_batch(
        tmp_path,
        revision_batch_id,
        symbol=symbol,
        log_return=0.002496,
        max_kafka_offset=revision_batch_id,
    )
    config = SnowflakeConfig.from_env()
    config.validate_for_connection()

    setup_connection = snowflake.connector.connect(**config.connection_parameters())
    try:
        _apply_repository_ddl(setup_connection, config)
    finally:
        setup_connection.close()

    verification_connection = None
    try:
        first = load_one_feature_batch(
            tmp_path,
            batch_id,
            first_load_id,
            warehouse=SnowflakeWarehouseIngestion(config),
        )
        duplicate = load_one_feature_batch(
            tmp_path,
            batch_id,
            duplicate_load_id,
            warehouse=SnowflakeWarehouseIngestion(config),
        )
        revision = load_one_feature_batch(
            tmp_path,
            revision_batch_id,
            revision_load_id,
            warehouse=SnowflakeWarehouseIngestion(config),
        )

        assert first.accounting is not None
        assert first.accounting.source_record_count == 1
        assert first.accounting.inserted_record_count == 1
        assert first.accounting.duplicate_record_count == 0
        assert duplicate.accounting is not None
        assert duplicate.accounting.source_record_count == 1
        assert duplicate.accounting.inserted_record_count == 0
        assert duplicate.accounting.duplicate_record_count == 1
        assert revision.accounting is not None
        assert revision.accounting.inserted_record_count == 1
        assert revision.accounting.duplicate_record_count == 0

        with pytest.raises(SnowflakeLoadCollisionError):
            load_one_feature_batch(
                tmp_path,
                batch_id,
                first_load_id,
                warehouse=SnowflakeWarehouseIngestion(config),
            )

        missing_table_config = replace(
            config,
            feature_table=f"MISSING_FACT_{batch_id}",
        )
        with pytest.raises(snowflake.connector.Error):
            load_one_feature_batch(
                tmp_path,
                batch_id,
                failed_load_id,
                warehouse=SnowflakeWarehouseIngestion(missing_table_config),
            )

        retry = load_one_feature_batch(
            tmp_path,
            batch_id,
            retry_load_id,
            warehouse=SnowflakeWarehouseIngestion(config),
        )
        assert retry.accounting is not None
        assert retry.accounting.inserted_record_count == 0
        assert retry.accounting.duplicate_record_count == 1

        verification_connection = snowflake.connector.connect(
            **config.connection_parameters()
        )
        cursor = verification_connection.cursor()
        try:
            cursor.execute(
                f"SELECT COUNT(*), COUNT(DISTINCT logical_window_key), "
                f"COUNT(DISTINCT record_key) FROM {config.feature_table_sql} "
                "WHERE symbol = %s",
                (symbol,),
            )
            assert cursor.fetchone() == (2, 1, 2)
            cursor.execute(
                f'SELECT load_id FROM "{config.database.upper()}".'
                f'"{config.schema.upper()}"."LATEST_MARKET_FEATURES" '
                "WHERE symbol = %s",
                (symbol,),
            )
            assert cursor.fetchone() == (revision_load_id,)
            cursor.execute(
                f"SELECT status FROM {config.batch_table_sql} WHERE load_id = %s",
                (failed_load_id,),
            )
            assert cursor.fetchone() == ("FAILED",)
            cursor.execute(
                f"SELECT status FROM {config.batch_table_sql} WHERE load_id = %s",
                (retry_load_id,),
            )
            assert cursor.fetchone() == ("COMPLETED",)
        finally:
            cursor.close()
    finally:
        if verification_connection is None:
            verification_connection = snowflake.connector.connect(
                **config.connection_parameters()
            )
        cursor = verification_connection.cursor()
        try:
            cursor.execute(
                f"DELETE FROM {config.feature_table_sql} WHERE symbol = %s",
                (symbol,),
            )
            placeholders = ", ".join(["%s"] * len(load_ids))
            cursor.execute(
                f"DELETE FROM {config.batch_table_sql} "
                f"WHERE load_id IN ({placeholders})",
                load_ids,
            )
            verification_connection.commit()
        finally:
            cursor.close()
            verification_connection.close()
