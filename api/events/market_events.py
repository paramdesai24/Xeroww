"""
api/events/market_events.py
───────────────────────────
Domain events for the Market Data and Analytics aggregate.
Represents real-time quotes, technical pattern identifications, regime shifts, and S/R breaks.
"""

from dataclasses import dataclass
from typing import Any
from api.events.base import DomainEvent


@dataclass(frozen=True)
class MarketSnapshotReceived(DomainEvent):
    """Fired whenever a market snapshot / quote is fetched or ingested."""

    @classmethod
    def create(
        cls,
        symbol: str,
        price: float,
        volume: int | float,
        timestamp: str | None = None,
        change: float | None = None,
        change_pct: float | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> "MarketSnapshotReceived":
        payload = {
            "symbol": symbol.upper(),
            "price": price,
            "volume": volume,
            "timestamp": timestamp,
            "change": change,
            "change_pct": change_pct,
        }
        return cls(
            event_type="market.snapshot_received",
            aggregate_id=f"symbol:{symbol.upper()}",
            payload=payload,
            metadata=metadata or {},
        )


@dataclass(frozen=True)
class PatternDetected(DomainEvent):
    """Fired when a technical candlestick pattern is recognized by pattern detection engines."""

    @classmethod
    def create(
        cls,
        symbol: str,
        pattern_name: str,
        confidence: float,
        direction: str,
        candle_index: int | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> "PatternDetected":
        payload = {
            "symbol": symbol.upper(),
            "pattern_name": pattern_name,
            "confidence": confidence,
            "direction": direction,
            "candle_index": candle_index,
        }
        return cls(
            event_type="market.pattern_detected",
            aggregate_id=f"symbol:{symbol.upper()}",
            payload=payload,
            metadata=metadata or {},
        )


@dataclass(frozen=True)
class RegimeChanged(DomainEvent):
    """Fired when market regime classification transitions (e.g. RANGING -> TRENDING_UP)."""

    @classmethod
    def create(
        cls,
        symbol: str,
        old_regime: str,
        new_regime: str,
        confidence: float = 1.0,
        metadata: dict[str, Any] | None = None,
    ) -> "RegimeChanged":
        payload = {
            "symbol": symbol.upper(),
            "old_regime": old_regime,
            "new_regime": new_regime,
            "confidence": confidence,
        }
        return cls(
            event_type="market.regime_changed",
            aggregate_id=f"symbol:{symbol.upper()}",
            payload=payload,
            metadata=metadata or {},
        )


@dataclass(frozen=True)
class SupportResistanceBroken(DomainEvent):
    """Fired when price violates a validated support or resistance key level."""

    @classmethod
    def create(
        cls,
        symbol: str,
        level: float,
        level_type: str,  # 'SUPPORT' or 'RESISTANCE'
        break_price: float,
        direction: str,   # 'BULLISH_BREAKOUT' or 'BEARISH_BREAKDOWN'
        metadata: dict[str, Any] | None = None,
    ) -> "SupportResistanceBroken":
        payload = {
            "symbol": symbol.upper(),
            "level": level,
            "level_type": level_type,
            "break_price": break_price,
            "direction": direction,
        }
        return cls(
            event_type="market.support_resistance_broken",
            aggregate_id=f"symbol:{symbol.upper()}",
            payload=payload,
            metadata=metadata or {},
        )
