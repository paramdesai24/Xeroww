"""
api/fuzzy/dimensions/structure.py
────────────────────────────────────────────────────────────────────────────
StructureFIS — Fuzzy Inference System for support/resistance structure quality.

Inputs (derived from SupportResistanceService + MarketRegimeDTO):
  • zone_proximity_pct : distance from price to nearest SR zone  [%]
  • regime_strength    : numeric encoding of market regime [0.0, 1.0]

Output linguistic labels:
  BROKEN | CONTESTED | FIRM | DOMINANT

This FIS describes whether the current price location is structurally meaningful
— i.e., whether it sits near zones that have historically provided support or
resistance, and whether the overall regime context supports that structure.
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
# Regime Strength Encoding
# (Maps string regime labels to numeric strength values)
# ---------------------------------------------------------------------------

REGIME_STRENGTH_MAP: dict[str, float] = {
    "TRENDING_UP":      0.85,
    "TRENDING_DOWN":    0.15,
    "RANGE_BOUND":      0.50,
    "HIGH_VOLATILITY":  0.35,
    "LOW_ACTIVITY":     0.25,
    "MIXED":            0.45,
}


def encode_regime_strength(regime: str) -> float:
    """Convert a string regime label to a numeric strength in [0.0, 1.0]."""
    return REGIME_STRENGTH_MAP.get(regime, 0.5)


# ---------------------------------------------------------------------------
# Linguistic Variables — Zone Proximity (% distance; lower = closer)
# ---------------------------------------------------------------------------

_ZONE_PROXIMITY_VAR = LinguisticVariable(
    name="zone_proximity",
    terms=[
        ("AT_ZONE",          lambda x: trapmf(x, 0.0, 0.0, 0.3, 0.6)),
        ("NEAR_ZONE",        lambda x: trimf(x, 0.3, 0.8, 1.8)),
        ("APPROACHING_ZONE", lambda x: trimf(x, 1.2, 2.5, 4.5)),
        ("BETWEEN_ZONES",    lambda x: trimf(x, 3.5, 6.0, 10.0)),
        ("FAR_FROM_ZONES",   lambda x: trapmf(x, 8.0, 12.0, 1000.0, 1000.0)),
    ],
)

# ---------------------------------------------------------------------------
# Linguistic Variables — Regime Strength [0.0, 1.0]
# ---------------------------------------------------------------------------

_REGIME_STRENGTH_VAR = LinguisticVariable(
    name="regime_strength",
    terms=[
        ("WEAK",    lambda x: trapmf(x, 0.0, 0.0, 0.2, 0.35)),
        ("FRAGILE", lambda x: trimf(x, 0.2, 0.35, 0.5)),
        ("MODERATE",lambda x: trimf(x, 0.4, 0.5, 0.65)),
        ("STRONG",  lambda x: trimf(x, 0.55, 0.75, 0.92)),
        ("DOMINANT",lambda x: trapmf(x, 0.8, 0.9, 1.0, 1.0)),
    ],
)

# ---------------------------------------------------------------------------
# Mamdani Rule Base — Structure
# ---------------------------------------------------------------------------

_STRUCTURE_RULES = RuleBase(
    output_variable="structure",
    rules=[
        # ── DOMINANT ─────────────────────────────────────────────────────
        FuzzyRule(
            antecedent=(
                Condition("zone_proximity", "AT_ZONE"),
                Condition("regime_strength", "DOMINANT"),
            ),
            consequent=Conclusion("structure", "DOMINANT"),
            weight=1.0,
            description="Price at key zone in a dominant trending regime → structure DOMINANT",
        ),
        FuzzyRule(
            antecedent=(
                Condition("zone_proximity", "AT_ZONE"),
                Condition("regime_strength", "STRONG"),
            ),
            consequent=Conclusion("structure", "DOMINANT"),
            weight=0.9,
            description="Price at SR zone in strong trending regime → DOMINANT",
        ),
        FuzzyRule(
            antecedent=(
                Condition("zone_proximity", "NEAR_ZONE"),
                Condition("regime_strength", "DOMINANT"),
            ),
            consequent=Conclusion("structure", "DOMINANT"),
            weight=0.85,
            description="Price near key zone in dominant regime → DOMINANT",
        ),
        # ── FIRM ─────────────────────────────────────────────────────────
        FuzzyRule(
            antecedent=(
                Condition("zone_proximity", "AT_ZONE"),
                Condition("regime_strength", "MODERATE"),
            ),
            consequent=Conclusion("structure", "FIRM"),
            weight=1.0,
            description="Price at SR zone in moderate regime → FIRM structure",
        ),
        FuzzyRule(
            antecedent=(
                Condition("zone_proximity", "NEAR_ZONE"),
                Condition("regime_strength", "STRONG"),
            ),
            consequent=Conclusion("structure", "FIRM"),
            weight=0.9,
            description="Price near zone in strong regime → FIRM",
        ),
        FuzzyRule(
            antecedent=(
                Condition("zone_proximity", "NEAR_ZONE"),
                Condition("regime_strength", "MODERATE"),
            ),
            consequent=Conclusion("structure", "FIRM"),
            weight=0.8,
            description="Price near SR zone in moderate regime → FIRM",
        ),
        FuzzyRule(
            antecedent=(
                Condition("zone_proximity", "APPROACHING_ZONE"),
                Condition("regime_strength", "DOMINANT"),
            ),
            consequent=Conclusion("structure", "FIRM"),
            weight=0.75,
            description="Price approaching zone in dominant regime → FIRM (momentum into structure)",
        ),
        # ── CONTESTED ────────────────────────────────────────────────────
        FuzzyRule(
            antecedent=(
                Condition("zone_proximity", "BETWEEN_ZONES"),
                Condition("regime_strength", "MODERATE"),
            ),
            consequent=Conclusion("structure", "CONTESTED"),
            weight=1.0,
            description="Price between SR zones in moderate regime → CONTESTED",
        ),
        FuzzyRule(
            antecedent=(
                Condition("zone_proximity", "APPROACHING_ZONE"),
                Condition("regime_strength", "FRAGILE"),
            ),
            consequent=Conclusion("structure", "CONTESTED"),
            weight=0.85,
            description="Price approaching zone in fragile regime → CONTESTED",
        ),
        FuzzyRule(
            antecedent=(
                Condition("zone_proximity", "AT_ZONE"),
                Condition("regime_strength", "FRAGILE"),
            ),
            consequent=Conclusion("structure", "CONTESTED"),
            weight=0.8,
            description="Price at zone in fragile regime → CONTESTED (unstable structure)",
        ),
        FuzzyRule(
            antecedent=(
                Condition("zone_proximity", "AT_ZONE"),
                Condition("regime_strength", "WEAK"),
            ),
            consequent=Conclusion("structure", "CONTESTED"),
            weight=0.85,
            description="Price at zone in weak regime → CONTESTED (zone under pressure)",
        ),
        FuzzyRule(
            antecedent=(
                Condition("zone_proximity", "NEAR_ZONE"),
                Condition("regime_strength", "WEAK"),
            ),
            consequent=Conclusion("structure", "CONTESTED"),
            weight=0.80,
            description="Price near zone in weak regime → CONTESTED (unstable boundary)",
        ),
        FuzzyRule(
            antecedent=(
                Condition("zone_proximity", "NEAR_ZONE"),
                Condition("regime_strength", "FRAGILE"),
            ),
            consequent=Conclusion("structure", "CONTESTED"),
            weight=0.75,
            description="Price near zone in fragile regime → CONTESTED",
        ),
        FuzzyRule(
            antecedent=(
                Condition("zone_proximity", "BETWEEN_ZONES"),
                Condition("regime_strength", "STRONG"),
            ),
            consequent=Conclusion("structure", "CONTESTED"),
            weight=0.7,
            description="Between zones in strong trend → CONTESTED (mid-trend air pocket)",
        ),
        # ── BROKEN ───────────────────────────────────────────────────────
        FuzzyRule(
            antecedent=(
                Condition("zone_proximity", "FAR_FROM_ZONES"),
            ),
            consequent=Conclusion("structure", "BROKEN"),
            weight=1.0,
            description="Price far from any SR zone → structure BROKEN (no nearby reference)",
        ),
        FuzzyRule(
            antecedent=(
                Condition("zone_proximity", "BETWEEN_ZONES"),
                Condition("regime_strength", "WEAK"),
            ),
            consequent=Conclusion("structure", "BROKEN"),
            weight=0.9,
            description="Between zones in weak regime → BROKEN structure",
        ),
        FuzzyRule(
            antecedent=(
                Condition("zone_proximity", "FAR_FROM_ZONES"),
                Condition("regime_strength", "WEAK"),
            ),
            consequent=Conclusion("structure", "BROKEN"),
            weight=1.0,
            description="Far from zones in weak regime → BROKEN (no structure, no trend)",
        ),
        FuzzyRule(
            antecedent=(
                Condition("regime_strength", "WEAK"),
                Condition("zone_proximity", "APPROACHING_ZONE"),
            ),
            consequent=Conclusion("structure", "BROKEN"),
            weight=0.7,
            description="Approaching zone but regime is weak → BROKEN (unreliable structure)",
        ),
    ],
)


# ---------------------------------------------------------------------------
# StructureFIS — Public Interface
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class StructureInputs:
    """Pre-computed numeric inputs for the Structure FIS."""
    zone_proximity_pct: float   # % distance to nearest SR zone (0 = at zone)
    regime_strength: float       # [0.0, 1.0] numeric regime encoding


@dataclass(frozen=True)
class StructureFISResult:
    """Structured output from the Structure FIS evaluation."""
    label: str
    activation: float
    zone_proximity_activations: list[dict[str, Any]]
    regime_strength_activations: list[dict[str, Any]]
    fired_rules: list[dict[str, Any]]
    narrative: str
    inputs: dict[str, float]
    regime_label: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "label": self.label,
            "activation": self.activation,
            "zone_proximity_activations": self.zone_proximity_activations,
            "regime_strength_activations": self.regime_strength_activations,
            "fired_rules": self.fired_rules,
            "narrative": self.narrative,
            "inputs": self.inputs,
            "regime_label": self.regime_label,
        }


class StructureFIS:
    """
    Structure Fuzzy Inference System.

    Evaluates SR zone proximity and market regime strength → BROKEN / CONTESTED / FIRM / DOMINANT.
    """

    @staticmethod
    def evaluate(inputs: StructureInputs, regime_label: str = "") -> StructureFISResult:
        x_prox = inputs.zone_proximity_pct
        x_regime = inputs.regime_strength

        prox_mfs: list[MembershipResult] = _ZONE_PROXIMITY_VAR.fuzzify(x_prox)
        regime_mfs: list[MembershipResult] = _REGIME_STRENGTH_VAR.fuzzify(x_regime)

        activations: dict[str, dict[str, float]] = {}
        activations.update(build_activations_map("zone_proximity", prox_mfs))
        activations.update(build_activations_map("regime_strength", regime_mfs))

        fired: list[FiredRule] = _STRUCTURE_RULES.evaluate(activations)
        label, act = defuzzify_max_membership(fired)

        prox_dominant = _ZONE_PROXIMITY_VAR.dominant_term(x_prox)
        regime_dominant = _REGIME_STRENGTH_VAR.dominant_term(x_regime)

        narrative = (
            f"Price is {x_prox:.2f}% from the nearest SR zone (classified as {prox_dominant}). "
            f"Market regime '{regime_label}' encodes to strength {x_regime:.2f} "
            f"(classified as {regime_dominant}). "
            f"Mamdani inference yields structure label: {label} with activation {act:.2f}."
        )

        return StructureFISResult(
            label=label,
            activation=act,
            zone_proximity_activations=[mr.to_dict() for mr in prox_mfs],
            regime_strength_activations=[mr.to_dict() for mr in regime_mfs],
            fired_rules=[fr.to_dict() for fr in fired],
            narrative=narrative,
            inputs={
                "zone_proximity_pct": round(x_prox, 4),
                "regime_strength": round(x_regime, 4),
            },
            regime_label=regime_label,
        )

    @staticmethod
    def extract_inputs(
        current_price: float,
        sr_zones: list[dict[str, Any]],
        regime: str,
    ) -> StructureInputs:
        """
        Derive StructureInputs from SupportResistanceService and MarketRegimeDTO.

        Parameters
        ----------
        current_price : float — latest close price
        sr_zones      : list of SR zone dicts with 'zone_high' and 'zone_low' keys
        regime        : str — regime label from MarketRegimeDTO.regime
        """
        # Compute proximity as minimum percentage distance to any zone boundary
        min_proximity_pct = 99.0
        if current_price > 0 and sr_zones:
            for zone in sr_zones:
                zone_high = float(zone.get("zone_high", 0.0))
                zone_low = float(zone.get("zone_low", 0.0))
                zone_mid = (zone_high + zone_low) / 2.0 if zone_high and zone_low else 0.0

                if zone_mid > 0:
                    dist_pct = abs(current_price - zone_mid) / current_price * 100.0
                    min_proximity_pct = min(min_proximity_pct, dist_pct)

        regime_strength = encode_regime_strength(regime)

        return StructureInputs(
            zone_proximity_pct=round(min_proximity_pct, 4),
            regime_strength=round(regime_strength, 4),
        )
