"""
api/fuzzy/dimensions/trend.py
────────────────────────────────────────────────────────────────────────────
TrendFIS — Fuzzy Inference System for trend strength interpretation.

Inputs (derived from EMAService / SMAService / SignalAlignmentDTO):
  • price_vs_sma200_pct : (price − SMA-200) / price × 100   [%]
  • alignment_score     : (bullish_count − bearish_count) / total_count   [−1.0, +1.0]

Output linguistic labels:
  BEARISH | NEUTRAL | BULLISH | STRONGLY_BULLISH

This FIS describes where price sits relative to the long-term SMA and whether
multiple analytical signals are aligned. It describes CURRENT structural positioning,
not future direction.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from api.fuzzy.membership import (
    LinguisticVariable,
    MembershipResult,
    trapmf,
    trimf,
)
from api.fuzzy.rules import (
    Conclusion,
    Condition,
    FiredRule,
    FuzzyRule,
    RuleBase,
    build_activations_map,
    defuzzify_max_membership,
)

# ---------------------------------------------------------------------------
# Linguistic Variables — Price vs SMA-200 (%)
# ---------------------------------------------------------------------------

_PRICE_VS_SMA200_VAR = LinguisticVariable(
    name="price_vs_sma200",
    terms=[
        ("FAR_BELOW",    lambda x: trapmf(x, -60.0, -60.0, -8.0, -4.0)),
        ("BELOW",        lambda x: trimf(x, -6.0, -2.5, -0.3)),
        ("AT",           lambda x: trimf(x, -1.0, 0.0, 1.0)),
        ("ABOVE",        lambda x: trimf(x, 0.3, 3.0, 8.0)),
        ("FAR_ABOVE",    lambda x: trapmf(x, 6.0, 12.0, 60.0, 60.0)),
    ],
)

# ---------------------------------------------------------------------------
# Linguistic Variables — Signal Alignment Score (−1 to +1)
# ---------------------------------------------------------------------------

_ALIGNMENT_VAR = LinguisticVariable(
    name="alignment_score",
    terms=[
        ("STRONGLY_BEARISH", lambda x: trapmf(x, -1.0, -1.0, -0.6, -0.35)),
        ("BEARISH",          lambda x: trimf(x, -0.7, -0.35, -0.05)),
        ("NEUTRAL",          lambda x: trimf(x, -0.2, 0.0, 0.2)),
        ("BULLISH",          lambda x: trimf(x, 0.05, 0.35, 0.7)),
        ("STRONGLY_BULLISH", lambda x: trapmf(x, 0.35, 0.6, 1.0, 1.0)),
    ],
)

# ---------------------------------------------------------------------------
# Mamdani Rule Base — Trend
# ---------------------------------------------------------------------------

_TREND_RULES = RuleBase(
    output_variable="trend",
    rules=[
        # ── STRONGLY_BULLISH ─────────────────────────────────────────────
        FuzzyRule(
            antecedent=(
                Condition("price_vs_sma200", "FAR_ABOVE"),
                Condition("alignment_score", "STRONGLY_BULLISH"),
            ),
            consequent=Conclusion("trend", "STRONGLY_BULLISH"),
            weight=1.0,
            description="Price far above SMA-200 AND signals strongly aligned bullish → STRONGLY_BULLISH",
        ),
        FuzzyRule(
            antecedent=(
                Condition("price_vs_sma200", "ABOVE"),
                Condition("alignment_score", "STRONGLY_BULLISH"),
            ),
            consequent=Conclusion("trend", "STRONGLY_BULLISH"),
            weight=0.9,
            description="Price above SMA-200 AND all signals bullish → STRONGLY_BULLISH",
        ),
        FuzzyRule(
            antecedent=(
                Condition("price_vs_sma200", "FAR_ABOVE"),
                Condition("alignment_score", "BULLISH"),
            ),
            consequent=Conclusion("trend", "STRONGLY_BULLISH"),
            weight=0.85,
            description="Price far above SMA-200 with bullish alignment → STRONGLY_BULLISH",
        ),
        # ── BULLISH ──────────────────────────────────────────────────────
        FuzzyRule(
            antecedent=(
                Condition("price_vs_sma200", "ABOVE"),
                Condition("alignment_score", "BULLISH"),
            ),
            consequent=Conclusion("trend", "BULLISH"),
            weight=1.0,
            description="Price above SMA-200 AND bullish signal alignment → BULLISH",
        ),
        FuzzyRule(
            antecedent=(
                Condition("price_vs_sma200", "AT"),
                Condition("alignment_score", "BULLISH"),
            ),
            consequent=Conclusion("trend", "BULLISH"),
            weight=0.85,
            description="Price at SMA-200 with bullish alignment → BULLISH (support hold)",
        ),
        FuzzyRule(
            antecedent=(
                Condition("price_vs_sma200", "ABOVE"),
                Condition("alignment_score", "NEUTRAL"),
            ),
            consequent=Conclusion("trend", "BULLISH"),
            weight=0.75,
            description="Price above SMA-200 with mixed signals → BULLISH (weak conviction)",
        ),
        # ── NEUTRAL ──────────────────────────────────────────────────────
        FuzzyRule(
            antecedent=(
                Condition("price_vs_sma200", "AT"),
                Condition("alignment_score", "NEUTRAL"),
            ),
            consequent=Conclusion("trend", "NEUTRAL"),
            weight=1.0,
            description="Price at SMA-200 with neutral alignment → NEUTRAL (decision zone)",
        ),
        FuzzyRule(
            antecedent=(
                Condition("price_vs_sma200", "BELOW"),
                Condition("alignment_score", "BULLISH"),
            ),
            consequent=Conclusion("trend", "NEUTRAL"),
            weight=0.8,
            description="Price below SMA-200 but signals turning bullish → NEUTRAL (recovery attempt)",
        ),
        FuzzyRule(
            antecedent=(
                Condition("price_vs_sma200", "ABOVE"),
                Condition("alignment_score", "BEARISH"),
            ),
            consequent=Conclusion("trend", "NEUTRAL"),
            weight=0.75,
            description="Price above SMA-200 but signals bearish → NEUTRAL (distribution zone)",
        ),
        FuzzyRule(
            antecedent=(
                Condition("price_vs_sma200", "AT"),
                Condition("alignment_score", "BEARISH"),
            ),
            consequent=Conclusion("trend", "NEUTRAL"),
            weight=0.7,
            description="Price at SMA-200 with bearish alignment → NEUTRAL (fragile support)",
        ),
        # ── BEARISH ──────────────────────────────────────────────────────
        FuzzyRule(
            antecedent=(
                Condition("price_vs_sma200", "BELOW"),
                Condition("alignment_score", "BEARISH"),
            ),
            consequent=Conclusion("trend", "BEARISH"),
            weight=1.0,
            description="Price below SMA-200 AND bearish alignment → BEARISH",
        ),
        FuzzyRule(
            antecedent=(
                Condition("price_vs_sma200", "BELOW"),
                Condition("alignment_score", "NEUTRAL"),
            ),
            consequent=Conclusion("trend", "BEARISH"),
            weight=0.8,
            description="Price below SMA-200 with mixed signals → BEARISH (structural weakness)",
        ),
        FuzzyRule(
            antecedent=(
                Condition("price_vs_sma200", "FAR_BELOW"),
            ),
            consequent=Conclusion("trend", "BEARISH"),
            weight=0.95,
            description="Price far below SMA-200 → BEARISH regardless of signal alignment",
        ),
        FuzzyRule(
            antecedent=(
                Condition("price_vs_sma200", "BELOW"),
                Condition("alignment_score", "STRONGLY_BEARISH"),
            ),
            consequent=Conclusion("trend", "BEARISH"),
            weight=1.0,
            description="Price below SMA-200 AND strongly bearish signals → BEARISH (confirmed downtrend)",
        ),
        FuzzyRule(
            antecedent=(
                Condition("price_vs_sma200", "FAR_BELOW"),
                Condition("alignment_score", "STRONGLY_BEARISH"),
            ),
            consequent=Conclusion("trend", "BEARISH"),
            weight=1.0,
            description="Price far below SMA-200 AND strongly bearish → BEARISH (severe downtrend)",
        ),
    ],
)


# ---------------------------------------------------------------------------
# TrendFIS — Public Interface
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class TrendInputs:
    """Pre-computed numeric inputs for the Trend FIS."""
    price_vs_sma200_pct: float   # (price - sma200) / price * 100
    alignment_score: float        # -1.0 to +1.0 (from SignalAlignmentDTO)


@dataclass(frozen=True)
class TrendFISResult:
    """Structured output from the Trend FIS evaluation."""
    label: str
    activation: float
    price_vs_sma200_activations: list[dict[str, Any]]
    alignment_activations: list[dict[str, Any]]
    fired_rules: list[dict[str, Any]]
    narrative: str
    inputs: dict[str, float]

    def to_dict(self) -> dict[str, Any]:
        return {
            "label": self.label,
            "activation": self.activation,
            "price_vs_sma200_activations": self.price_vs_sma200_activations,
            "alignment_activations": self.alignment_activations,
            "fired_rules": self.fired_rules,
            "narrative": self.narrative,
            "inputs": self.inputs,
        }


class TrendFIS:
    """
    Trend Fuzzy Inference System.

    Evaluates long-term trend position and signal alignment → BEARISH / NEUTRAL / BULLISH / STRONGLY_BULLISH.
    """

    @staticmethod
    def evaluate(inputs: TrendInputs) -> TrendFISResult:
        x_sma = inputs.price_vs_sma200_pct
        x_align = inputs.alignment_score

        sma_mfs: list[MembershipResult] = _PRICE_VS_SMA200_VAR.fuzzify(x_sma)
        align_mfs: list[MembershipResult] = _ALIGNMENT_VAR.fuzzify(x_align)

        activations: dict[str, dict[str, float]] = {}
        activations.update(build_activations_map("price_vs_sma200", sma_mfs))
        activations.update(build_activations_map("alignment_score", align_mfs))

        fired: list[FiredRule] = _TREND_RULES.evaluate(activations)
        label, act = defuzzify_max_membership(fired)

        sma_dominant = _PRICE_VS_SMA200_VAR.dominant_term(x_sma)
        align_dominant = _ALIGNMENT_VAR.dominant_term(x_align)

        narrative = (
            f"Price is {x_sma:+.2f}% relative to SMA-200 (classified as {sma_dominant}). "
            f"Signal alignment score is {x_align:+.2f} (classified as {align_dominant}). "
            f"Mamdani inference yields trend label: {label} with activation {act:.2f}."
        )

        return TrendFISResult(
            label=label,
            activation=act,
            price_vs_sma200_activations=[mr.to_dict() for mr in sma_mfs],
            alignment_activations=[mr.to_dict() for mr in align_mfs],
            fired_rules=[fr.to_dict() for fr in fired],
            narrative=narrative,
            inputs={
                "price_vs_sma200_pct": round(x_sma, 4),
                "alignment_score": round(x_align, 4),
            },
        )

    @staticmethod
    def calculate_deterministic_alignment(
        current_price: float,
        ema9: float | None = None,
        ema20: float | None = None,
        sma50: float | None = None,
        sma200: float | None = None,
        swing_structure: str | None = None,
        pattern_direction: str | None = None,
    ) -> float:
        """
        Deterministic 6-signal market alignment in [-1.0, +1.0]:
        1. Price > EMA20        : +1 if True else -1
        2. EMA9 > EMA20         : +1 if True else -1
        3. EMA20 > SMA50        : +1 if True else -1
        4. Price > SMA200       : +1 if True else -1
        5. HH/HL structure      : +1 if 'HIGHER_HIGHS_AND_LOWS', -1 if 'LOWER_HIGHS_AND_LOWS', else 0
        6. Bullish pattern      : +1 if 'bullish', -1 if 'bearish', else 0

        Alignment = sum(signal_i) / 6.0
        """
        signals: list[float] = []

        # 1. Price > EMA20
        if ema20 and current_price > 0:
            signals.append(1.0 if current_price > ema20 else -1.0)
        else:
            signals.append(0.0)

        # 2. EMA9 > EMA20
        if ema9 and ema20:
            signals.append(1.0 if ema9 > ema20 else -1.0)
        else:
            signals.append(0.0)

        # 3. EMA20 > SMA50
        if ema20 and sma50:
            signals.append(1.0 if ema20 > sma50 else -1.0)
        else:
            signals.append(0.0)

        # 4. Price > SMA200
        if sma200 and current_price > 0:
            signals.append(1.0 if current_price > sma200 else -1.0)
        else:
            signals.append(0.0)

        # 5. HH/HL structure
        if swing_structure == "HIGHER_HIGHS_AND_LOWS":
            signals.append(1.0)
        elif swing_structure == "LOWER_HIGHS_AND_LOWS":
            signals.append(-1.0)
        else:
            signals.append(0.0)

        # 6. Bullish pattern
        if pattern_direction == "bullish":
            signals.append(1.0)
        elif pattern_direction == "bearish":
            signals.append(-1.0)
        else:
            signals.append(0.0)

        alignment = sum(signals) / 6.0
        return max(-1.0, min(1.0, alignment))

    @staticmethod
    def extract_inputs(
        current_price: float,
        sma200: float | None,
        alignment_score: float | None = None,
        ema9: float | None = None,
        ema20: float | None = None,
        sma50: float | None = None,
        swing_structure: str | None = None,
        pattern_direction: str | None = None,
        bullish_count: int = 0,
        bearish_count: int = 0,
        total_conditions: int = 0,
    ) -> TrendInputs:
        """
        Derive TrendInputs from SMA and deterministic 6-signal alignment.
        """
        if current_price <= 0 or sma200 is None or sma200 <= 0:
            price_vs_sma200_pct = 0.0
        else:
            price_vs_sma200_pct = (current_price - sma200) / current_price * 100.0

        if alignment_score is not None:
            final_align = alignment_score
        elif ema20 is not None or sma50 is not None or swing_structure is not None:
            final_align = TrendFIS.calculate_deterministic_alignment(
                current_price=current_price,
                ema9=ema9,
                ema20=ema20,
                sma50=sma50,
                sma200=sma200,
                swing_structure=swing_structure,
                pattern_direction=pattern_direction,
            )
        elif total_conditions > 0:
            final_align = (bullish_count - bearish_count) / total_conditions
        else:
            final_align = 0.0

        return TrendInputs(
            price_vs_sma200_pct=round(price_vs_sma200_pct, 4),
            alignment_score=round(max(-1.0, min(1.0, final_align)), 4),
        )
