"""Discovery and validation for one completed Spark feature batch."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from api.warehouse.market_features import MarketFeatureRecord


MANIFEST_VERSION = 1


class FeatureBatchValidationError(ValueError):
    """Raised when a Spark feature batch is incomplete or invalid."""


@dataclass(frozen=True)
class ValidatedSourceFile:
    """One final Spark part file and its content identity."""

    path: Path
    sha256: str
    size_bytes: int


@dataclass(frozen=True)
class ValidatedFeatureBatch:
    """A completely validated, deterministic Spark feature batch."""

    feature_batch_id: int
    batch_dir: Path
    source_files: tuple[ValidatedSourceFile, ...]
    records: tuple[MarketFeatureRecord, ...]
    source_record_count: int
    manifest_hash: str

    @property
    def part_files(self) -> tuple[Path, ...]:
        return tuple(source_file.path for source_file in self.source_files)

    @property
    def source_file_sha256(self) -> dict[Path, str]:
        return {
            source_file.path: source_file.sha256 for source_file in self.source_files
        }


def _validate_batch_id(feature_batch_id: Any) -> int:
    if isinstance(feature_batch_id, bool) or not isinstance(feature_batch_id, int):
        raise FeatureBatchValidationError("feature_batch_id must be an integer")
    if feature_batch_id < 0:
        raise FeatureBatchValidationError("feature_batch_id must be non-negative")
    return feature_batch_id


def _validate_load_id(load_id: Any) -> str:
    if not isinstance(load_id, str) or not load_id.strip():
        raise FeatureBatchValidationError("load_id must be supplied by the caller")
    return load_id.strip()


def _discover_part_files(batch_dir: Path) -> tuple[Path, ...]:
    part_files = tuple(
        sorted(
            (
                entry
                for entry in batch_dir.iterdir()
                if entry.is_file()
                and not entry.is_symlink()
                and entry.name.startswith("part-")
                and entry.name.endswith(".json")
            ),
            key=lambda path: path.name,
        )
    )
    if not part_files:
        raise FeatureBatchValidationError(
            f"Feature batch has no final part-*.json files: {batch_dir}"
        )
    return part_files


def _manifest_hash(
    feature_batch_id: int,
    source_files: tuple[ValidatedSourceFile, ...],
) -> str:
    canonical_manifest = [
        MANIFEST_VERSION,
        feature_batch_id,
        [[source_file.path.name, source_file.sha256] for source_file in source_files],
    ]
    encoded = json.dumps(
        canonical_manifest,
        ensure_ascii=True,
        allow_nan=False,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _parse_source_file(
    source_file: ValidatedSourceFile,
    *,
    feature_batch_id: int,
    load_id: str,
    content: bytes,
) -> list[MarketFeatureRecord]:
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise FeatureBatchValidationError(
            f"Feature part file is not valid UTF-8: {source_file.path}"
        ) from exc

    records: list[MarketFeatureRecord] = []
    for line_number, line in enumerate(text.splitlines(), start=1):
        if not line.strip():
            raise FeatureBatchValidationError(
                f"Empty JSON record in {source_file.path} at line {line_number}"
            )
        try:
            document = json.loads(line)
        except json.JSONDecodeError as exc:
            raise FeatureBatchValidationError(
                f"Malformed JSON in {source_file.path} at line {line_number}: {exc.msg}"
            ) from exc
        if not isinstance(document, dict):
            raise FeatureBatchValidationError(
                f"Feature record must be a JSON object in {source_file.path} at line {line_number}"
            )
        document_batch_id = document.get("feature_batch_id")
        if document_batch_id is not None and document_batch_id != feature_batch_id:
            raise FeatureBatchValidationError(
                f"Feature record batch ID does not match batch directory in "
                f"{source_file.path} at line {line_number}"
            )
        try:
            record = MarketFeatureRecord.from_spark_json(
                document,
                feature_batch_id=feature_batch_id,
                source_file=str(source_file.path),
                source_file_sha256=source_file.sha256,
                load_id=load_id,
            )
        except (ValidationError, ValueError) as exc:
            raise FeatureBatchValidationError(
                f"Invalid feature record in {source_file.path} at line {line_number}: {exc}"
            ) from exc
        records.append(record)
    return records


def validate_feature_batch(
    output_root: str | Path,
    feature_batch_id: int,
    *,
    load_id: str,
) -> ValidatedFeatureBatch:
    """Discover and validate one explicitly requested completed Spark batch.

    Spark JSON output is JSON Lines: each non-empty line in a direct
    ``part-*.json`` child is one feature record.
    """
    batch_id = _validate_batch_id(feature_batch_id)
    normalized_load_id = _validate_load_id(load_id)
    root = Path(output_root).expanduser().resolve()
    batch_dir = root / f"batch_id={batch_id}"

    if not batch_dir.exists() or not batch_dir.is_dir():
        raise FeatureBatchValidationError(
            f"Feature batch directory does not exist: {batch_dir}"
        )
    success_marker = batch_dir / "_SUCCESS"
    if not success_marker.is_file():
        raise FeatureBatchValidationError(
            f"Feature batch is incomplete; _SUCCESS is missing: {batch_dir}"
        )

    part_files = _discover_part_files(batch_dir)
    source_files: list[ValidatedSourceFile] = []
    file_contents: dict[Path, bytes] = {}
    for part_file in part_files:
        content = part_file.read_bytes()
        file_contents[part_file] = content
        source_files.append(
            ValidatedSourceFile(
                path=part_file,
                sha256=hashlib.sha256(content).hexdigest(),
                size_bytes=len(content),
            )
        )

    ordered_source_files = tuple(source_files)
    records: list[MarketFeatureRecord] = []
    for source_file in ordered_source_files:
        records.extend(
            _parse_source_file(
                source_file,
                feature_batch_id=batch_id,
                load_id=normalized_load_id,
                content=file_contents[source_file.path],
            )
        )
    if not records:
        raise FeatureBatchValidationError(
            f"Feature batch contains no JSON records: {batch_dir}"
        )

    return ValidatedFeatureBatch(
        feature_batch_id=batch_id,
        batch_dir=batch_dir,
        source_files=ordered_source_files,
        records=tuple(records),
        source_record_count=len(records),
        manifest_hash=_manifest_hash(batch_id, ordered_source_files),
    )
