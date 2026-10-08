from __future__ import annotations

import json
from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path

import pytest

from api.warehouse.ingestion import (
    BeginLoadRequest,
    LoadState,
    MergeAccounting,
    WarehouseLifecycleError,
)
from api.warehouse.load_features import load_one_feature_batch
from api.warehouse.market_features import MarketFeatureRecord
from api.warehouse.snowflake_config import (
    SnowflakeConfig,
    SnowflakeConfigurationError,
)
from api.warehouse.snowflake_ingestion import (
    SnowflakeLoadCollisionError,
    SnowflakeWarehouseIngestion,
)


def _config(**overrides: object) -> SnowflakeConfig:
    values: dict[str, object] = {
        "enabled": True,
        "account": "test-account",
        "user": "test-user",
        "password": "test-password",
        "warehouse": "test_warehouse",
        "database": "test_database",
        "schema": "analytics",
        "role": "test_role",
    }
    values.update(overrides)
    return SnowflakeConfig(**values)


def _spark_record(**overrides: object) -> dict[str, object]:
    record: dict[str, object] = {
        "window_start": "2026-09-29T03:30:00.000Z",
        "window_end": "2026-09-29T03:35:00.000Z",
        "symbol": "AAPL",
        "source": "yahoo",
        "observation_count": 5,
        "log_return": 0.001248,
        "rolling_return": None,
        "rolling_volatility": None,
        "relative_volume": None,
        "kafka_partitions": [1, 0],
        "max_kafka_offset": 874,
    }
    record.update(overrides)
    return record


def _write_batch(root: Path, batch_id: int = 87) -> Path:
    batch_dir = root / f"batch_id={batch_id}"
    batch_dir.mkdir()
    (batch_dir / "_SUCCESS").touch()
    (batch_dir / "part-00000.json").write_text(
        json.dumps(_spark_record()) + "\n",
        encoding="utf-8",
    )
    return batch_dir


@dataclass
class FakeSession:
    accounting: MergeAccounting = field(
        default_factory=lambda: MergeAccounting(1, 1, 0, 0)
    )
    merge_error: Exception | None = None
    calls: list[str] = field(default_factory=list)
    records: tuple[MarketFeatureRecord, ...] = ()
    failure_reason: str | None = None

    def begin(self, request: BeginLoadRequest) -> None:
        self.calls.append("begin")

    def stage(self, records: Sequence[MarketFeatureRecord]) -> None:
        self.calls.append("stage")
        self.records = tuple(records)

    def merge(self, source_record_count: int) -> MergeAccounting:
        self.calls.append("merge")
        if self.merge_error is not None:
            raise self.merge_error
        assert source_record_count == self.accounting.source_record_count
        return self.accounting

    def complete(self) -> None:
        self.calls.append("complete")

    def fail(self, request: BeginLoadRequest, reason: str) -> None:
        self.calls.append("fail")
        self.failure_reason = reason

    def close(self) -> None:
        self.calls.append("close")


@dataclass
class FakeFactory:
    session: FakeSession
    opens: int = 0

    def open(self, config: SnowflakeConfig, load_id: str) -> FakeSession:
        self.opens += 1
        return self.session


def test_config_is_optional_and_validated_before_connecting() -> None:
    factory = FakeFactory(FakeSession())
    with pytest.raises(SnowflakeConfigurationError, match="disabled"):
        SnowflakeWarehouseIngestion(
            SnowflakeConfig(enabled=False),
            session_factory=factory,
        )
    assert factory.opens == 0


def test_config_supports_password_without_exposing_secret() -> None:
    config = _config()
    parameters = config.connection_parameters()
    assert parameters["password"] == "test-password"
    assert parameters["autocommit"] is False
    assert "test-password" not in repr(config)


