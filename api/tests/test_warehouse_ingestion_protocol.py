"""Tests for the warehouse ingestion lifecycle and in-memory implementation."""

from pathlib import Path

import pytest

from api.warehouse.feature_batches import ValidatedFeatureBatch, ValidatedSourceFile
from api.warehouse.ingestion import (
    BeginLoadRequest,
    InMemoryWarehouseIngestion,
    LoadState,
    WarehouseIngestionProtocol,
    WarehouseLifecycleError,
)
from api.warehouse.market_features import MarketFeatureRecord


def feature_record(
    *,
    load_id: str = "load-116",
    batch_id: int = 116,
    observation_count: int = 5,
    max_kafka_offset: int = 2001,
) -> MarketFeatureRecord:
    return MarketFeatureRecord.from_spark_json(
        {
            "window_start": "2026-10-06T17:02:00.000Z",
            "window_end": "2026-10-06T17:07:00.000Z",
            "symbol": "RELIANCE.NS",
            "source": "yahoo",
            "observation_count": observation_count,
            "log_return": 0.026286657446119903,
            "rolling_return": 0.0,
            "rolling_volatility": 0.0,
            "relative_volume": 1.0,
            "kafka_partitions": [4],
            "max_kafka_offset": max_kafka_offset,
        },
        feature_batch_id=batch_id,
        source_file=f"/output/features/batch_id={batch_id}/part-00000.json",
        source_file_sha256="a" * 64,
        load_id=load_id,
    )


def validated_batch(
    records: tuple[MarketFeatureRecord, ...],
    *,
    batch_id: int = 116,
) -> ValidatedFeatureBatch:
    source_file = ValidatedSourceFile(
        path=Path(f"/output/features/batch_id={batch_id}/part-00000.json"),
        sha256="a" * 64,
        size_bytes=512,
    )
    return ValidatedFeatureBatch(
        feature_batch_id=batch_id,
        batch_dir=Path(f"/output/features/batch_id={batch_id}"),
        source_files=(source_file,),
        records=records,
        source_record_count=len(records),
        manifest_hash="b" * 64,
    )


def begin(
    warehouse: InMemoryWarehouseIngestion,
    records: tuple[MarketFeatureRecord, ...],
):
    batch = validated_batch(records, batch_id=records[0].feature_batch_id)
    request = BeginLoadRequest.from_validated_batch(batch)
    return warehouse.begin_load(request)


def test_in_memory_implementation_satisfies_protocol():
    assert isinstance(InMemoryWarehouseIngestion(), WarehouseIngestionProtocol)


def test_valid_lifecycle_and_successful_completion():
    warehouse = InMemoryWarehouseIngestion()
    record = feature_record()

    assert warehouse.get_state("load-116") is LoadState.NOT_STARTED
    handle = begin(warehouse, (record,))
    assert warehouse.get_state(handle.load_id) is LoadState.STARTED
    assert warehouse.stage_records(handle, (record,)).state is LoadState.STAGED
    accounting = warehouse.merge_staged(handle)
    assert warehouse.get_state(handle.load_id) is LoadState.MERGED
    completed = warehouse.complete_load(handle)

    assert completed.state is LoadState.COMPLETED
    assert completed.accounting == accounting
    assert accounting.source_record_count == 1
    assert accounting.inserted_record_count == 1
    assert accounting.duplicate_record_count == 0
    assert accounting.rejected_record_count == 0


@pytest.mark.parametrize(
    "operation",
    [
        lambda warehouse, handle, record: warehouse.merge_staged(handle),
        lambda warehouse, handle, record: warehouse.complete_load(handle),
        lambda warehouse, handle, record: warehouse.begin_load(
            BeginLoadRequest.from_validated_batch(validated_batch((record,)))
        ),
    ],
)
def test_invalid_lifecycle_transitions_from_started(operation):
    warehouse = InMemoryWarehouseIngestion()
    record = feature_record()
    handle = begin(warehouse, (record,))

    with pytest.raises(
        WarehouseLifecycleError, match="Invalid warehouse load transition"
    ):
        operation(warehouse, handle, record)


