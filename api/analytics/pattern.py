"""
api/analytics/pattern.py
────────────────────────
Pure deterministic Candlestick Pattern detection service and typed DTOs.
Wraps core mathematical pattern scanning logic into isolated services.
"""

from dataclasses import dataclass, asdict
from typing import Any, Literal

from api.services.pattern_engine import scan_patterns, extract_metrics, detect_marubozu_candle
from api.services.contextual_pattern_service import enrich_pattern_with_context
from api.core.config import settings


@dataclass(frozen=True)
class CandleSummaryDTO:
    date: str
    open: float
    high: float
    low: float
    close: float
    body_pct: float
    range_pct: float
    direction: Literal["bullish", "bearish", "doji"]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class PatternDetectionDTO:
    pattern_id: str
    pattern_name: str
    category: str
    direction: Literal["bullish", "bearish", "neutral"]
    candle_index: int
    candle_date: str
    confidence: float
    explanation: str
    stop_loss: float | None
    target: float | None
    context: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class ContextualPatternDTO:
    base_pattern: dict[str, Any]
    trend_context: str
    volume_confirmation: bool
    sr_proximity: str
    composite_confluence_score: float
    institutional_verdict: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class MarubozuResultDTO:
    symbol: str
    display_name: str
    pattern: str
    signal_day: str | None
    textbook_action: str
    rationale: str
    stop_loss: float | None
    latest_candle: CandleSummaryDTO
    data_note: str

    def to_dict(self) -> dict[str, Any]:
        res = asdict(self)
        res["latest_candle"] = self.latest_candle.to_dict()
        return res


class PatternService:
    """
    Stateless service for deterministic candlestick pattern recognition and single candle analytics.
    """

    @staticmethod
    def analyse_candle(candle: dict[str, Any]) -> CandleSummaryDTO:
        """
        Compute descriptive anatomy metrics for a single OHLCV candle.
        """
        o = float(candle.get("open", 0.0))
        h = float(candle.get("high", 0.0))
        l = float(candle.get("low", 0.0))  # noqa: E741
        c = float(candle.get("close", 0.0))

        day_range = h - l
        body = abs(c - o)

        body_pct = round((body / day_range * 100) if day_range > 0 else 0.0, 2)
        range_pct = round((day_range / o * 100) if o > 0 else 0.0, 2)

        if c > o:
            direction: Literal["bullish", "bearish", "doji"] = "bullish"
        elif c < o:
            direction = "bearish"
        else:
            direction = "doji"

        return CandleSummaryDTO(
            date=str(candle.get("time", "")),
            open=round(o, 2),
            high=round(h, 2),
            low=round(l, 2),
            close=round(c, 2),
            body_pct=body_pct,
            range_pct=range_pct,
            direction=direction,
        )

    @classmethod
    def scan(cls, candles: list[dict[str, Any]], lookback: int = 5) -> list[PatternDetectionDTO]:
        """
        Run deterministic multi-bar pattern scanning over historical candles.
        """
        raw_detections = scan_patterns(candles, lookback=lookback)
        results: list[PatternDetectionDTO] = []
        for det in raw_detections:
            d = det.to_dict()
            results.append(
                PatternDetectionDTO(
                    pattern_id=d["pattern_id"],
                    pattern_name=d["pattern_name"],
                    category=d["category"],
                    direction=d["direction"],
                    candle_index=d["candle_index"],
                    candle_date=d["candle_date"],
                    confidence=d["confidence"],
                    explanation=d["explanation"],
                    stop_loss=d.get("stop_loss"),
                    target=d.get("target"),
                    context=d.get("context", {}),
                )
            )
        return results

    @classmethod
    def enrich_context(
        cls,
        raw_or_dto_pattern: Any,
        candles: list[dict[str, Any]],
        symbol: str,
    ) -> ContextualPatternDTO | None:
        """
        Cross-reference detected pattern against structural context (S/R, volume, trend).
        """
        if hasattr(raw_or_dto_pattern, "to_dict"):
            raw_pattern = raw_or_dto_pattern
        else:
            raw_pattern = raw_or_dto_pattern

        try:
            enriched = enrich_pattern_with_context(raw_pattern, candles, symbol)
            if not enriched:
                return None
            e_dict = enriched.to_dict()
            return ContextualPatternDTO(
                base_pattern=e_dict.get("base_pattern", {}),
                trend_context=e_dict.get("trend_context", ""),
                volume_confirmation=bool(e_dict.get("volume_confirmation", False)),
                sr_proximity=e_dict.get("sr_proximity", ""),
                composite_confluence_score=float(e_dict.get("composite_confluence_score", 0.0)),
                institutional_verdict=e_dict.get("institutional_verdict", ""),
            )
        except Exception:
            return None

    @classmethod
    def detect_marubozu(
        cls,
        candles: list[dict[str, Any]],
        symbol: str,
        display_name: str,
    ) -> MarubozuResultDTO:
        """
        Run textbook Marubozu detection on latest candle.
        """
        if not candles:
            fallback_candle = CandleSummaryDTO(
                date="N/A", open=0.0, high=0.0, low=0.0, close=0.0,
                body_pct=0.0, range_pct=0.0, direction="doji",
            )
            return MarubozuResultDTO(
                symbol=symbol,
                display_name=display_name,
                pattern="none",
                signal_day=None,
                textbook_action="no_marubozu_detected",
                rationale=f"No candle data provided for {display_name}.",
                stop_loss=None,
                latest_candle=fallback_candle,
                data_note="Near real-time data — Yahoo Finance delayed feed",
            )

        latest = candles[-1]
        candle_summary = cls.analyse_candle(latest)
        metrics = extract_metrics(latest, index=len(candles) - 1)

        detection = detect_marubozu_candle(
            metrics,
            shadow_threshold=settings.MARUBOZU_SHADOW_THRESHOLD,
            min_body_ratio=settings.MARUBOZU_BODY_RANGE_RATIO,
        )

        if detection:
            pattern_key = "bullish_marubozu" if detection.direction == "bullish" else "bearish_marubozu"
            stop_loss = detection.context.get("stop_loss")
            return MarubozuResultDTO(
                symbol=symbol,
                display_name=display_name,
                pattern=pattern_key,
                signal_day=str(latest.get("time")),
                textbook_action="watch_next_session_for_confirmation",
                rationale=detection.explanation,
                stop_loss=stop_loss,
                latest_candle=candle_summary,
                data_note="Near real-time data — Yahoo Finance delayed feed",
            )

        return MarubozuResultDTO(
            symbol=symbol,
            display_name=display_name,
            pattern="none",
            signal_day=None,
            textbook_action="no_marubozu_detected",
            rationale=(
                f"No Marubozu pattern detected on the latest candle for {display_name}. "
                "The candle has visible shadows or an insufficient body-to-range ratio. "
                "Continue monitoring for a cleaner setup."
            ),
            stop_loss=None,
            latest_candle=candle_summary,
            data_note="Near real-time data — Yahoo Finance delayed feed",
        )
