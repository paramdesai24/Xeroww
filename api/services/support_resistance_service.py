"""
services/support_resistance_service.py
──────────────────────────────────────
Deterministic Support and Resistance Zone Engine.

Detects swing highs and swing lows across historical OHLC candles, clusters them
using ATR/percentage-based price tolerance, computes touch counts and interaction
strengths, and determines the nearest support and resistance zones relative to current price.

Deterministic principles:
  - Algorithmically detected historical zones, NOT predictive price guarantees.
  - Transparent clustering tolerance and touch-count metrics.
"""

from typing import Any, Literal
from dataclasses import dataclass, asdict


@dataclass
class SwingPoint:
    index: int
    time: str
    price: float
    point_type: Literal["high", "low"]


@dataclass
class SRZone:
    price: float
    zone_low: float
    zone_high: float
    level_type: Literal["support", "resistance"]
    touches: int
    strength: float  # 1.0 to 10.0 scale
    distance_price: float
    distance_pct: float
    timestamps: list[str]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class SupportResistanceAnalysis:
    symbol: str
    current_price: float
    nearest_support: SRZone | None
    nearest_resistance: SRZone | None
    support_zones: list[SRZone]
    resistance_zones: list[SRZone]
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


def compute_atr(candles: list[dict[str, Any]], period: int = 14) -> float:
    """Compute Average True Range for dynamic clustering tolerance."""
    if len(candles) < 2:
        return 0.0

    tr_list: list[float] = []
    for i in range(1, len(candles)):
        h = float(candles[i]["high"])
        l = float(candles[i]["low"])  # noqa: E741
        prev_c = float(candles[i - 1]["close"])
        tr = max(h - l, abs(h - prev_c), abs(l - prev_c))
        tr_list.append(tr)

    subset = tr_list[-period:] if len(tr_list) >= period else tr_list
    return sum(subset) / len(subset) if subset else 0.0


def find_swing_points(
    candles: list[dict[str, Any]],
    left_bars: int = 3,
    right_bars: int = 3,
) -> list[SwingPoint]:
    """
    Locate swing highs and swing lows with configurable local lookaround window.
    High: candle high is greater than all highs in [i - left_bars, i + right_bars].
    Low: candle low is less than all lows in [i - left_bars, i + right_bars].
    """
    n = len(candles)
    swings: list[SwingPoint] = []

    for i in range(left_bars, n - right_bars):
        h = float(candles[i]["high"])
        l = float(candles[i]["low"])  # noqa: E741
        t = str(candles[i]["time"])

        is_high = True
        is_low = True

        for offset in range(-left_bars, right_bars + 1):
            if offset == 0:
                continue
            neighbor_h = float(candles[i + offset]["high"])
            neighbor_l = float(candles[i + offset]["low"])

            if neighbor_h >= h:
                is_high = False
            if neighbor_l <= l:
                is_low = False

        if is_high:
            swings.append(SwingPoint(index=i, time=t, price=h, point_type="high"))
        if is_low:
            swings.append(SwingPoint(index=i, time=t, price=l, point_type="low"))

    return swings


