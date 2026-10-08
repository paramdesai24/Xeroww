"""Snowflake implementation of the warehouse ingestion lifecycle."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC
from types import TracebackType
from typing import Any, Protocol, Self

from api.warehouse.ingestion import (
    BeginLoadRequest,
    LoadSnapshot,
    LoadState,
    MergeAccounting,
    WarehouseLifecycleError,
    WarehouseLoadHandle,
)
from api.warehouse.market_features import MarketFeatureRecord
from api.warehouse.snowflake_config import SnowflakeConfig


class SnowflakeConnectionError(RuntimeError):
    """Raised when the connector cannot create a Snowflake session."""


class SnowflakeLoadCollisionError(WarehouseLifecycleError):
    """Raised when a load ID already exists in the warehouse ledger."""


class SnowflakeLoadSession(Protocol):
    """High-level session operations used by the warehouse orchestrator."""

    def begin(self, request: BeginLoadRequest) -> None: ...

    def stage(self, records: Sequence[MarketFeatureRecord]) -> None: ...

    def merge(self, source_record_count: int) -> MergeAccounting: ...

    def complete(self) -> None: ...

    def fail(self, request: BeginLoadRequest, reason: str) -> None: ...

    def close(self) -> None: ...


class SnowflakeSessionFactory(Protocol):
    def open(self, config: SnowflakeConfig, load_id: str) -> SnowflakeLoadSession: ...


def _execute(
    connection: Any, sql: str, parameters: tuple[Any, ...] | None = None
) -> Any:
    cursor = connection.cursor()
    try:
        if parameters is None:
            cursor.execute(sql)
        else:
            cursor.execute(sql, parameters)
        row = cursor.fetchone() if cursor.description else None
        return row, cursor.rowcount
    finally:
        cursor.close()


class ConnectorSnowflakeSession:
    """One connector session and transaction for one bounded load attempt."""

    _STAGING_COLUMNS = (
        "record_key",
        "logical_window_key",
        "feature_contract_version",
        "window_start",
        "window_end",
        "symbol",
        "source",
        "observation_count",
        "log_return",
        "rolling_return",
        "rolling_volatility",
        "relative_volume",
        "kafka_partitions",
        "max_kafka_offset",
        "feature_batch_id",
        "source_file",
        "source_file_sha256",
        "load_id",
    )

    def __init__(self, connection: Any, config: SnowflakeConfig, load_id: str) -> None:
        self.connection = connection
        self.config = config
        self._active_load_id = load_id
        suffix = hashlib.sha256(load_id.encode("utf-8")).hexdigest()[:16].upper()
        self.staging_table = f'"XEROWW_FEATURE_STAGE_{suffix}"'

    def begin(self, request: BeginLoadRequest) -> None:
        create_stage = f"""
            CREATE TEMPORARY TABLE {self.staging_table} (
                record_key VARCHAR(64) NOT NULL,
                logical_window_key VARCHAR(64) NOT NULL,
                feature_contract_version NUMBER(38, 0) NOT NULL,
                window_start TIMESTAMP_NTZ NOT NULL,
                window_end TIMESTAMP_NTZ NOT NULL,
                symbol VARCHAR NOT NULL,
                source VARCHAR NOT NULL,
                observation_count NUMBER(38, 0) NOT NULL,
                log_return DOUBLE NOT NULL,
                rolling_return DOUBLE,
                rolling_volatility DOUBLE,
                relative_volume DOUBLE,
                kafka_partitions ARRAY NOT NULL,
                max_kafka_offset NUMBER(38, 0) NOT NULL,
                feature_batch_id NUMBER(38, 0) NOT NULL,
                source_file VARCHAR NOT NULL,
                source_file_sha256 VARCHAR(64) NOT NULL,
                load_id VARCHAR(128) NOT NULL
            )
        """
        _execute(self.connection, create_stage)
        existing, _ = _execute(
            self.connection,
            f"SELECT COUNT(*) FROM {self.config.batch_table_sql} WHERE load_id = %s",
            (request.load_id,),
        )
        if existing and int(existing[0]) > 0:
            raise SnowflakeLoadCollisionError(
                f"Snowflake load_id already exists: {request.load_id}"
            )
        _execute(self.connection, "BEGIN")
        _execute(
            self.connection,
            f"""
                INSERT INTO {self.config.batch_table_sql} (
                    load_id, feature_batch_id, source_path, source_manifest_hash,
                    source_record_count, load_started_at, status, destination_table
                ) VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP(), 'STARTED', %s)
            """,
            (
                request.load_id,
                request.feature_batch_id,
                str(request.batch_dir),
                request.manifest_hash,
                request.source_record_count,
                self.config.feature_table,
            ),
        )

    def stage(self, records: Sequence[MarketFeatureRecord]) -> None:
        placeholders = ", ".join(["%s"] * 12 + ["PARSE_JSON(%s)::ARRAY"] + ["%s"] * 5)
        sql = (
            f"INSERT INTO {self.staging_table} "
            f"({', '.join(self._STAGING_COLUMNS)}) VALUES ({placeholders})"
        )
        values = [self._record_values(record) for record in records]
        cursor = self.connection.cursor()
        try:
            cursor.executemany(sql, values)
        finally:
            cursor.close()
        self._update_status("STARTED", "STAGED")

    def merge(self, source_record_count: int) -> MergeAccounting:
        counts, _ = _execute(
            self.connection,
            f"""
                SELECT
                    COUNT(*) AS source_count,
                    COUNT(DISTINCT staged.record_key) AS unique_source_count,
                    COUNT(DISTINCT IFF(fact.record_key IS NOT NULL, staged.record_key, NULL))
                        AS existing_unique_count
                FROM {self.staging_table} AS staged
                LEFT JOIN {self.config.feature_table_sql} AS fact
                    ON fact.record_key = staged.record_key
            """,
        )
        if counts is None or int(counts[0]) != source_record_count:
            raise RuntimeError(
                "Snowflake staging count does not match the validated source count"
            )
        inserted = int(counts[1]) - int(counts[2])
        duplicates = source_record_count - inserted
        accounting = MergeAccounting(
            source_record_count=source_record_count,
            inserted_record_count=inserted,
            duplicate_record_count=duplicates,
            rejected_record_count=0,
        )
        columns = ", ".join(self._STAGING_COLUMNS)
        insert_values = ", ".join(
            f"source.{column}" for column in self._STAGING_COLUMNS
        )
        _execute(
            self.connection,
            f"""
                MERGE INTO {self.config.feature_table_sql} AS target
                USING (
                    SELECT {columns}
                    FROM {self.staging_table}
                    QUALIFY ROW_NUMBER() OVER (
                        PARTITION BY record_key
                        ORDER BY source_file, source_file_sha256, load_id
                    ) = 1
                ) AS source
                ON target.record_key = source.record_key
                WHEN NOT MATCHED THEN INSERT (
                    {columns}, warehouse_ingested_at
                ) VALUES (
                    {insert_values}, CURRENT_TIMESTAMP()
                )
            """,
        )
        _, rowcount = _execute(
            self.connection,
            f"""
                UPDATE {self.config.batch_table_sql}
                SET inserted_record_count = %s,
                    duplicate_record_count = %s,
                    rejected_record_count = %s,
                    status = 'MERGED'
                WHERE load_id = %s AND status = 'STAGED'
            """,
            (
                accounting.inserted_record_count,
                accounting.duplicate_record_count,
                accounting.rejected_record_count,
                self._load_id(records_required=False),
            ),
        )
        if rowcount != 1:
            raise WarehouseLifecycleError("Snowflake load was not in STAGED state")
        return accounting

    def complete(self) -> None:
        load_id = self._load_id(records_required=False)
        _, rowcount = _execute(
            self.connection,
            f"""
                UPDATE {self.config.batch_table_sql}
                SET status = 'COMPLETED', load_completed_at = CURRENT_TIMESTAMP()
                WHERE load_id = %s AND status = 'MERGED'
            """,
            (load_id,),
        )
        if rowcount != 1:
            raise WarehouseLifecycleError("Snowflake load was not in MERGED state")
        self.connection.commit()

    def fail(self, request: BeginLoadRequest, reason: str) -> None:
        self.connection.rollback()
        _execute(self.connection, "BEGIN")
        _execute(
            self.connection,
            f"""
                INSERT INTO {self.config.batch_table_sql} (
                    load_id, feature_batch_id, source_path, source_manifest_hash,
                    source_record_count, load_started_at, load_completed_at,
                    status, destination_table, failure_reason
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(),
                    'FAILED', %s, %s
                )
            """,
            (
                request.load_id,
                request.feature_batch_id,
                str(request.batch_dir),
                request.manifest_hash,
                request.source_record_count,
                self.config.feature_table,
                reason,
            ),
        )
        self.connection.commit()

    def close(self) -> None:
        self.connection.close()

    def _update_status(self, expected: str, target: str) -> None:
        load_id = self._load_id(records_required=False)
        _, rowcount = _execute(
            self.connection,
            f"UPDATE {self.config.batch_table_sql} SET status = %s "
            "WHERE load_id = %s AND status = %s",
            (target, load_id, expected),
        )
        if rowcount != 1:
            raise WarehouseLifecycleError(
                f"Snowflake load was not in expected {expected} state"
            )

    def _load_id(self, *, records_required: bool) -> str:
        del records_required
        return self._active_load_id

    @staticmethod
    def _record_values(record: MarketFeatureRecord) -> tuple[Any, ...]:
        return (
            record.record_key,
            record.logical_window_key,
            record.feature_contract_version,
            record.window_start.astimezone(UTC).replace(tzinfo=None),
            record.window_end.astimezone(UTC).replace(tzinfo=None),
            record.symbol,
            record.source,
            record.observation_count,
            record.log_return,
            record.rolling_return,
            record.rolling_volatility,
            record.relative_volume,
            json.dumps(list(record.kafka_partitions), separators=(",", ":")),
            record.max_kafka_offset,
            record.feature_batch_id,
            record.source_file,
            record.source_file_sha256,
            record.load_id,
        )


class ConnectorSnowflakeSessionFactory:
    """Create connector-backed sessions without importing Snowflake at module load."""

    def open(self, config: SnowflakeConfig, load_id: str) -> SnowflakeLoadSession:
        try:
            import snowflake.connector
        except ImportError as exc:
            raise SnowflakeConnectionError(
                "snowflake-connector-python is required for Snowflake loading"
            ) from exc
        try:
            connection = snowflake.connector.connect(**config.connection_parameters())
        except Exception as exc:
            raise SnowflakeConnectionError(
                f"Unable to connect to Snowflake: {type(exc).__name__}"
            ) from exc
        return ConnectorSnowflakeSession(connection, config, load_id)


@dataclass
class _ActiveLoad:
    request: BeginLoadRequest
    handle: WarehouseLoadHandle
    session: SnowflakeLoadSession
    state: LoadState
    staged_count: int = 0
    accounting: MergeAccounting | None = None
    failure_reason: str | None = None


class SnowflakeWarehouseIngestion:
    """Real Snowflake orchestration implementing the warehouse protocol semantics."""

    def __init__(
        self,
        config: SnowflakeConfig,
        session_factory: SnowflakeSessionFactory | None = None,
    ) -> None:
        config.validate_for_connection()
        self.config = config
        self.session_factory = session_factory or ConnectorSnowflakeSessionFactory()
        self._active: dict[str, _ActiveLoad] = {}
        self._finished: dict[str, LoadSnapshot] = {}

    def __enter__(self) -> Self:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        self.close()

    def begin_load(self, request: BeginLoadRequest) -> WarehouseLoadHandle:
        if request.load_id in self._active or request.load_id in self._finished:
            raise SnowflakeLoadCollisionError(
                f"Load ID already used: {request.load_id}"
            )
        session = self.session_factory.open(self.config, request.load_id)
        handle = WarehouseLoadHandle(request.load_id, request.feature_batch_id)
        try:
            session.begin(request)
        except Exception:
            session.close()
            raise
        self._active[request.load_id] = _ActiveLoad(
            request=request,
            handle=handle,
            session=session,
            state=LoadState.STARTED,
        )
        return handle

    def stage_records(
        self,
        handle: WarehouseLoadHandle,
        records: Sequence[MarketFeatureRecord],
    ) -> LoadSnapshot:
        load = self._require_state(handle, LoadState.STARTED)
        staged = tuple(records)
        if len(staged) != load.request.source_record_count:
            raise ValueError("Staged record count must match source_record_count")
        if any(
            record.load_id != handle.load_id
            or record.feature_batch_id != handle.feature_batch_id
            for record in staged
        ):
            raise ValueError("Staged record metadata does not match the load handle")
        load.session.stage(staged)
        load.staged_count = len(staged)
        load.state = LoadState.STAGED
        return self._snapshot(load)

    def merge_staged(self, handle: WarehouseLoadHandle) -> MergeAccounting:
        load = self._require_state(handle, LoadState.STAGED)
        accounting = load.session.merge(load.request.source_record_count)
        load.accounting = accounting
        load.state = LoadState.MERGED
        return accounting

    def complete_load(self, handle: WarehouseLoadHandle) -> LoadSnapshot:
        load = self._require_state(handle, LoadState.MERGED)
        load.session.complete()
        load.state = LoadState.COMPLETED
        snapshot = self._snapshot(load)
        load.session.close()
        del self._active[handle.load_id]
        self._finished[handle.load_id] = snapshot
        return snapshot

    def fail_load(self, handle: WarehouseLoadHandle, reason: str) -> LoadSnapshot:
        load = self._get_active(handle)
        if load.state not in {LoadState.STARTED, LoadState.STAGED, LoadState.MERGED}:
            self._invalid_transition(load.state, LoadState.FAILED, handle.load_id)
        sanitized = self._sanitize_failure(reason)
        try:
            load.session.fail(load.request, sanitized)
        finally:
            load.session.close()
        load.state = LoadState.FAILED
        load.failure_reason = sanitized
        snapshot = self._snapshot(load)
        del self._active[handle.load_id]
        self._finished[handle.load_id] = snapshot
        return snapshot

    def get_state(self, load_id: str) -> LoadState:
        if load_id in self._active:
            return self._active[load_id].state
        if load_id in self._finished:
            return self._finished[load_id].state
        return LoadState.NOT_STARTED

    def get_load(self, handle: WarehouseLoadHandle) -> LoadSnapshot:
        if handle.load_id in self._finished:
            snapshot = self._finished[handle.load_id]
            if snapshot.handle != handle:
                raise WarehouseLifecycleError("Load handle does not match stored load")
            return snapshot
        return self._snapshot(self._get_active(handle))

    def close(self) -> None:
        for load in list(self._active.values()):
            try:
                load.session.close()
            finally:
                self._active.pop(load.handle.load_id, None)

    def _get_active(self, handle: WarehouseLoadHandle) -> _ActiveLoad:
        load = self._active.get(handle.load_id)
        if load is None or load.handle != handle:
            raise WarehouseLifecycleError(f"Active load not found: {handle.load_id}")
        return load

    def _require_state(
        self,
        handle: WarehouseLoadHandle,
        required: LoadState,
    ) -> _ActiveLoad:
        load = self._get_active(handle)
        if load.state is not required:
            self._invalid_transition(load.state, required, handle.load_id)
        return load

    @staticmethod
    def _invalid_transition(
        current: LoadState, target: LoadState, load_id: str
    ) -> None:
        raise WarehouseLifecycleError(
            f"Invalid warehouse load transition: {current.value} -> {target.value} "
            f"for load {load_id}"
        )

    @staticmethod
    def _sanitize_failure(reason: str) -> str:
        if not isinstance(reason, str) or not reason.strip():
            raise ValueError("failure reason must be non-empty")
        return " ".join(reason.strip().split())[:1000]

    @staticmethod
    def _snapshot(load: _ActiveLoad) -> LoadSnapshot:
        return LoadSnapshot(
            handle=load.handle,
            state=load.state,
            source_record_count=load.request.source_record_count,
            staged_record_count=load.staged_count,
            accounting=load.accounting,
            failure_reason=load.failure_reason,
        )
