"""Tests for deterministic Spark feature batch discovery and validation."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from api.warehouse.feature_batches import (
    FeatureBatchValidationError,
    validate_feature_batch,
)


def feature_record(**overrides) -> dict:
    record = {
        "window_start": "2026-10-06T17:02:00.000Z",
        "window_end": "2026-10-06T17:07:00.000Z",
        "symbol": "RELIANCE.NS",
        "source": "yahoo",
        "observation_count": 5,
        "log_return": 0.026286657446119903,
        "rolling_return": 0.0,
        "rolling_volatility": 0.0,
        "relative_volume": 1.0,
        "kafka_partitions": [4],
        "max_kafka_offset": 2001,
    }
    return {**record, **overrides}


def write_batch(
    root: Path,
    *,
    batch_id: int = 116,
    files: dict[str, list[dict] | str] | None = None,
    success: bool = True,
) -> Path:
    batch_dir = root / f"batch_id={batch_id}"
    batch_dir.mkdir(parents=True)
    if success:
        (batch_dir / "_SUCCESS").write_bytes(b"")
    batch_files = (
        {"part-00000-example-c000.json": [feature_record()]} if files is None else files
    )
    for name, records in batch_files.items():
        content = (
            records
            if isinstance(records, str)
            else "".join(
                f"{json.dumps(record, separators=(',', ':'))}\n" for record in records
            )
        )
        (batch_dir / name).write_text(content, encoding="utf-8", newline="")
    return batch_dir


def test_valid_real_shaped_batch_is_validated(tmp_path):
    batch_dir = write_batch(tmp_path)

    batch = validate_feature_batch(tmp_path, 116, load_id="load-116")

    assert batch.feature_batch_id == 116
    assert batch.batch_dir == batch_dir.resolve()
    assert batch.source_record_count == 1
    assert batch.records[0].symbol == "RELIANCE.NS"
    assert batch.records[0].feature_batch_id == 116
    assert batch.records[0].load_id == "load-116"


def test_success_marker_is_required(tmp_path):
    write_batch(tmp_path, success=False)

    with pytest.raises(FeatureBatchValidationError, match="_SUCCESS is missing"):
        validate_feature_batch(tmp_path, 116, load_id="load-116")


def test_missing_batch_directory_is_rejected(tmp_path):
    with pytest.raises(FeatureBatchValidationError, match="does not exist"):
        validate_feature_batch(tmp_path, 116, load_id="load-116")


def test_batch_without_part_files_is_rejected(tmp_path):
    write_batch(tmp_path, files={})

    with pytest.raises(FeatureBatchValidationError, match=r"no final part-\*\.json"):
        validate_feature_batch(tmp_path, 116, load_id="load-116")


def test_temporary_and_unrelated_files_are_ignored(tmp_path):
    batch_dir = write_batch(tmp_path)
    temporary = batch_dir / "_temporary"
    temporary.mkdir()
    (temporary / "part-99999.json").write_text("not-json", encoding="utf-8")
    (batch_dir / ".part-00000.json.crc").write_text("not-json", encoding="utf-8")
    (batch_dir / "notes.json").write_text("not-json", encoding="utf-8")

    batch = validate_feature_batch(tmp_path, 116, load_id="load-116")

    assert len(batch.part_files) == 1
    assert batch.part_files[0].name == "part-00000-example-c000.json"


def test_multiple_part_files_are_sorted_and_all_records_are_validated(tmp_path):
    write_batch(
        tmp_path,
        files={
            "part-00002.json": [feature_record(symbol="INFY.NS", kafka_partitions=[2])],
            "part-00000.json": [feature_record()],
            "part-00001.json": [
                feature_record(
                    symbol="TCS.NS", kafka_partitions=[0], max_kafka_offset=2002
                ),
                feature_record(
                    symbol="HDFCBANK.NS", kafka_partitions=[1], max_kafka_offset=2003
                ),
            ],
        },
    )

    batch = validate_feature_batch(tmp_path, 116, load_id="load-116")

    assert [path.name for path in batch.part_files] == [
        "part-00000.json",
        "part-00001.json",
        "part-00002.json",
    ]
    assert [record.symbol for record in batch.records] == [
        "RELIANCE.NS",
        "TCS.NS",
        "HDFCBANK.NS",
        "INFY.NS",
    ]
    assert batch.source_record_count == 4


def test_malformed_json_is_rejected_with_file_and_line(tmp_path):
    write_batch(tmp_path, files={"part-00000.json": "{not-json}\n"})

    with pytest.raises(
        FeatureBatchValidationError, match=r"part-00000\.json at line 1"
    ):
        validate_feature_batch(tmp_path, 116, load_id="load-116")


def test_invalid_market_feature_record_is_rejected(tmp_path):
    write_batch(
        tmp_path, files={"part-00000.json": [feature_record(log_return=float("nan"))]}
    )

    with pytest.raises(FeatureBatchValidationError, match="Invalid feature record"):
        validate_feature_batch(tmp_path, 116, load_id="load-116")


def test_record_batch_id_mismatch_is_rejected(tmp_path):
    write_batch(
        tmp_path, files={"part-00000.json": [feature_record(feature_batch_id=87)]}
    )

    with pytest.raises(
        FeatureBatchValidationError, match="does not match batch directory"
    ):
        validate_feature_batch(tmp_path, 116, load_id="load-116")


def test_source_file_sha256_uses_actual_file_bytes(tmp_path):
    batch_dir = write_batch(tmp_path)
    part_file = batch_dir / "part-00000-example-c000.json"
    expected = hashlib.sha256(part_file.read_bytes()).hexdigest()

    batch = validate_feature_batch(tmp_path, 116, load_id="load-116")

    assert batch.source_files[0].sha256 == expected
    assert batch.records[0].source_file_sha256 == expected


def test_manifest_hash_is_deterministic_and_frozen(tmp_path):
    write_batch(tmp_path)

    first = validate_feature_batch(tmp_path, 116, load_id="load-one")
    second = validate_feature_batch(tmp_path, 116, load_id="load-two")

    assert first.manifest_hash == second.manifest_hash
    assert (
        first.manifest_hash
        == "d0b78d80db466ec8160293278109b8eb03067f5543712c67925dd61ebdd7f5e3"
    )


def test_manifest_hash_changes_when_file_content_changes(tmp_path):
    batch_dir = write_batch(tmp_path)
    first = validate_feature_batch(tmp_path, 116, load_id="load-116")
    part_file = batch_dir / "part-00000-example-c000.json"
    part_file.write_text(
        f"{json.dumps(feature_record(observation_count=6), separators=(',', ':'))}\n",
        encoding="utf-8",
        newline="",
    )

    second = validate_feature_batch(tmp_path, 116, load_id="load-116")

    assert first.manifest_hash != second.manifest_hash


def test_manifest_is_independent_of_filesystem_enumeration_order(tmp_path, monkeypatch):
    batch_dir = write_batch(
        tmp_path,
        files={
            "part-00002.json": [feature_record(symbol="INFY.NS")],
            "part-00000.json": [feature_record()],
            "part-00001.json": [feature_record(symbol="TCS.NS")],
        },
    )
    first = validate_feature_batch(tmp_path, 116, load_id="load-116")
    original_iterdir = Path.iterdir

    def reversed_iterdir(path):
        entries = list(original_iterdir(path))
        return iter(reversed(entries)) if path == batch_dir.resolve() else iter(entries)

    monkeypatch.setattr(Path, "iterdir", reversed_iterdir)
    second = validate_feature_batch(tmp_path, 116, load_id="load-116")

    assert first.part_files == second.part_files
    assert first.manifest_hash == second.manifest_hash


def test_load_id_must_be_caller_supplied(tmp_path):
    write_batch(tmp_path)

    with pytest.raises(FeatureBatchValidationError, match="supplied by the caller"):
        validate_feature_batch(tmp_path, 116, load_id="")
