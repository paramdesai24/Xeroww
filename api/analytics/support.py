"""
api/analytics/support.py
────────────────────────
Pure deterministic Support and Resistance zone service and typed DTOs.
Identifies historical swing pivots, clusters key price levels, and computes proximity.
"""

from dataclasses import dataclass, asdict
from typing import Any, Literal

from api.services.support_resistance_service import (
    analyze_support_resistance,
    find_swing_points,
    compute_atr,
    cluster_swing_points,
)


@dataclass(frozen=True)
class SwingPointDTO:
    index: int
    time: str
    price: float
    point_type: Literal["high", "low"]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class SRZoneDTO:
    price: float
    zone_low: float
    zone_high: float
    level_type: Literal["support", "resistance"]
    touches: int
    strength: float
    distance_price: float
    distance_pct: float
    timestamps: list[str]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class SRAnalysisDTO:
    symbol: str
    current_price: float
    nearest_support: SRZoneDTO | None
    nearest_resistance: SRZoneDTO | None
    support_zones: list[SRZoneDTO]
    resistance_zones: list[SRZoneDTO]
    total_swings_detected: int
    methodology_note: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "symbol": self.symbol,
            "current_price": self.current_price,
            "nearest_support": self.nearest_support.to_dict() if self.nearest_support else None,
            "nearest_resistance": self.nearest_resistance.to_dict() if self.nearest_resistance else None,
            "support_zones": [z.to_dict() for z in self.support_zones],
            "resistance_zones": [z.to_dict() for z in self.resistance_zones],
            "total_swings_detected": self.total_swings_detected,
            "methodology_note": self.methodology_note,
        }


class SupportResistanceService:
    """
    Stateless service calculating historical horizontal support and resistance levels.
    """

    @staticmethod
    def calculate_atr(candles: list[dict[str, Any]], period: int = 14) -> float:
        """Calculate Average True Range for dynamic zone clustering."""
        return compute_atr(candles, period=period)

    @staticmethod
    def locate_swings(
        candles: list[dict[str, Any]],
        left_bars: int = 3,
        right_bars: int = 3,
    ) -> list[SwingPointDTO]:
        """Locate swing highs and swing lows across candle history."""
        swings = find_swing_points(candles, left_bars=left_bars, right_bars=right_bars)
        return [
            SwingPointDTO(
                index=s.index,
                time=s.time,
                price=s.price,
                point_type=s.point_type,
            )
            for s in swings
        ]

    @classmethod
    def analyze(
        cls,
        candles: list[dict[str, Any]],
        symbol: str,
        left_bars: int = 3,
        right_bars: int = 3,
        tolerance_pct: float = 0.012,
    ) -> SRAnalysisDTO:
        """
        Execute full support and resistance identification pipeline.
        """
        raw = analyze_support_resistance(
            candles,
            symbol=symbol,
            left_bars=left_bars,
            right_bars=right_bars,
            tolerance_pct=tolerance_pct,
        )
        d = raw.to_dict()

        nearest_sup = SRZoneDTO(**d["nearest_support"]) if d.get("nearest_support") else None
        nearest_res = SRZoneDTO(**d["nearest_resistance"]) if d.get("nearest_resistance") else None

        support_zones = [SRZoneDTO(**z) for z in d.get("support_zones", [])]
        resistance_zones = [SRZoneDTO(**z) for z in d.get("resistance_zones", [])]

        return SRAnalysisDTO(
            symbol=d["symbol"],
            current_price=float(d["current_price"]),
            nearest_support=nearest_sup,
            nearest_resistance=nearest_res,
            support_zones=support_zones,
            resistance_zones=resistance_zones,
            total_swings_detected=int(d["total_swings_detected"]),
            methodology_note=str(d["methodology_note"]),
        )