def test_config_supports_private_key_authentication(tmp_path: Path) -> None:
    key = tmp_path / "snowflake.p8"
    key.write_text("test-key", encoding="utf-8")
    config = _config(
        password="",
        private_key_path=str(key),
        private_key_passphrase="test-passphrase",
    )
    parameters = config.connection_parameters()
    assert parameters["authenticator"] == "SNOWFLAKE_JWT"
    assert parameters["private_key_file"] == str(key)
    assert parameters["private_key_file_pwd"] == "test-passphrase"
    assert "test-passphrase" not in repr(config)


def test_bounded_loader_preserves_real_spark_record_shape(tmp_path: Path) -> None:
    _write_batch(tmp_path)
    session = FakeSession()
    warehouse = SnowflakeWarehouseIngestion(
        _config(),
        session_factory=FakeFactory(session),
    )

    result = load_one_feature_batch(
        tmp_path,
        87,
        "load-batch-87",
        warehouse=warehouse,
    )

    assert result.state is LoadState.COMPLETED
    assert session.calls == ["begin", "stage", "merge", "complete", "close"]
    record = session.records[0]
    assert record.symbol == "AAPL"
    assert record.kafka_partitions == (0, 1)
    assert record.max_kafka_offset == 874
    assert record.rolling_return is None
    assert record.rolling_volatility is None
    assert record.relative_volume is None
    assert record.feature_batch_id == 87
    assert record.load_id == "load-batch-87"
    assert record.source_file.endswith(
        "batch_id=87\\part-00000.json"
    ) or record.source_file.endswith("batch_id=87/part-00000.json")


def test_bounded_loader_marks_failed_load_and_reraises(tmp_path: Path) -> None:
    _write_batch(tmp_path)
    session = FakeSession(merge_error=RuntimeError("sensitive detail"))
    warehouse = SnowflakeWarehouseIngestion(
        _config(),
        session_factory=FakeFactory(session),
    )

    with pytest.raises(RuntimeError, match="sensitive detail"):
        load_one_feature_batch(
            tmp_path,
            87,
            "load-batch-87-failed",
            warehouse=warehouse,
        )

    assert session.calls == ["begin", "stage", "merge", "fail", "close"]
    assert session.failure_reason == "RuntimeError: bounded warehouse load failed"
    assert warehouse.get_state("load-batch-87-failed") is LoadState.FAILED


def test_duplicate_accounting_and_lifecycle_are_preserved(tmp_path: Path) -> None:
    accounting = MergeAccounting(1, 0, 1, 0)
    session = FakeSession(accounting=accounting)
    warehouse = SnowflakeWarehouseIngestion(
        _config(),
        session_factory=FakeFactory(session),
    )
    _write_batch(tmp_path)

    result = load_one_feature_batch(
        tmp_path,
        87,
        "load-batch-87-duplicate",
        warehouse=warehouse,
    )

    assert result.accounting == accounting
    assert result.source_record_count == 1
    assert result.accounting.inserted_record_count == 0
    assert result.accounting.duplicate_record_count == 1


def test_load_id_collision_is_rejected_before_opening_second_session(
    tmp_path: Path,
) -> None:
    factory = FakeFactory(FakeSession())
    warehouse = SnowflakeWarehouseIngestion(_config(), session_factory=factory)
    request = BeginLoadRequest(
        load_id="collision",
        feature_batch_id=87,
        batch_dir=tmp_path,
        source_record_count=0,
        manifest_hash="a" * 64,
        source_files=(),
    )
    warehouse.begin_load(request)

    with pytest.raises(SnowflakeLoadCollisionError):
        warehouse.begin_load(request)
    assert factory.opens == 1


def test_invalid_lifecycle_transition_is_rejected(tmp_path: Path) -> None:
    warehouse = SnowflakeWarehouseIngestion(
        _config(),
        session_factory=FakeFactory(FakeSession()),
    )
    request = BeginLoadRequest(
        load_id="invalid-transition",
        feature_batch_id=87,
        batch_dir=tmp_path,
        source_record_count=0,
        manifest_hash="a" * 64,
        source_files=(),
    )
    handle = warehouse.begin_load(request)

    with pytest.raises(WarehouseLifecycleError, match="STARTED -> MERGED"):
        warehouse.complete_load(handle)
