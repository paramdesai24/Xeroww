"""Bounded command for loading one explicit Spark feature batch."""

from __future__ import annotations

import argparse
import json
from collections.abc import Sequence
from pathlib import Path

from api.warehouse.feature_batches import validate_feature_batch
from api.warehouse.ingestion import (
    BeginLoadRequest,
    LoadSnapshot,
    LoadState,
    WarehouseIngestionProtocol,
)
from api.warehouse.snowflake_config import SnowflakeConfig
from api.warehouse.snowflake_ingestion import SnowflakeWarehouseIngestion


def load_one_feature_batch(
    output_root: str | Path,
    feature_batch_id: int,
    load_id: str,
    *,
    warehouse: WarehouseIngestionProtocol | None = None,
) -> LoadSnapshot:
    """Validate and load exactly one caller-selected completed feature batch."""
    batch = validate_feature_batch(
        output_root,
        feature_batch_id,
        load_id=load_id,
    )
    request = BeginLoadRequest.from_validated_batch(batch)
    owned_warehouse = None
    if warehouse is None:
        owned_warehouse = SnowflakeWarehouseIngestion(SnowflakeConfig.from_env())
        target: WarehouseIngestionProtocol = owned_warehouse
    else:
        target = warehouse
    handle = None
    try:
        handle = target.begin_load(request)
        target.stage_records(handle, batch.records)
        target.merge_staged(handle)
        return target.complete_load(handle)
    except Exception as exc:
        if handle is not None and target.get_state(handle.load_id) in {
            LoadState.STARTED,
            LoadState.STAGED,
            LoadState.MERGED,
        }:
            try:
                target.fail_load(
                    handle,
                    f"{type(exc).__name__}: bounded warehouse load failed",
                )
            except Exception as failure_exc:  # noqa: BLE001
                exc.add_note(
                    f"Unable to persist FAILED load state: {type(failure_exc).__name__}"
                )
        raise
    finally:
        if owned_warehouse is not None:
            owned_warehouse.close()


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Load one validated Spark feature batch"
    )
    parser.add_argument("--output-root", required=True)
    parser.add_argument("--feature-batch-id", required=True, type=int)
    parser.add_argument("--load-id", required=True)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    result = load_one_feature_batch(
        args.output_root,
        args.feature_batch_id,
        args.load_id,
    )
    accounting = result.accounting
    print(
        json.dumps(
            {
                "load_id": result.handle.load_id,
                "feature_batch_id": result.handle.feature_batch_id,
                "state": result.state.value,
                "source_record_count": result.source_record_count,
                "inserted_record_count": accounting.inserted_record_count
                if accounting
                else None,
                "duplicate_record_count": accounting.duplicate_record_count
                if accounting
                else None,
                "rejected_record_count": accounting.rejected_record_count
                if accounting
                else None,
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
