"""Utilities that keep API payloads compliant with strict JSON."""

from __future__ import annotations

import math
from dataclasses import asdict, is_dataclass
from typing import Any


def sanitize_for_json(value: Any) -> Any:
    """Recursively replace non-finite floats with null-compatible values."""
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {str(key): sanitize_for_json(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [sanitize_for_json(item) for item in value]
    if is_dataclass(value) and not isinstance(value, type):
        return sanitize_for_json(asdict(value))
    return value
