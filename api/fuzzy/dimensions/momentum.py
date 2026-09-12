"""
api/fuzzy/dimensions/momentum.py
────────────────────────────────────────────────────────────────────────────
MomentumFIS — Fuzzy Inference System for price momentum interpretation.

Inputs (derived from EMAService outputs):
  • ema_spread      : (EMA-9 − EMA-20) / price × 100   [%]
  • price_vs_ema20  : (price − EMA-20) / price × 100   [%]

Output linguistic labels:
  WEAK | MODERATE | STRONG | SURGING

This FIS interprets how much momentum is present based on two EMA-derived
inputs. It does NOT predict future price movement — it linguistically
describes the CURRENT momentum state.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from api.fuzzy.membership import (
    LinguisticVariable,
    MembershipResult,
    trimf,
    trapmf,
)
from api.fuzzy.rules import (
    Condition,
    Conclusion,
    FuzzyRule,
    FiredRule,
    RuleBase,
    build_activations_map,
    defuzzify_max_membership,
)


# ---------------------------------------------------------------------------
# Linguistic Variables — EMA Spread (%)
# ---------------------------------------------------------------------------

_EMA_SPREAD_VAR = LinguisticVariable(
    name="ema_spread",
    terms=[
        ("STRONGLY_NEGATIVE", lambda x: trapmf(x, -20.0, -20.0, -3.0, -1.5)),
        ("NEGATIVE",          lambda x: trimf(x, -3.0, -1.0, -0.2)),
        ("FLAT",              lambda x: trimf(x, -0.4, 0.0, 0.4)),
        ("SMALL_POSITIVE",    lambda x: trimf(x, 0.1, 0.6, 1.5)),
        ("LARGE_POSITIVE",    lambda x: trapmf(x, 1.0, 2.0, 20.0, 20.0)),
    ],
)

# ---------------------------------------------------------------------------
# Linguistic Variables — Price vs EMA-20 (%)
# ---------------------------------------------------------------------------

_PRICE_VS_EMA20_VAR = LinguisticVariable(
    name="price_vs_ema20",
    terms=[
        ("FAR_BELOW", lambda x: trapmf(x, -30.0, -30.0, -3.0, -1.5)),
        ("BELOW",     lambda x: trimf(x, -3.0, -1.0, -0.2)),
        ("AT",        lambda x: trimf(x, -0.4, 0.0, 0.4)),
        ("ABOVE",     lambda x: trimf(x, 0.1, 1.0, 3.0)),
        ("FAR_ABOVE", lambda x: trapmf(x, 2.0, 3.5, 30.0, 30.0)),
    ],
)

# ---------------------------------------------------------------------------
# Mamdani Rule Base — Momentum
# ---------------------------------------------------------------------------

_MOMENTUM_RULES = RuleBase(
    output_variable="momentum",
    rules=[
        # ── SURGING ─────────────────────────────────────────────────────
        FuzzyRule(
            antecedent=(
                Condition("ema_spread", "LARGE_POSITIVE"),
                Condition("price_vs_ema20", "FAR_ABOVE"),
            ),
            consequent=Conclusion("momentum", "SURGING"),
            weight=1.0,
            description="EMA-9 far above EMA-20 AND price far above EMA-20 → momentum SURGING",
        ),
        FuzzyRule(
            antecedent=(
                Condition("ema_spread", "LARGE_POSITIVE"),
                Condition("price_vs_ema20", "ABOVE"),
            ),
            consequent=Conclusion("momentum", "SURGING"),
            weight=0.9,
            description="EMA-9 well above EMA-20 AND price above EMA-20 → momentum SURGING",
        ),
        # ── STRONG ──────────────────────────────────────────────────────
        FuzzyRule(
            antecedent=(
                Condition("ema_spread", "SMALL_POSITIVE"),
                Condition("price_vs_ema20", "FAR_ABOVE"),
            ),
            consequent=Conclusion("momentum", "STRONG"),
            weight=1.0,
            description="EMA spread moderate AND price far above EMA-20 → STRONG",
        ),
        FuzzyRule(
            antecedent=(
                Condition("ema_spread", "SMALL_POSITIVE"),
                Condition("price_vs_ema20", "ABOVE"),
            ),
            consequent=Conclusion("momentum", "STRONG"),
            weight=0.9,
            description="EMA spread moderate AND price above EMA-20 → STRONG",
        ),
        FuzzyRule(
            antecedent=(
                Condition("ema_spread", "LARGE_POSITIVE"),
                Condition("price_vs_ema20", "AT"),
            ),
            consequent=Conclusion("momentum", "STRONG"),
            weight=0.8,
            description="EMA-9 well above EMA-20 but price near EMA-20 → STRONG (retest)",
        ),
        # ── MODERATE ────────────────────────────────────────────────────
        FuzzyRule(
            antecedent=(
                Condition("ema_spread", "FLAT"),
                Condition("price_vs_ema20", "ABOVE"),
            ),
            consequent=Conclusion("momentum", "MODERATE"),
            weight=0.9,
            description="EMAs converged AND price above EMA-20 → MODERATE",
        ),
        FuzzyRule(
            antecedent=(
                Condition("ema_spread", "FLAT"),
                Condition("price_vs_ema20", "AT"),
            ),
            consequent=Conclusion("momentum", "MODERATE"),
            weight=0.8,
            description="EMAs converged AND price at EMA-20 → MODERATE (consolidation)",
        ),
        FuzzyRule(
            antecedent=(
                Condition("ema_spread", "SMALL_POSITIVE"),
                Condition("price_vs_ema20", "AT"),
            ),
            consequent=Conclusion("momentum", "MODERATE"),
            weight=0.7,
            description="Small positive EMA spread AND price at EMA-20 → MODERATE",
        ),
        # ── WEAK ────────────────────────────────────────────────────────
        FuzzyRule(
            antecedent=(
                Condition("ema_spread", "NEGATIVE"),
                Condition("price_vs_ema20", "BELOW"),
            ),
            consequent=Conclusion("momentum", "WEAK"),
            weight=1.0,
            description="EMA-9 below EMA-20 AND price below EMA-20 → WEAK",
        ),
        FuzzyRule(
            antecedent=(
                Condition("ema_spread", "STRONGLY_NEGATIVE"),
            ),
            consequent=Conclusion("momentum", "WEAK"),
            weight=1.0,
            description="EMA-9 strongly below EMA-20 → WEAK regardless of price",
        ),
        FuzzyRule(
            antecedent=(
                Condition("price_vs_ema20", "FAR_BELOW"),
            ),
            consequent=Conclusion("momentum", "WEAK"),
            weight=0.95,
            description="Price far below EMA-20 → WEAK momentum",
        ),
        FuzzyRule(
            antecedent=(
                Condition("ema_spread", "NEGATIVE"),
                Condition("price_vs_ema20", "AT"),
            ),
            consequent=Conclusion("momentum", "WEAK"),
            weight=0.75,
            description="EMA-9 below EMA-20 but price near EMA-20 → WEAK (fading)",
        ),
        FuzzyRule(
            antecedent=(
                Condition("ema_spread", "FLAT"),
                Condition("price_vs_ema20", "BELOW"),
            ),
            consequent=Conclusion("momentum", "WEAK"),
            weight=0.7,
            description="EMAs converged but price below EMA-20 → WEAK",
        ),
    ],
)


# ---------------------------------------------------------------------------
# MomentumFIS — Public Interface
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class MomentumInputs:
    """Pre-computed numeric inputs for the Momentum FIS."""
    ema_spread_pct: float    # (ema9 - ema20) / price * 100
    price_vs_ema20_pct: float  # (price - ema20) / price * 100


@dataclass(frozen=True)
class MomentumFISResult:
    """Structured output from the Momentum FIS evaluation."""
    label: str                              # winning linguistic label
    activation: float                       # defuzzified activation (0.0–1.0)
    ema_spread_activations: list[dict[str, Any]]   # all term memberships for ema_spread
    price_vs_ema20_activations: list[dict[str, Any]]  # all term memberships for price_vs_ema20
    fired_rules: list[dict[str, Any]]       # rules evaluated (sorted by activation)
    narrative: str                          # human-readable linguistic summary
    inputs: dict[str, float]                # raw numeric inputs for audit

    def to_dict(self) -> dict[str, Any]:
        return {
            "label": self.label,
            "activation": self.activation,
            "ema_spread_activations": self.ema_spread_activations,
            "price_vs_ema20_activations": self.price_vs_ema20_activations,
            "fired_rules": self.fired_rules,
            "narrative": self.narrative,
            "inputs": self.inputs,
        }


class MomentumFIS:
    """
    Momentum Fuzzy Inference System.

    Evaluates EMA-based price momentum and returns a linguistic label
    (WEAK / MODERATE / STRONG / SURGING) with full activation transparency.
    """

    @staticmethod
    def evaluate(inputs: MomentumInputs) -> MomentumFISResult:
        x_spread = inputs.ema_spread_pct
        x_price = inputs.price_vs_ema20_pct

        # Step 1: Fuzzify both input variables
        spread_mfs: list[MembershipResult] = _EMA_SPREAD_VAR.fuzzify(x_spread)
        price_mfs: list[MembershipResult] = _PRICE_VS_EMA20_VAR.fuzzify(x_price)

        # Step 2: Build activations map for rule evaluation
        activations: dict[str, dict[str, float]] = {}
        activations.update(build_activations_map("ema_spread", spread_mfs))
        activations.update(build_activations_map("price_vs_ema20", price_mfs))

        # Step 3: Evaluate rule base
        fired: list[FiredRule] = _MOMENTUM_RULES.evaluate(activations)

        # Step 4: Defuzzify
        label, act = defuzzify_max_membership(fired)

        # Step 5: Build narrative
        spread_dominant = _EMA_SPREAD_VAR.dominant_term(x_spread)
        price_dominant = _PRICE_VS_EMA20_VAR.dominant_term(x_price)
        narrative = (
            f"EMA-9 spread vs EMA-20 is {x_spread:+.2f}% (classified as {spread_dominant}). "
            f"Price sits {x_price:+.2f}% relative to EMA-20 (classified as {price_dominant}). "
            f"Mamdani inference yields momentum label: {label} with activation {act:.2f}."
        )

        return MomentumFISResult(
            label=label,
            activation=act,
            ema_spread_activations=[mr.to_dict() for mr in spread_mfs],
            price_vs_ema20_activations=[mr.to_dict() for mr in price_mfs],
            fired_rules=[fr.to_dict() for fr in fired],
            narrative=narrative,
            inputs={
                "ema_spread_pct": round(x_spread, 4),
                "price_vs_ema20_pct": round(x_price, 4),
            },
        )

    @staticmethod
    def extract_inputs(
        current_price: float,
        ema9: float | None,
        ema20: float | None,
    ) -> MomentumInputs:
        """
        Derive MomentumInputs from raw EMA values.

        Parameters
        ----------
        current_price : float — latest close price
        ema9          : float | None — current EMA-9 value
        ema20         : float | None — current EMA-20 value
        """
        if current_price <= 0 or ema9 is None or ema20 is None:
            return MomentumInputs(ema_spread_pct=0.0, price_vs_ema20_pct=0.0)

        raw_spread = (ema9 - ema20) / current_price * 100.0
        # Clip spread to [-5.0%, +5.0%] to prevent penny stock / outlier distortion
        ema_spread_pct = max(-5.0, min(5.0, raw_spread))
        price_vs_ema20_pct = (current_price - ema20) / current_price * 100.0

        return MomentumInputs(
            ema_spread_pct=round(ema_spread_pct, 4),
            price_vs_ema20_pct=round(price_vs_ema20_pct, 4),
        )