def test_completed_load_cannot_be_modified_or_failed():
    warehouse = InMemoryWarehouseIngestion()
    record = feature_record()
    handle = begin(warehouse, (record,))
    warehouse.stage_records(handle, (record,))
    warehouse.merge_staged(handle)
    warehouse.complete_load(handle)

    with pytest.raises(WarehouseLifecycleError):
        warehouse.stage_records(handle, (record,))
    with pytest.raises(WarehouseLifecycleError):
        warehouse.merge_staged(handle)
    with pytest.raises(WarehouseLifecycleError):
        warehouse.fail_load(handle, "too late")


def test_failure_from_staged_records_reason_and_blocks_progress():
    warehouse = InMemoryWarehouseIngestion()
    record = feature_record()
    handle = begin(warehouse, (record,))
    warehouse.stage_records(handle, (record,))

    failed = warehouse.fail_load(handle, "warehouse unavailable")

    assert failed.state is LoadState.FAILED
    assert failed.failure_reason == "warehouse unavailable"
    with pytest.raises(WarehouseLifecycleError):
        warehouse.merge_staged(handle)
    with pytest.raises(WarehouseLifecycleError):
        warehouse.complete_load(handle)


def test_existing_record_key_is_counted_as_duplicate_across_loads():
    warehouse = InMemoryWarehouseIngestion()
    first = feature_record(load_id="load-one")
    first_handle = begin(warehouse, (first,))
    warehouse.stage_records(first_handle, (first,))
    warehouse.merge_staged(first_handle)
    warehouse.complete_load(first_handle)

    repeated = feature_record(load_id="load-two")
    second_handle = begin(warehouse, (repeated,))
    warehouse.stage_records(second_handle, (repeated,))
    accounting = warehouse.merge_staged(second_handle)

    assert accounting.inserted_record_count == 0
    assert accounting.duplicate_record_count == 1
    assert len(warehouse.fact_records) == 1


def test_revision_with_same_logical_window_is_inserted():
    warehouse = InMemoryWarehouseIngestion()
    original = feature_record(load_id="load-one")
    revision = feature_record(
        load_id="load-two",
        observation_count=6,
        max_kafka_offset=2002,
    )
    assert original.logical_window_key == revision.logical_window_key
    assert original.record_key != revision.record_key

    first_handle = begin(warehouse, (original,))
    warehouse.stage_records(first_handle, (original,))
    warehouse.merge_staged(first_handle)
    warehouse.complete_load(first_handle)
    second_handle = begin(warehouse, (revision,))
    warehouse.stage_records(second_handle, (revision,))
    accounting = warehouse.merge_staged(second_handle)

    assert accounting.inserted_record_count == 1
    assert accounting.duplicate_record_count == 0
    assert len(warehouse.fact_records) == 2


def test_duplicate_record_key_within_source_batch_is_staged_and_accounted():
    warehouse = InMemoryWarehouseIngestion()
    record = feature_record()
    handle = begin(warehouse, (record, record))

    staged = warehouse.stage_records(handle, (record, record))
    accounting = warehouse.merge_staged(handle)

    assert staged.staged_record_count == 2
    assert accounting.source_record_count == 2
    assert accounting.inserted_record_count == 1
    assert accounting.duplicate_record_count == 1
    assert accounting.rejected_record_count == 0
    assert accounting.source_record_count == (
        accounting.inserted_record_count
        + accounting.duplicate_record_count
        + accounting.rejected_record_count
    )


def test_multiple_load_ids_have_independent_lifecycle_state():
    warehouse = InMemoryWarehouseIngestion()
    first = feature_record(load_id="load-one")
    second = feature_record(load_id="load-two")
    first_handle = begin(warehouse, (first,))
    second_handle = begin(warehouse, (second,))

    warehouse.stage_records(first_handle, (first,))
    warehouse.fail_load(second_handle, "cancelled")

    assert warehouse.get_state("load-one") is LoadState.STAGED
    assert warehouse.get_state("load-two") is LoadState.FAILED


def test_staging_requires_declared_source_count_and_matching_metadata():
    warehouse = InMemoryWarehouseIngestion()
    record = feature_record()
    handle = begin(warehouse, (record, record))

    with pytest.raises(ValueError, match="source_record_count"):
        warehouse.stage_records(handle, (record,))

    other_load_record = feature_record(load_id="other-load")
    with pytest.raises(ValueError, match="load_id"):
        warehouse.stage_records(handle, (record, other_load_record))
