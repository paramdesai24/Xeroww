"""
services/volume_service.py
──────────────────────────
Deterministic Volume Analytics and Relative Volume (RVOL) Engine.

Computes:
  - Current session volume
  - Rolling 20-period average volume (SMA)
  - Rolling 20-period median volume (outlier-resistant)
  - Relative Volume: RVOL = Current Volume / Rolling Average Volume
  - Volume spike classification (RVOL >= 2.0)
  - Volume state: ELEVATED (>= 1.3), NORMAL (0.6 - 1.3), UNUSUALLY_LOW (<= 0.6)
  - Price-Volume interaction (Accumulation, Distribution, Low-volume pullback, etc.)
  - Deterministic volume breakout confirmation and divergence flags.

Zero machine learning, zero probabilistic predictions.
"""

from typing import Any, Literal
from dataclasses import dataclass, asdict
import statistics


VolumeState = Literal["ELEVATED", "NORMAL", "UNUSUALLY_LOW"]
PriceVolumeRelation = Literal[
    "ACCUMULATION",
    "DISTRIBUTION",
    "LOW_VOLUME_ADVANCE",
    "LOW_VOLUME_PULLBACK",
    "NEUTRAL",
]


@dataclass
class VolumeAnalytics:
    symbol: str
    current_volume: float
    baseline_avg_volume: float
    baseline_median_volume: float
    rvol: float
    volume_deviation_pct: float
    is_volume_spike: bool
    volume_state: VolumeState
    price_volume_relationship: PriceVolumeRelation
    breakout_confirmed: bool
    divergence_flag: str | None
    explanation: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def analyze_volume(
    candles: list[dict[str, Any]],
    symbol: str,
    baseline_window: int = 20,
) -> VolumeAnalytics:
    """
    Compute deterministic volume metrics and price-volume relationship.
    """
    if not candles:
        return VolumeAnalytics(
            symbol=symbol,
            current_volume=0.0,
            baseline_avg_volume=0.0,
            baseline_median_volume=0.0,
            rvol=1.0,
            volume_deviation_pct=0.0,
            is_volume_spike=False,
            volume_state="NORMAL",
            price_volume_relationship="NEUTRAL",
            breakout_confirmed=False,
            divergence_flag=None,
            explanation="Insufficient candle data to analyze volume profile.",
        )

    latest = candles[-1]
    curr_v = float(latest.get("volume", 0.0))
    curr_o = float(latest.get("open", 0.0))
    curr_c = float(latest.get("close", 0.0))
    curr_h = float(latest.get("high", 0.0))

    # Historical volume baseline: preceding candles up to baseline_window
    prior_candles = candles[:-1]
    if prior_candles:
        sample = prior_candles[-baseline_window:]
        volumes = [float(c.get("volume", 0.0)) for c in sample]
    else:
        volumes = [curr_v]

    avg_v = sum(volumes) / len(volumes) if volumes else curr_v
    med_v = statistics.median(volumes) if volumes else curr_v

    # Relative Volume (RVOL)
    rvol = round((curr_v / avg_v) if avg_v > 0 else 1.0, 2)
    dev_pct = round(((curr_v - avg_v) / avg_v * 100) if avg_v > 0 else 0.0, 1)
    is_spike = rvol >= 2.0

    # Volume state classification
    if rvol >= 1.3:
        vol_state: VolumeState = "ELEVATED"
    elif rvol <= 0.6:
        vol_state = "UNUSUALLY_LOW"
    else:
        vol_state = "NORMAL"

    # Price / Volume Relationship
    price_up = curr_c > curr_o
    price_down = curr_c < curr_o

    if price_up and rvol >= 1.3:
        pv_rel: PriceVolumeRelation = "ACCUMULATION"
    elif price_down and rvol >= 1.3:
        pv_rel = "DISTRIBUTION"
    elif price_up and rvol <= 0.6:
        pv_rel = "LOW_VOLUME_ADVANCE"
    elif price_down and rvol <= 0.6:
        pv_rel = "LOW_VOLUME_PULLBACK"
    else:
        pv_rel = "NEUTRAL"

    # Volume-confirmed breakout detection
    # Checks if current close is higher than highest close in last 10 prior bars + elevated volume
    breakout_confirmed = False
    if len(prior_candles) >= 5 and rvol >= 1.3 and price_up:
        recent_highs = [float(c["high"]) for c in prior_candles[-10:]]
        if curr_c >= max(recent_highs):
            breakout_confirmed = True

    # Volume Divergence Check
    # If price reached a new 10-bar high, but volume is lower than 50% of the baseline
    divergence_flag: str | None = None
    if len(prior_candles) >= 5 and curr_h >= max(float(c["high"]) for c in prior_candles[-10:]):
        if rvol < 0.7:
            divergence_flag = "BEARISH_DIVERGENCE_RISK (New price high on sub-par volume)"
    elif len(prior_candles) >= 5 and float(latest["low"]) <= min(float(c["low"]) for c in prior_candles[-10:]):
        if rvol < 0.7:
            divergence_flag = "BULLISH_ABSORPTION_RISK (New price low on drying volume)"

    explanation_parts = [
        f"Current volume {curr_v:,.0f} represents {rvol:.2f}x of the {len(volumes)}-session baseline (avg: {avg_v:,.0f}, median: {med_v:,.0f}).",
        f"Volume state: {vol_state} ({'+' if dev_pct >= 0 else ''}{dev_pct}% vs average).",
        f"Price/Volume dynamic: {pv_rel}.",
    ]
    if is_spike:
        explanation_parts.append("Volume spike flag active (>= 2.0x normal activity).")
    if breakout_confirmed:
        explanation_parts.append("Volume confirms breakout above recent session highs.")
    if divergence_flag:
        explanation_parts.append(divergence_flag)

    return VolumeAnalytics(
        symbol=symbol,
        current_volume=round(curr_v, 2),
        baseline_avg_volume=round(avg_v, 2),
        baseline_median_volume=round(med_v, 2),
        rvol=rvol,
        volume_deviation_pct=dev_pct,
        is_volume_spike=is_spike,
        volume_state=vol_state,
        price_volume_relationship=pv_rel,
        breakout_confirmed=breakout_confirmed,
        divergence_flag=divergence_flag,
        explanation=" ".join(explanation_parts),
    )
