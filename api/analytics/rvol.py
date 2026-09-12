"""
api/analytics/rvol.py
─────────────────────
Pure deterministic Relative Volume (RVOL) calculation service and typed DTOs.
Prepared for streaming RVOL computations in Kafka and Apache Spark pipelines.
"""

from dataclasses import dataclass, asdict
from typing import Any, Literal


RVOLState = Literal["ELEVATED", "NORMAL", "UNUSUALLY_LOW"]


@dataclass(frozen=True)
class RVOLDTO:
    current_volume: float
    baseline_avg_volume: float
    rvol: float
    volume_deviation_pct: float
    is_spike: bool
    state: RVOLState

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class RVOLService:
    """
    Stateless, pure mathematical service for Relative Volume (RVOL) and volume spikes.
    """

    @staticmethod
    def classify_state(rvol: float) -> RVOLState:
        """Classify volume intensity based on relative volume multiplier."""
        if rvol >= 1.3:
            return "ELEVATED"
        if rvol <= 0.6:
            return "UNUSUALLY_LOW"
        return "NORMAL"

    @staticmethod
    def is_spike(rvol: float, spike_threshold: float = 2.0) -> bool:
        """Check if RVOL exceeds institutional spike threshold."""
        return rvol >= spike_threshold

    @classmethod
    def compute(
        cls,
        current_volume: float,
        baseline_volumes: list[float],
        spike_threshold: float = 2.0,
    ) -> RVOLDTO:
        """
        Compute RVOL, deviation percentage, and spike state from current volume and baseline sample.
        """
        avg_v = sum(baseline_volumes) / len(baseline_volumes) if baseline_volumes else current_volume
        if avg_v == 0.0 and current_volume > 0:
            avg_v = current_volume

        rvol = round((current_volume / avg_v) if avg_v > 0 else 1.0, 2)
        dev_pct = round(((current_volume - avg_v) / avg_v * 100) if avg_v > 0 else 0.0, 1)
        spike = cls.is_spike(rvol, spike_threshold)
        state = cls.classify_state(rvol)

        return RVOLDTO(
            current_volume=round(current_volume, 2),
            baseline_avg_volume=round(avg_v, 2),
            rvol=rvol,
            volume_deviation_pct=dev_pct,
            is_spike=spike,
            state=state,
        )

    @classmethod
    def compute_from_candles(
        cls,
        candles: list[dict[str, Any]],
        baseline_window: int = 20,
        spike_threshold: float = 2.0,
    ) -> RVOLDTO:
        """
        Extract recent volumes from candles and compute RVOLDTO.
        """
        if not candles:
            return RVOLDTO(
                current_volume=0.0,
                baseline_avg_volume=0.0,
                rvol=1.0,
                volume_deviation_pct=0.0,
                is_spike=False,
                state="NORMAL",
            )

        curr_v = float(candles[-1].get("volume", 0.0))
        prior = candles[:-1]
        if prior:
            sample = prior[-baseline_window:]
            baseline_vols = [float(c.get("volume", 0.0)) for c in sample]
        else:
            baseline_vols = [curr_v]

        return cls.compute(curr_v, baseline_vols, spike_threshold=spike_threshold)