def cluster_swing_points(
    swings: list[SwingPoint],
    current_price: float,
    tolerance: float,
    total_candles: int,
) -> list[SRZone]:
    """
    Group swing points within price tolerance into clustered horizontal zones.
    Computes weighted central price, touch count, recency-adjusted strength score,
    and distance from current price.
    """
    if not swings:
        return []

    # Sort swing points by price ascending
    sorted_swings = sorted(swings, key=lambda s: s.price)

    clusters: list[list[SwingPoint]] = []
    current_cluster: list[SwingPoint] = [sorted_swings[0]]

    for s in sorted_swings[1:]:
        # If difference from cluster average is within tolerance, include
        cluster_avg = sum(p.price for p in current_cluster) / len(current_cluster)
        if abs(s.price - cluster_avg) <= tolerance:
            current_cluster.append(s)
        else:
            clusters.append(current_cluster)
            current_cluster = [s]

    if current_cluster:
        clusters.append(current_cluster)

    zones: list[SRZone] = []

    for cluster in clusters:
        touches = len(cluster)
        prices = [p.price for p in cluster]
        zone_low = min(prices)
        zone_high = max(prices)
        central_price = round(sum(prices) / touches, 2)

        # Distinguish support vs resistance based on current price
        level_type: Literal["support", "resistance"] = (
            "support" if central_price <= current_price else "resistance"
        )

        dist_price = round(abs(central_price - current_price), 2)
        dist_pct = round((dist_price / current_price * 100) if current_price > 0 else 0.0, 2)

        # Calculate strength score (1.0 to 10.0 scale)
        # Factors: touch count (base) + recency of latest touch
        recency_bonus = 0.0
        latest_idx = max(p.index for p in cluster)
        if total_candles > 0:
            recency_ratio = latest_idx / total_candles
            recency_bonus = recency_ratio * 3.0  # Up to +3 for recent levels

        raw_strength = (touches * 2.0) + recency_bonus
        strength = min(10.0, round(max(1.0, raw_strength), 1))

        timestamps = [p.time for p in cluster]

        zones.append(
            SRZone(
                price=central_price,
                zone_low=round(zone_low, 2),
                zone_high=round(zone_high, 2),
                level_type=level_type,
                touches=touches,
                strength=strength,
                distance_price=dist_price,
                distance_pct=dist_pct,
                timestamps=timestamps,
            )
        )

    return zones


def analyze_support_resistance(
    candles: list[dict[str, Any]],
    symbol: str,
    left_bars: int = 3,
    right_bars: int = 3,
    tolerance_pct: float = 0.012,
) -> SupportResistanceAnalysis:
    """
    Full pipeline:
      1. Extract current price
      2. Detect swing highs and swing lows
      3. Compute adaptive tolerance (max of ATR and percentage of price)
      4. Cluster swing points into zones
      5. Segment into support vs resistance and locate nearest levels
    """
    if not candles:
        return SupportResistanceAnalysis(
            symbol=symbol,
            current_price=0.0,
            nearest_support=None,
            nearest_resistance=None,
            support_zones=[],
            resistance_zones=[],
            total_swings_detected=0,
            methodology_note="Insufficient candle data provided for support/resistance analysis.",
        )

    current_price = float(candles[-1]["close"])
    swings = find_swing_points(candles, left_bars=left_bars, right_bars=right_bars)

    # Adaptive clustering tolerance: ATR or percentage threshold
    atr = compute_atr(candles, period=14)
    pct_tol = current_price * tolerance_pct
    tolerance = max(pct_tol, atr * 0.75) if atr > 0 else pct_tol

    all_zones = cluster_swing_points(
        swings=swings,
        current_price=current_price,
        tolerance=tolerance,
        total_candles=len(candles),
    )

    # Split into support and resistance
    supports = [z for z in all_zones if z.level_type == "support"]
    resistances = [z for z in all_zones if z.level_type == "resistance"]

    # Nearest support: closest distance below current price
    nearest_sup = min(supports, key=lambda z: z.distance_price) if supports else None
    # Nearest resistance: closest distance above current price
    nearest_res = min(resistances, key=lambda z: z.distance_price) if resistances else None

    # Sort supports descending by price (closest first)
    supports.sort(key=lambda z: z.price, reverse=True)
    # Sort resistances ascending by price (closest first)
    resistances.sort(key=lambda z: z.price)

    return SupportResistanceAnalysis(
        symbol=symbol,
        current_price=round(current_price, 2),
        nearest_support=nearest_sup,
        nearest_resistance=nearest_res,
        support_zones=supports,
        resistance_zones=resistances,
        total_swings_detected=len(swings),
        methodology_note=(
            f"Zones derived from {len(swings)} swing pivots with adaptive tolerance ₹{tolerance:.2f}. "
            "Algorithmically detected historical price zones; not predictive guarantees."
        ),
    )
