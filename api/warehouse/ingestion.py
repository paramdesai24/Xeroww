"""Implementation-neutral protocol for loading validated analytical features."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Protocol, Sequence, runtime_checkable

from api.warehouse.feature_batches import ValidatedFeatureBatch, ValidatedSourceFile
from api.warehouse.market_features import MarketFeatureRecord


class LoadState(str, Enum):
    NOT_STARTED = "NOT_STARTED"
    STARTED = "STARTED"
    STAGED = "STAGED"
    MERGED = "MERGED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class WarehouseLifecycleError(RuntimeError):
    """Raised when a warehouse load attempts an invalid state transition."""


@dataclass(frozen=True)
class BeginLoadRequest:
    load_id: str
    feature_batch_id: int
    batch_dir: Path
    source_record_count: int
    manifest_hash: str
    source_files: tuple[ValidatedSourceFile, ...]

    @classmethod
    def from_validated_batch(cls, batch: ValidatedFeatureBatch) -> BeginLoadRequest:
        load_ids = {record.load_id for record in batch.records}
        if len(load_ids) != 1:
            raise ValueError("Validated batch records must have exactly one load_id")
        return cls(
            load_id=next(iter(load_ids)),
            feature_batch_id=batch.feature_batch_id,
            batch_dir=batch.batch_dir,
            source_record_count=batch.source_record_count,
            manifest_hash=batch.manifest_hash,
            source_files=batch.source_files,
        )


@dataclass(frozen=True)
class WarehouseLoadHandle:
    load_id: str
    feature_batch_id: int


@dataclass(frozen=True)
class MergeAccounting:
    source_record_count: int
    inserted_record_count: int
    duplicate_record_count: int
    rejected_record_count: int = 0

    def __post_init__(self) -> None:
        counts = (
            self.source_record_count,
            self.inserted_record_count,
            self.duplicate_record_count,
            self.rejected_record_count,
        )
        if any(count < 0 for count in counts):
            raise ValueError("Merge accounting counts must be non-negative")
        classified = (
            self.inserted_record_count
            + self.duplicate_record_count
            + self.rejected_record_count
        )
        if self.source_record_count != classified:
            raise ValueError("Merge accounting must classify every source record")


@dataclass(frozen=True)
class LoadSnapshot:
    handle: WarehouseLoadHandle
    state: LoadState
    source_record_count: int
    staged_record_count: int
    accounting: MergeAccounting | None = None
    failure_reason: str | None = None


@runtime_checkable
class WarehouseIngestionProtocol(Protocol):
    """Minimal lifecycle required from an analytical warehouse implementation."""

    def begin_load(self, request: BeginLoadRequest) -> WarehouseLoadHandle: ...

    def stage_records(
        self,
        handle: WarehouseLoadHandle,
        records: Sequence[MarketFeatureRecord],
    ) -> LoadSnapshot: ...

    def merge_staged(self, handle: WarehouseLoadHandle) -> MergeAccounting: ...

    def complete_load(self, handle: WarehouseLoadHandle) -> LoadSnapshot: ...

    def fail_load(self, handle: WarehouseLoadHandle, reason: str) -> LoadSnapshot: ...

    def get_state(self, load_id: str) -> LoadState: ...

    def get_load(self, handle: WarehouseLoadHandle) -> LoadSnapshot: ...


@dataclass
class _InMemoryLoad:
    request: BeginLoadRequest
    state: LoadState
    staged_records: tuple[MarketFeatureRecord, ...] = ()
    accounting: MergeAccounting | None = None
    failure_reason: str | None = None


class InMemoryWarehouseIngestion:
    """Deterministic test implementation using record keys as fact identities."""

    def __init__(self) -> None:
        self._loads: dict[str, _InMemoryLoad] = {}
        self._facts: dict[str, MarketFeatureRecord] = {}

    @property
    def fact_records(self) -> tuple[MarketFeatureRecord, ...]:
        return tuple(self._facts[key] for key in sorted(self._facts))

    def get_state(self, load_id: str) -> LoadState:
        load = self._loads.get(load_id)
        return load.state if load else LoadState.NOT_STARTED

    def begin_load(self, request: BeginLoadRequest) -> WarehouseLoadHandle:
        if not request.load_id.strip():
            raise ValueError("load_id must be non-empty")
        if request.source_record_count < 0:
            raise ValueError("source_record_count must be non-negative")
        if request.load_id in self._loads:
            self._raise_transition(request.load_id, LoadState.STARTED)
        self._loads[request.load_id] = _InMemoryLoad(
            request=request,
            state=LoadState.STARTED,
        )
        return WarehouseLoadHandle(
            load_id=request.load_id,
            feature_batch_id=request.feature_batch_id,
        )

    def stage_records(
        self,
        handle: WarehouseLoadHandle,
        records: Sequence[MarketFeatureRecord],
    ) -> LoadSnapshot:
        load = self._require_state(handle, LoadState.STARTED)
        staged_records = tuple(records)
        if len(staged_records) != load.request.source_record_count:
            raise ValueError(
                "Staged record count must match declared source_record_count"
            )
        for record in staged_records:
            if record.load_id != handle.load_id:
                raise ValueError("Record load_id does not match the load handle")
            if record.feature_batch_id != handle.feature_batch_id:
                raise ValueError(
                    "Record feature_batch_id does not match the load handle"
                )
        load.staged_records = staged_records
        load.state = LoadState.STAGED
        return self._snapshot(handle, load)

    def merge_staged(self, handle: WarehouseLoadHandle) -> MergeAccounting:
        load = self._require_state(handle, LoadState.STAGED)
        inserted = 0
        duplicates = 0
        for record in load.staged_records:
            if record.record_key in self._facts:
                duplicates += 1
            else:
                self._facts[record.record_key] = record
                inserted += 1
        accounting = MergeAccounting(
            source_record_count=len(load.staged_records),
            inserted_record_count=inserted,
            duplicate_record_count=duplicates,
            rejected_record_count=0,
        )
        load.accounting = accounting
        load.state = LoadState.MERGED
        return accounting

    def complete_load(self, handle: WarehouseLoadHandle) -> LoadSnapshot:
        load = self._require_state(handle, LoadState.MERGED)
        load.state = LoadState.COMPLETED
        return self._snapshot(handle, load)

    def fail_load(self, handle: WarehouseLoadHandle, reason: str) -> LoadSnapshot:
        load = self._get_load(handle)
        if load.state not in {LoadState.STARTED, LoadState.STAGED, LoadState.MERGED}:
            self._raise_transition(handle.load_id, LoadState.FAILED)
        if not isinstance(reason, str) or not reason.strip():
            raise ValueError("failure reason must be non-empty")
        load.failure_reason = reason.strip()
        load.state = LoadState.FAILED
        return self._snapshot(handle, load)

    def get_load(self, handle: WarehouseLoadHandle) -> LoadSnapshot:
        return self._snapshot(handle, self._get_load(handle))

    def _get_load(self, handle: WarehouseLoadHandle) -> _InMemoryLoad:
        load = self._loads.get(handle.load_id)
        if load is None:
            raise WarehouseLifecycleError(f"Load has not started: {handle.load_id}")
        if load.request.feature_batch_id != handle.feature_batch_id:
            raise WarehouseLifecycleError(
                "Load handle does not match the stored feature batch"
            )
        return load

    def _require_state(
        self,
        handle: WarehouseLoadHandle,
        required_state: LoadState,
    ) -> _InMemoryLoad:
        load = self._get_load(handle)
        if load.state is not required_state:
            self._raise_transition(handle.load_id, required_state)
        return load

    def _raise_transition(self, load_id: str, target_state: LoadState) -> None:
        current_state = self.get_state(load_id)
        raise WarehouseLifecycleError(
            f"Invalid warehouse load transition: {current_state.value} -> "
            f"{target_state.value} for load {load_id}"
        )

    @staticmethod
    def _snapshot(handle: WarehouseLoadHandle, load: _InMemoryLoad) -> LoadSnapshot:
        return LoadSnapshot(
            handle=handle,
            state=load.state,
            source_record_count=load.request.source_record_count,
            staged_record_count=len(load.staged_records),
            accounting=load.accounting,
            failure_reason=load.failure_reason,
        )
