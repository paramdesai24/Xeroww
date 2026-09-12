"""
api/fuzzy/dimensions/volume.py
────────────────────────────────────────────────────────────────────────────
VolumeFIS — Fuzzy Inference System for volume intensity interpretation.

Inputs (derived from VolumeService / RVOLService outputs):
  • rvol          : relative volume multiplier (today_vol / avg_baseline_vol)
  • volume_trend  : (today_vol - avg_5d_vol) / avg_5d_vol × 100   [%]

Output linguistic labels:
  DRY | NORMAL | ELEVATED | CLIMACTIC

This FIS describes current volume intensity and trend relative to baseline.
It does NOT predict whether volume will sustain — it describes what IS.
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
# Linguistic Variables — RVOL (multiplier)
# ---------------------------------------------------------------------------

_RVOL_VAR = LinguisticVariable(
    name="rvol",
    terms=[
        ("VERY_LOW", lambda x: trapmf(x, 0.0, 0.0, 0.35, 0.55)),
        ("LOW",      lambda x: trimf(x, 0.35, 0.65, 0.95)),
        ("NORMAL",   lambda x: trimf(x, 0.75, 1.0, 1.35)),
        ("HIGH",     lambda x: trimf(x, 1.15, 1.7, 2.5)),
        ("EXTREME",  lambda x: trapmf(x, 2.0, 2.8, 99.0, 99.0)),
    ],
)

# ---------------------------------------------------------------------------
# Linguistic Variables — Volume Trend (%)
# ---------------------------------------------------------------------------

_VOLUME_TREND_VAR = LinguisticVariable(
    name="volume_trend",
    terms=[
        ("DECLINING", lambda x: trapmf(x, -200.0, -200.0, -20.0, -8.0)),
        ("STABLE",    lambda x: trimf(x, -15.0, 0.0, 15.0)),
        ("RISING",    lambda x: trimf(x, 8.0, 30.0, 80.0)),
        ("SURGING",   lambda x: trapmf(x, 60.0, 100.0, 500.0, 500.0)),
    ],
)

# ---------------------------------------------------------------------------
# Mamdani Rule Base — Volume
# ---------------------------------------------------------------------------

_VOLUME_RULES = RuleBase(
    output_variable="volume",
    rules=[
        # ── CLIMACTIC ────────────────────────────────────────────────────
        FuzzyRule(
            antecedent=(
                Condition("rvol", "EXTREME"),
                Condition("volume_trend", "SURGING"),
            ),
            consequent=Conclusion("volume", "CLIMACTIC"),
            weight=1.0,
            description="RVOL extreme AND volume trend surging → CLIMACTIC volume",
        ),
        FuzzyRule(
            antecedent=(
                Condition("rvol", "EXTREME"),
                Condition("volume_trend", "RISING"),
            ),
            consequent=Conclusion("volume", "CLIMACTIC"),
            weight=0.9,
            description="RVOL extreme AND rising trend → CLIMACTIC",
        ),
        FuzzyRule(
            antecedent=(
                Condition("rvol", "HIGH"),
                Condition("volume_trend", "SURGING"),
            ),
            consequent=Conclusion("volume", "CLIMACTIC"),
            weight=0.85,
            description="High RVOL with surging trend → CLIMACTIC",
        ),
        # ── ELEVATED ─────────────────────────────────────────────────────
        FuzzyRule(
            antecedent=(
                Condition("rvol", "HIGH"),
                Condition("volume_trend", "RISING"),
            ),
            consequent=Conclusion("volume", "ELEVATED"),
            weight=1.0,
            description="High RVOL AND rising volume trend → ELEVATED",
        ),
        FuzzyRule(
            antecedent=(
                Condition("rvol", "HIGH"),
                Condition("volume_trend", "STABLE"),
            ),
            consequent=Conclusion("volume", "ELEVATED"),
            weight=0.85,
            description="High RVOL with stable trend → ELEVATED",
        ),
        FuzzyRule(
            antecedent=(
                Condition("rvol", "NORMAL"),
                Condition("volume_trend", "SURGING"),
            ),
            consequent=Conclusion("volume", "ELEVATED"),
            weight=0.8,
            description="Normal RVOL but trend surging → ELEVATED",
        ),
        FuzzyRule(
            antecedent=(
                Condition("rvol", "EXTREME"),
                Condition("volume_trend", "DECLINING"),
            ),
            consequent=Conclusion("volume", "ELEVATED"),
            weight=0.75,
            description="RVOL extreme but declining → ELEVATED (fading climax)",
        ),
        # ── NORMAL ───────────────────────────────────────────────────────
        FuzzyRule(
            antecedent=(
                Condition("rvol", "NORMAL"),
                Condition("volume_trend", "STABLE"),
            ),
            consequent=Conclusion("volume", "NORMAL"),
            weight=1.0,
            description="RVOL normal AND trend stable → NORMAL volume",
        ),
        FuzzyRule(
            antecedent=(
                Condition("rvol", "NORMAL"),
                Condition("volume_trend", "RISING"),
            ),
            consequent=Conclusion("volume", "NORMAL"),
            weight=0.8,
            description="RVOL normal AND trend rising → NORMAL (building, not elevated yet)",
        ),
        FuzzyRule(
            antecedent=(
                Condition("rvol", "LOW"),
                Condition("volume_trend", "RISING"),
            ),
            consequent=Conclusion("volume", "NORMAL"),
            weight=0.75,
            description="Low RVOL but rising trend → NORMAL (recovering)",
        ),
        FuzzyRule(
            antecedent=(
                Condition("rvol", "HIGH"),
                Condition("volume_trend", "DECLINING"),
            ),
            consequent=Conclusion("volume", "NORMAL"),
            weight=0.7,
            description="Previously high RVOL now declining → NORMAL (exhaustion)",
        ),
        # ── DRY ──────────────────────────────────────────────────────────
        FuzzyRule(
            antecedent=(
                Condition("rvol", "VERY_LOW"),
            ),
            consequent=Conclusion("volume", "DRY"),
            weight=1.0,
            description="RVOL very low → DRY volume regardless of trend",
        ),
        FuzzyRule(
            antecedent=(
                Condition("rvol", "LOW"),
                Condition("volume_trend", "DECLINING"),
            ),
            consequent=Conclusion("volume", "DRY"),
            weight=0.9,
            description="Low RVOL AND declining trend → DRY (institutional absence)",
        ),
        FuzzyRule(
            antecedent=(
                Condition("rvol", "LOW"),
                Condition("volume_trend", "STABLE"),
            ),
            consequent=Conclusion("volume", "DRY"),
            weight=0.7,
            description="Low RVOL with stable trend → DRY",
        ),
    ],
)


# ---------------------------------------------------------------------------
# VolumeFIS — Public Interface
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class VolumeInputs:
    """Pre-computed numeric inputs for the Volume FIS."""
    rvol: float            # relative volume multiplier (e.g., 1.8 = 80% above average)
    volume_trend_pct: float  # (today - avg_5d) / avg_5d * 100


@dataclass(frozen=True)
class VolumeFISResult:
    """Structured output from the Volume FIS evaluation."""
    label: str
    activation: float
    rvol_activations: list[dict[str, Any]]
    volume_trend_activations: list[dict[str, Any]]
    fired_rules: list[dict[str, Any]]
    narrative: str
    inputs: dict[str, float]

    def to_dict(self) -> dict[str, Any]:
        return {
            "label": self.label,
            "activation": self.activation,
            "rvol_activations": self.rvol_activations,
            "volume_trend_activations": self.volume_trend_activations,
            "fired_rules": self.fired_rules,
            "narrative": self.narrative,
            "inputs": self.inputs,
        }


class VolumeFIS:
    """
    Volume Fuzzy Inference System.

    Evaluates current volume intensity and trend → DRY / NORMAL / ELEVATED / CLIMACTIC.
    """

    @staticmethod
    def evaluate(inputs: VolumeInputs) -> VolumeFISResult:
        x_rvol = inputs.rvol
        x_trend = inputs.volume_trend_pct

        rvol_mfs: list[MembershipResult] = _RVOL_VAR.fuzzify(x_rvol)
        trend_mfs: list[MembershipResult] = _VOLUME_TREND_VAR.fuzzify(x_trend)

        activations: dict[str, dict[str, float]] = {}
        activations.update(build_activations_map("rvol", rvol_mfs))
        activations.update(build_activations_map("volume_trend", trend_mfs))

        fired: list[FiredRule] = _VOLUME_RULES.evaluate(activations)
        label, act = defuzzify_max_membership(fired)

        rvol_dominant = _RVOL_VAR.dominant_term(x_rvol)
        trend_dominant = _VOLUME_TREND_VAR.dominant_term(x_trend)

        narrative = (
            f"Relative volume (RVOL) is {x_rvol:.2f}× baseline (classified as {rvol_dominant}). "
            f"Volume trend vs 5-day average: {x_trend:+.1f}% (classified as {trend_dominant}). "
            f"Mamdani inference yields volume label: {label} with activation {act:.2f}."
        )

        return VolumeFISResult(
            label=label,
            activation=act,
            rvol_activations=[mr.to_dict() for mr in rvol_mfs],
            volume_trend_activations=[mr.to_dict() for mr in trend_mfs],
            fired_rules=[fr.to_dict() for fr in fired],
            narrative=narrative,
            inputs={
                "rvol": round(x_rvol, 4),
                "volume_trend_pct": round(x_trend, 4),
            },
        )

    @staticmethod
    def calculate_volume_ema10(volumes: list[float]) -> float | None:
        """Calculate standard 10-period exponential moving average of volume."""
        if not volumes:
            return None
        if len(volumes) < 10:
            return sum(volumes) / len(volumes)
        # Standard EMA recursion: alpha = 2 / (period + 1) = 2 / 11
        k = 2.0 / (10.0 + 1.0)
        ema = sum(volumes[:10]) / 10.0
        for v in volumes[10:]:
            ema = v * k + ema * (1.0 - k)
        return ema

    @staticmethod
    def extract_inputs(
        rvol: float,
        current_volume: float,
        recent_volumes: list[float] | None = None,
    ) -> VolumeInputs:
        """
        Derive VolumeInputs from raw service data.
        VolumeTrend = (Volume_t - EMA10(Volume)) / EMA10(Volume) * 100
        """
        if not recent_volumes:
            return VolumeInputs(rvol=rvol, volume_trend_pct=0.0)

        ema10 = VolumeFIS.calculate_volume_ema10(recent_volumes)
        if ema10 and ema10 > 0:
            trend_pct = ((current_volume - ema10) / ema10 * 100.0)
        else:
            trend_pct = 0.0

        return VolumeInputs(
            rvol=round(rvol, 4),
            volume_trend_pct=round(trend_pct, 2),
        )
