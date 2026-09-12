"""
api/analytics/structure.py
──────────────────────────
Pure deterministic Market Structure service (Regime + Confluence) and typed DTOs.
Evaluates trend taxonomy and signal alignment confluence with zero ML or predictive logic.
"""

from dataclasses import dataclass, asdict
from typing import Any, Literal

from api.services.market_regime_service import classify_market_regime
from api.services.signal_alignment_service import evaluate_signal_alignment


RegimeType = Literal[
    "TRENDING_UP",
    "TRENDING_DOWN",
    "RANGE_BOUND",
    "HIGH_VOLATILITY",
    "LOW_ACTIVITY",
    "MIXED",
]

DominantBias = Literal[
    "BULLISH_CONFLUENCE",
    "BEARISH_CONFLUENCE",
    "NEUTRAL_MIXED",
]


@dataclass(frozen=True)
class MarketRegimeDTO:
    symbol: str
    regime: RegimeType
    reasons: list[str]
    current_price: float
    atr_pct: float
    rvol: float
    swing_structure: str
    ema_trend: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class AlignmentConditionDTO:
    condition_id: str
    label: str
    bias: Literal["bullish", "bearish"]
    satisfied: bool
    description: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class SignalAlignmentDTO:
    symbol: str
    current_price: float
    bullish_alignment_count: int
    bearish_alignment_count: int
    alignment_total: int
    dominant_bias: DominantBias
    conditions: list[dict[str, Any]]
    factual_summary: str
    methodology_note: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class StructureDTO:
    symbol: str
    current_price: float
    regime: MarketRegimeDTO
    alignment: SignalAlignmentDTO

    def to_dict(self) -> dict[str, Any]:
        return {
            "symbol": self.symbol,
            "current_price": self.current_price,
            "regime": self.regime.to_dict(),
            "alignment": self.alignment.to_dict(),
        }


class StructureService:
    """
    Stateless service analyzing macroeconomic regime states and multi-condition confluence.
    """

    @staticmethod
    def classify_regime(candles: list[dict[str, Any]], symbol: str) -> MarketRegimeDTO:
        """
        Classify market into deterministic structural regime:
        TRENDING_UP, TRENDING_DOWN, RANGE_BOUND, HIGH_VOLATILITY, LOW_ACTIVITY, MIXED.
        """
        raw = classify_market_regime(candles, symbol)
        d = raw.to_dict()
        return MarketRegimeDTO(
            symbol=d["symbol"],
            regime=d["regime"],
            reasons=list(d["reasons"]),
            current_price=float(d["current_price"]),
            atr_pct=float(d["atr_pct"]),
            rvol=float(d["rvol"]),
            swing_structure=str(d["swing_structure"]),
            ema_trend=str(d["ema_trend"]),
        )

    @staticmethod
    def evaluate_alignment(candles: list[dict[str, Any]], symbol: str) -> SignalAlignmentDTO:
        """
        Compute deterministic multi-condition confluence score and bias checklist.
        """
        raw = evaluate_signal_alignment(candles, symbol)
        d = raw.to_dict()
        return SignalAlignmentDTO(
            symbol=d["symbol"],
            current_price=float(d["current_price"]),
            bullish_alignment_count=int(d["bullish_alignment_count"]),
            bearish_alignment_count=int(d["bearish_alignment_count"]),
            alignment_total=int(d["alignment_total"]),
            dominant_bias=d["dominant_bias"],
            conditions=list(d["conditions"]),
            factual_summary=str(d["factual_summary"]),
            methodology_note=str(d["methodology_note"]),
        )

    @classmethod
    def analyze_structure(cls, candles: list[dict[str, Any]], symbol: str) -> StructureDTO:
        """
        Execute combined structural analysis pipeline.
        """
        curr_price = float(candles[-1]["close"]) if candles else 0.0
        regime = cls.classify_regime(candles, symbol)
        alignment = cls.evaluate_alignment(candles, symbol)
        return StructureDTO(
            symbol=symbol,
            current_price=round(curr_price, 2),
            regime=regime,
            alignment=alignment,
        )
