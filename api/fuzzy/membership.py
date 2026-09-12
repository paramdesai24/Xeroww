"""
api/fuzzy/membership.py
────────────────────────────────────────────────────────────────────────────
Pure mathematical membership functions for the Mamdani Fuzzy Inference System.

All functions are stateless, dependency-free, and return values in [0.0, 1.0].
No NumPy, no SciPy, no external libraries — pure Python math only.

Supported membership function shapes:
  • trimf    — triangular (most common; sharp peak at centre)
  • trapmf   — trapezoidal (plateau between b and c)
  • gaussmf  — gaussian bell-curve (smooth peak)
  • sigmf    — sigmoid (smooth asymptotic transition)

LinguisticVariable wraps a named collection of (term → mf_fn) mappings and
exposes:
  • fuzzify(x)       → list[MembershipResult] sorted descending by value
  • dominant_term(x) → str label of highest-activation term
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Callable


# ---------------------------------------------------------------------------
# Core membership function shapes
# ---------------------------------------------------------------------------

def trimf(x: float, a: float, b: float, c: float) -> float:
    """
    Triangular membership function.

    Shape:
        0 when x <= a or x >= c
        1 when x == b
        linear interpolation on [a,b] and [b,c]

    Parameters
    ----------
    x : crisp input value
    a : left foot (0% activation)
    b : peak (100% activation)
    c : right foot (0% activation)
    """
    if a == b == c:
        return 1.0 if x == b else 0.0
    if x <= a or x >= c:
        return 0.0
    if x == b:
        return 1.0
    if x < b:
        return (x - a) / (b - a) if (b - a) != 0 else 0.0
    return (c - x) / (c - b) if (c - b) != 0 else 0.0


def trapmf(x: float, a: float, b: float, c: float, d: float) -> float:
    """
    Trapezoidal membership function.

    Shape:
        0 when x <= a or x >= d
        1 when b <= x <= c
        linear ramp on [a,b] and [c,d]

    Parameters
    ----------
    x : crisp input value
    a : left foot (0%)
    b : left shoulder (100% plateau starts)
    c : right shoulder (100% plateau ends)
    d : right foot (0%)
    """
    if x <= a or x >= d:
        return 0.0
    if b <= x <= c:
        return 1.0
    if a < x < b:
        return (x - a) / (b - a) if (b - a) != 0 else 1.0
    # c < x < d
    return (d - x) / (d - c) if (d - c) != 0 else 1.0


def gaussmf(x: float, mean: float, sigma: float) -> float:
    """
    Gaussian (bell-curve) membership function.

    Shape: exp(-0.5 * ((x - mean) / sigma)^2)
    Peak of 1.0 at x == mean, symmetric decay.

    Parameters
    ----------
    x    : crisp input value
    mean : centre of the bell
    sigma: standard deviation (controls width; smaller → narrower)
    """
    if sigma == 0.0:
        return 1.0 if x == mean else 0.0
    exponent = -0.5 * ((x - mean) / sigma) ** 2
    return math.exp(exponent)


def sigmf(x: float, c: float, a: float) -> float:
    """
    Sigmoid membership function.

    Shape: 1 / (1 + exp(-a * (x - c)))
    Returns ~0 for x << c and ~1 for x >> c.
    Use for one-sided smooth transitions (e.g., "very large").

    Parameters
    ----------
    x : crisp input value
    c : inflection point (0.5 activation)
    a : steepness (positive → ascending, negative → descending)
    """
    try:
        return 1.0 / (1.0 + math.exp(-a * (x - c)))
    except OverflowError:
        return 0.0 if a * (x - c) < 0 else 1.0


# ---------------------------------------------------------------------------
# Typed result dataclass
# ---------------------------------------------------------------------------

@dataclass(frozen=True, order=True)
class MembershipResult:
    """
    Activation result for a single linguistic term.

    Attributes
    ----------
    value : float in [0.0, 1.0] — degree of membership
    term  : str — the linguistic label (e.g., "STRONG", "ELEVATED")
    """
    # order=True sorts by (value, term); use value for descending sort at call site
    value: float
    term: str

    def to_dict(self) -> dict[str, Any]:
        return {"term": self.term, "value": round(self.value, 4)}


# ---------------------------------------------------------------------------
# Linguistic Variable
# ---------------------------------------------------------------------------

MFFunction = Callable[[float], float]


@dataclass
class LinguisticVariable:
    """
    A named fuzzy linguistic variable containing an ordered collection of
    (term, membership_function) pairs.

    Usage
    -----
    rvol_var = LinguisticVariable("rvol", [
        ("VERY_LOW", lambda x: trapmf(x, 0, 0, 0.4, 0.6)),
        ("LOW",      lambda x: trimf(x, 0.4, 0.7, 1.0)),
        ("NORMAL",   lambda x: trimf(x, 0.8, 1.0, 1.3)),
        ("HIGH",     lambda x: trimf(x, 1.2, 1.8, 2.5)),
        ("EXTREME",  lambda x: trapmf(x, 2.0, 2.5, 99.0, 99.0)),
    ])

    results = rvol_var.fuzzify(1.9)
    # → [MembershipResult(value=0.82, term="HIGH"), ...]
    """

    name: str
    terms: list[tuple[str, MFFunction]] = field(default_factory=list)

    def fuzzify(self, x: float) -> list[MembershipResult]:
        """
        Evaluate all membership functions at crisp value x.

        Returns a list of MembershipResult sorted DESCENDING by activation value,
        so index-0 is always the dominant term.
        """
        results = [
            MembershipResult(value=round(mf(x), 4), term=term)
            for term, mf in self.terms
        ]
        # Sort descending by value (primary), then by term (secondary, for stability)
        return sorted(results, key=lambda r: (-r.value, r.term))

    def dominant_term(self, x: float) -> str:
        """Return the term with the highest membership activation at x."""
        results = self.fuzzify(x)
        return results[0].term if results else "UNKNOWN"

    def activation(self, x: float, term: str) -> float:
        """Return the activation of a specific term at x."""
        for t, mf in self.terms:
            if t == term:
                return round(mf(x), 4)
        return 0.0
