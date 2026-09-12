"""
api/fuzzy
─────────────────────────────────────────────────────────────────
Classical Mamdani Fuzzy Inference System — Interpretation Layer.

Sits entirely ABOVE the deterministic analytics pipeline.
Consumes typed DTOs from AnalyticsOrchestrator and produces
linguistic labels with full rule-firing transparency.

This is NOT:
  - Machine Learning
  - Neural Networks
  - Price Prediction
  - Buy/Sell Recommendation

This IS:
  - Linguistic Variables
  - Membership Functions (trimf, trapmf, gaussmf)
  - Mamdani Rule Evaluation
  - Defuzzification → human-readable label

Zero external dependencies. Pure Python math.
"""

from api.fuzzy.membership import (
    LinguisticVariable,
    MembershipResult,
    gaussmf,
    sigmf,
    trapmf,
    trimf,
)
from api.fuzzy.orchestrator import (
    FuzzyDimension,
    FuzzyExplainabilityReport,
    FuzzyOrchestrator,
    default_fuzzy_orchestrator,
)
from api.fuzzy.rules import (
    Conclusion,
    Condition,
    FiredRule,
    FuzzyRule,
    RuleBase,
    defuzzify_max_membership,
)

__all__ = [
    "Conclusion",
    # Rules
    "Condition",
    "FiredRule",
    # Orchestrator
    "FuzzyDimension",
    "FuzzyExplainabilityReport",
    "FuzzyOrchestrator",
    "FuzzyRule",
    "LinguisticVariable",
    "MembershipResult",
    "RuleBase",
    "default_fuzzy_orchestrator",
    "defuzzify_max_membership",
    "gaussmf",
    "sigmf",
    "trapmf",
    # Membership
    "trimf",
]
